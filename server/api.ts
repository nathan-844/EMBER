// Framework-neutral API for /api/ai-status and /api/analyze, shared by the Vite dev/preview
// server (server/analyze.ts → analysisMiddleware) and the Vercel functions (server/vercel.ts).
//
// Quota protection, in the order a request meets it:
//  1. An unedited preset replays its recorded answer: no model call.
//  2. A scenario answered before is served from the cache (Vercel Runtime Cache when deployed,
//     memory locally) for CACHE_TTL: no model call.
//  3. Identical requests already in flight share one model call.
//  4. Live calls are rate limited per visitor and capped per day across everyone; past either
//     limit the user is told plainly and pointed at the presets, which keep working.
//  5. Gemini itself falls through a chain of models with separate quotas (server/gemini.ts).
import { getCache } from "@vercel/functions";
import recorded from "../src/data/recorded-analyses.json";
import { scenarioKey } from "../src/lib/recorded";
import type { Scenario } from "../src/lib/scenario";
import { analyze, parseScenario, type AnalysisResponse } from "./analyze";
import type { GeminiConfig } from "./gemini";

export interface ApiConfig extends Omit<GeminiConfig, "apiKey"> {
  apiKey: string | undefined;
  /** Live analyses one visitor may start per window. */
  perVisitorLimit?: number;
  perVisitorWindowS?: number;
  /** Live analyses per UTC day across all visitors. */
  dailyLimit?: number;
  cacheTtlS?: number;
  /** Injected for tests; defaults to the Vercel Runtime Cache (in-memory off Vercel). */
  store?: KV;
  now?: () => number;
}

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts: { ttl: number }): Promise<void>;
}

export interface ApiRequest { method: string; path: string; body: string; visitor: string }
export interface ApiResponse { status: number; body: unknown; headers?: Record<string, string> }

type Recorded = { recordedOn: string | null; entries: Record<string, AnalysisResponse> };
const RECORDED = recorded as unknown as Recorded;

const defaultStore = (): KV => {
  const c = getCache({ namespace: "ember" });
  return {
    get: (k) => c.get(k),
    set: (k, v, o) => c.set(k, v as never, { ttl: o.ttl, name: k.split(":")[0] }),
  };
};

/** Short, non-reversible visitor id: the raw IP is never stored. */
export async function visitorId(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`ember:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createApi(cfg: ApiConfig) {
  const enabled = !!cfg.apiKey;
  const store = cfg.store ?? defaultStore();
  const now = cfg.now ?? Date.now;
  const perVisitor = cfg.perVisitorLimit ?? 6;
  const windowS = cfg.perVisitorWindowS ?? 600;
  const daily = cfg.dailyLimit ?? 250;
  const ttl = cfg.cacheTtlS ?? 7 * 24 * 3600;
  const inflight = new Map<string, Promise<ApiResponse>>();

  const json = (status: number, body: unknown, headers: Record<string, string> = {}): ApiResponse => ({
    status,
    body,
    headers: { "Cache-Control": "no-store", ...headers },
  });

  // Counter updates run one at a time on this instance: without that, simultaneous requests all
  // read the same count before any of them writes it back, and every one gets through.
  // `local` remembers this instance's own counts, so a store read that lags a write cannot
  // undercount. Across instances the store is still read-then-write (no atomic increment).
  let counterQueue: Promise<unknown> = Promise.resolve();
  const local = new Map<string, { count: number; until: number }>();

  /** Fixed-window counter, serialized per instance. */
  function bump(key: string, limit: number, ttlS: number): Promise<{ ok: boolean; count: number }> {
    const run = async () => {
      const mine = local.get(key);
      const stored = ((await store.get(key)) as number | undefined) ?? 0;
      const count = Math.max(stored, mine && mine.until > now() ? mine.count : 0) + 1;
      if (count > limit) return { ok: false, count: count - 1 };
      local.set(key, { count, until: now() + ttlS * 1000 });
      if (local.size > 10_000) for (const [k, e] of local) if (e.until <= now()) local.delete(k);
      await store.set(key, count, { ttl: ttlS });
      return { ok: true, count };
    };
    const result = counterQueue.then(run, run);
    counterQueue = result.catch(() => undefined);
    return result;
  }

  async function handle(req: ApiRequest): Promise<ApiResponse | null> {
    if (req.path === "/api/ai-status") {
      if (req.method !== "GET") return json(405, { error: "Use GET." });
      return json(200, {
        enabled,
        provider: enabled ? "Google Gemini" : null,
        model: enabled ? cfg.models[0] : null,
        recorded: Object.keys(RECORDED.entries).length,
        limits: enabled ? { perVisitor, windowMinutes: Math.round(windowS / 60), daily } : null,
      });
    }
    if (req.path !== "/api/analyze") return null;
    if (req.method !== "POST") return json(405, { error: "Use POST." });
    if (req.body.length > 20_000) return json(400, { error: "Invalid scenario." });

    let scenario: Scenario | null;
    try {
      scenario = parseScenario(JSON.parse(req.body));
    } catch {
      scenario = null;
    }
    if (!scenario) return json(400, { error: "Invalid scenario." });
    const key = scenarioKey(scenario);

    // 1. Recorded presets: instant and free, live key or not.
    const rec = RECORDED.entries[key];
    if (rec) return json(200, { ...rec, recorded: true });
    if (!enabled) {
      return json(503, { error: "Live AI analysis is not connected here. The unedited presets show answers recorded through the same pipeline." });
    }

    // 2. Cache of earlier live answers.
    const hit = (await store.get(`answer:${key}`)) as AnalysisResponse | undefined;
    if (hit) return json(200, { ...hit, cached: true });

    // 3. Join an identical request already running. Check and register with no await in
    //    between, so concurrent requests cannot each start their own model call.
    const running = inflight.get(key);
    if (running) {
      const shared = await running;
      return shared.status === 200 ? { ...shared, body: { ...(shared.body as object), cached: true } } : shared;
    }
    const job = runLive(key, scenario, req.visitor);
    inflight.set(key, job);
    try {
      return await job;
    } finally {
      inflight.delete(key);
    }
  }

  async function runLive(key: string, scenario: Scenario, visitor: string): Promise<ApiResponse> {
    // 4. Rate limits (only live calls count).
    const windowIndex = Math.floor(now() / 1000 / windowS);
    const day = new Date(now()).toISOString().slice(0, 10);
    const v = await bump(`rate:${visitor}:${windowIndex}`, perVisitor, windowS);
    if (!v.ok) {
      return json(429, {
        error: `You have run ${perVisitor} live analyses in ${Math.round(windowS / 60)} minutes, the limit that keeps the demo available for everyone. Try again shortly; the presets still show their recorded answers.`,
        retryAfterS: windowS,
      }, { "Retry-After": String(windowS) });
    }
    const d = await bump(`daily:${day}`, daily, 26 * 3600);
    if (!d.ok) {
      return json(429, {
        error: "Today's live-analysis budget for this public demo is used up. The presets still show answers recorded through the same pipeline; live analysis resets at 00:00 UTC.",
      }, { "Retry-After": "3600" });
    }

    // 5. Live call (Gemini model chain inside).
    const out = await analyze({ ...cfg, apiKey: cfg.apiKey! }, scenario);
    if ("error" in out) return json(out.status, { error: out.error, tried: out.tried });
    if (out.report.verdict !== "rejected") await store.set(`answer:${key}`, out, { ttl });
    return json(200, out);
  }

  return { handle, enabled };
}

/** Plain in-memory store with TTLs, for tests and as a fallback. */
export function memoryStore(now: () => number = Date.now): KV {
  const m = new Map<string, { v: unknown; until: number }>();
  return {
    async get(k) {
      const e = m.get(k);
      if (!e || e.until < now()) return undefined;
      return e.v;
    },
    async set(k, v, o) {
      m.set(k, { v, until: now() + o.ttl * 1000 });
    },
  };
}
