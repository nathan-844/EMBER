// Minimal Google Gemini client for EMBER's analysis call (REST, generateContent).
// The model is asked for JSON matching a schema; EMBER still re-checks everything it says.

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Fast, separately-quota’d model first for a public demo; set GEMINI_MODEL to reorder.
export const DEFAULT_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"];

export interface GeminiConfig {
  apiKey: string;
  /** Model ids in fallback order. 429 / 500 / 503 / 404 move on to the next one. */
  models: string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Gemini 3 thinking level ("low" is ~10× faster here; the checker and one retry catch slips). Unset: model default. */
  thinkingLevel?: string;
}

export type GeminiResult =
  | { ok: true; model: string; text: string; tried: { model: string; status: number }[]; ms: number }
  | { ok: false; status: number; error: string; tried: { model: string; status: number }[] };

/** Strip a JSON schema down to what Gemini's responseJsonSchema accepts (it rejects `const` and readonly markers are fine). */
function cleanSchema(schema: unknown): unknown {
  return JSON.parse(JSON.stringify(schema));
}

export function parseModelList(value: string | undefined): string[] {
  const list = (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

/**
 * Models to skip until a time, per server instance. A 429 carries Google's RetryInfo delay
 * (hours when a daily quota is used up), a 503 cools off for 30 s, a 404 for an hour. This
 * keeps an exhausted model from adding a wasted round trip to every request.
 */
const cooldown = new Map<string, number>();
export function resetCooldowns() {
  cooldown.clear();
}

function retryDelayMs(body: any): number | null {
  for (const d of body?.error?.details ?? []) {
    const m = typeof d?.retryDelay === "string" ? /^(\d+(?:\.\d+)?)s$/.exec(d.retryDelay) : null;
    if (m) return Math.min(Number(m[1]) * 1000, 24 * 3600 * 1000);
  }
  return null;
}

/**
 * Call generateContent on each model in turn until one returns usable text.
 * Never logs or returns the API key; errors are summarised to a status and a short message.
 */
export async function generateJson(cfg: GeminiConfig, system: string, user: string, schema: unknown): Promise<GeminiResult> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const tried: { model: string; status: number }[] = [];
  const started = Date.now();
  let last: { status: number; error: string } = { status: 502, error: "No model configured." };

  const now = Date.now();
  const available = cfg.models.filter((m) => (cooldown.get(m) ?? 0) <= now);
  if (!available.length) {
    const until = Math.min(...cfg.models.map((m) => cooldown.get(m) ?? now));
    return {
      ok: false,
      status: 429,
      error: `Every configured Gemini model is out of quota or overloaded; the earliest should be back in about ${Math.max(1, Math.round((until - now) / 60000))} min.`,
      tried: cfg.models.map((model) => ({ model, status: 429 })),
    };
  }

  for (const model of available) {
    for (let thinking = !!cfg.thinkingLevel; ; thinking = false) {
    let res: Response;
    try {
      res = await doFetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseJsonSchema: cleanSchema(schema),
            ...(thinking ? { thinkingConfig: { thinkingLevel: cfg.thinkingLevel } } : {}),
          },
        }),
        // Per-model limit, so one slow or overloaded model falls through to the next.
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 45_000),
      });
    } catch (e) {
      const timeout = (e as Error)?.name === "TimeoutError";
      tried.push({ model, status: timeout ? 504 : 0 });
      last = { status: timeout ? 504 : 502, error: timeout ? "The model took too long to answer." : "Could not reach the Gemini API." };
      break;
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    tried.push({ model, status: res.status });

    if (!res.ok) {
      const message: string = body?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 400 && /api key/i.test(message)) return { ok: false, status: 401, error: "The Gemini API key was rejected.", tried };
      if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: "The Gemini API key was rejected or lacks access.", tried };
      // A model without thinking levels: retry the same model once without the setting.
      if (res.status === 400 && thinking && /think/i.test(message)) continue;
      last = {
        status: res.status,
        error:
          res.status === 429 ? "Gemini rate limit or quota reached; try again shortly."
          : res.status === 404 ? `Model ${model} is not available to this key.`
          : res.status === 400 ? `Gemini rejected the request: ${message.slice(0, 160)}`
          : `Gemini error ${res.status}.`,
      };
      if (res.status === 429) cooldown.set(model, Date.now() + (retryDelayMs(body) ?? 60_000));
      else if (res.status === 503) cooldown.set(model, Date.now() + 30_000);
      else if (res.status === 404) cooldown.set(model, Date.now() + 3600_000);
      if (RETRYABLE.has(res.status)) break;
      return { ok: false, ...last, tried };
    }

    if (body?.promptFeedback?.blockReason) {
      return { ok: false, status: 422, error: `Gemini blocked the request (${body.promptFeedback.blockReason}).`, tried };
    }
    const cand = body?.candidates?.[0];
    const finish: string | undefined = cand?.finishReason;
    const text = (cand?.content?.parts ?? []).filter((p: any) => typeof p.text === "string" && !p.thought).map((p: any) => p.text).join("");
    if (finish === "MAX_TOKENS") { last = { status: 502, error: "The answer was cut off at the token limit." }; break; }
    if (finish && finish !== "STOP") return { ok: false, status: 422, error: `Gemini stopped early (${finish}).`, tried };
    if (!text.trim()) { last = { status: 502, error: "Gemini returned an empty answer." }; break; }
    return { ok: true, model, text, tried, ms: Date.now() - started };
    }
  }
  return { ok: false, ...last, tried };
}
