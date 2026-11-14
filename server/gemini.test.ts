import { describe, expect, it, vi } from "vitest";
import { beforeEach } from "vitest";
import { DEFAULT_MODELS, generateJson, parseModelList, resetCooldowns } from "./gemini";

const ok = (text: string, finishReason = "STOP") =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200 });
const err = (status: number, message = "x") => new Response(JSON.stringify({ error: { message } }), { status });

function mockFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  return fn as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const cfg = (fetchImpl: typeof fetch, models = ["m1", "m2"]) => ({ apiKey: "test-key", models, fetchImpl });

describe("model list", () => {
  it("parses a comma-separated chain and falls back to defaults", () => {
    expect(parseModelList(" a , b,,c ")).toEqual(["a", "b", "c"]);
    expect(parseModelList("")).toEqual(DEFAULT_MODELS);
    expect(parseModelList(undefined)).toEqual(DEFAULT_MODELS);
  });
});

describe("generateJson", () => {
  beforeEach(() => resetCooldowns());
  it("sends the key in a header, never in the URL, and asks for JSON", async () => {
    const f = mockFetch(ok('{"a":1}'));
    const r = await generateJson(cfg(f), "sys", "user", { type: "object" });
    expect(r).toMatchObject({ ok: true, model: "m1", text: '{"a":1}', tried: [{ model: "m1", status: 200 }] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent");
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema).toEqual({ type: "object" });
    expect(body.systemInstruction.parts[0].text).toBe("sys");
  });

  it.each([404, 429, 500, 503])("falls through to the next model on HTTP %i", async (status) => {
    const f = mockFetch(err(status), ok("{}"));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(r.ok && r.model).toBe("m2");
  });

  it("reports every model tried when all fail", async () => {
    const f = mockFetch(err(503), err(429));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.tried).toEqual([{ model: "m1", status: 503 }, { model: "m2", status: 429 }]);
      expect(r.error).toMatch(/rate limit|quota/i);
    }
  });

  it("stops immediately on a rejected key", async () => {
    const f = mockFetch(err(400, "API key not valid. Please pass a valid API key."), ok("{}"));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("stops on 403 without trying other models", async () => {
    const f = mockFetch(err(403), ok("{}"));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(!r.ok && r.status).toBe(401);
  });

  it("does not retry a malformed request (400)", async () => {
    const f = mockFetch(err(400, "Invalid JSON payload"), ok("{}"));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(!r.ok && r.error).toMatch(/rejected the request/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("treats a truncated answer as a failure and tries the next model", async () => {
    const f = mockFetch(ok('{"a":', "MAX_TOKENS"), ok('{"a":1}'));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(r.ok && r.model).toBe("m2");
  });

  it("refuses safety-stopped answers", async () => {
    const f = mockFetch(ok("", "SAFETY"));
    const r = await generateJson(cfg(f, ["m1"]), "s", "u", {});
    expect(!r.ok && r.error).toMatch(/SAFETY/);
  });

  it("refuses blocked prompts", async () => {
    const f = mockFetch(new Response(JSON.stringify({ promptFeedback: { blockReason: "OTHER" } }), { status: 200 }));
    const r = await generateJson(cfg(f, ["m1"]), "s", "u", {});
    expect(!r.ok && r.error).toMatch(/blocked/);
  });

  it("skips thought parts and joins text parts", async () => {
    const f = mockFetch(new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "thinking", thought: true }, { text: '{"a"' }, { text: ":1}" }] } }] }), { status: 200 }));
    const r = await generateJson(cfg(f, ["m1"]), "s", "u", {});
    expect(r.ok && r.text).toBe('{"a":1}');
  });

  it("treats an empty answer as a failure", async () => {
    const f = mockFetch(ok("   "));
    const r = await generateJson(cfg(f, ["m1"]), "s", "u", {});
    expect(!r.ok && r.error).toMatch(/empty/);
  });

  it("handles network errors and timeouts", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    const f = mockFetch(new Error("ECONNRESET"), timeout);
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(504);
      expect(r.tried.map((t) => t.status)).toEqual([0, 504]);
    }
  });

  it("handles a non-JSON error body", async () => {
    const f = mockFetch(new Response("<html>bad gateway</html>", { status: 502 }), ok("{}"));
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(r.ok && r.model).toBe("m2");
  });

  it("sends the thinking level when set, and drops it once if the model rejects it", async () => {
    const f = mockFetch(err(400, "Thinking level is not supported for this model."), ok("{}"));
    const r = await generateJson({ ...cfg(f, ["m1"]), thinkingLevel: "low" }, "s", "u", {});
    expect(r.ok).toBe(true);
    const bodies = (f.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => JSON.parse(init.body as string));
    expect(bodies[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(bodies[1].generationConfig.thinkingConfig).toBeUndefined();
  });

  it("skips a model whose daily quota is used up until Google's retry time", async () => {
    const quota = new Response(JSON.stringify({ error: { message: "quota", details: [{ retryDelay: "3600s" }] } }), { status: 429 });
    const f = mockFetch(quota, ok("{}"), ok("{}"));
    expect((await generateJson(cfg(f), "s", "u", {})).ok).toBe(true); // m1 429 -> m2
    const second = await generateJson(cfg(f), "s", "u", {});
    expect(second.ok && second.model).toBe("m2");
    expect(f).toHaveBeenCalledTimes(3); // m1 was not tried again
  });

  it("fails fast with a clear message when every model is cooling down", async () => {
    const q = () => new Response(JSON.stringify({ error: { message: "quota", details: [{ retryDelay: "600s" }] } }), { status: 429 });
    const f = mockFetch(q(), q());
    await generateJson(cfg(f), "s", "u", {});
    const r = await generateJson(cfg(f), "s", "u", {});
    expect(!r.ok && r.error).toMatch(/out of quota or overloaded.*10 min/);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
