import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEvidencePackage } from "../src/lib/evidence";
import { presetScenario } from "../src/lib/scenario";
import { createApi, memoryStore, visitorId, type KV } from "./api";
import { resetCooldowns } from "./gemini";

beforeEach(() => resetCooldowns());

/** A grounded answer for ISS-like scenarios (built from the real evidence package). */
function goodAnswer() {
  const pkg = buildEvidencePackage(presetScenario("iss"));
  const o2 = pkg.sources.find((s) => s.id === "bass-ii:oxygenPct")!;
  return {
    summary: { text: "BASS-II is the closest recorded match.", sources: ["bass-ii:ranking"] },
    claims: [{ kind: "Reported finding", text: "BASS-II recorded oxygen from 13.6 to 22.2%.", implication: "", citations: [{ source: o2.id, excerpt: o2.text.slice(0, 45) }] }],
    openQuestions: [],
  };
}
const reply = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

/** A store whose reads and writes take time, like the Vercel Runtime Cache over the network. */
function slowStore(inner: KV, ms: number): KV {
  const wait = () => new Promise((r) => setTimeout(r, ms));
  return {
    get: async (k) => { await wait(); return inner.get(k); },
    set: async (k, v, o) => { await wait(); return inner.set(k, v, o); },
  };
}

function setup(opts: { perVisitorLimit?: number; dailyLimit?: number; delayMs?: number; answer?: unknown; storeMs?: number } = {}) {
  let t = Date.UTC(2026, 10, 14, 12, 0, 0);
  const now = () => t;
  const fetchImpl = vi.fn(async () => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    return reply(opts.answer ?? goodAnswer());
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const store = opts.storeMs ? slowStore(memoryStore(now), opts.storeMs) : memoryStore(now);
  const api = createApi({
    apiKey: "k", models: ["m"], fetchImpl, store, now,
    perVisitorLimit: opts.perVisitorLimit ?? 3, perVisitorWindowS: 600, dailyLimit: opts.dailyLimit ?? 100,
  });
  const call = (scenario: unknown, visitor = "v1") => api.handle({ method: "POST", path: "/api/analyze", body: JSON.stringify(scenario), visitor });
  return { api, call, fetchImpl, advance: (s: number) => (t += s * 1000) };
}

/** Distinct edited ISS scenarios (never a recorded preset). */
const live = (o2: number) => ({ ...presetScenario("iss"), oxygenPct: o2 });

describe("quota protection", () => {
  it("serves recorded presets instantly even with a live key", async () => {
    const { call, fetchImpl } = setup();
    const out = await call(presetScenario("lunar-habitat"));
    if (out!.status === 200) {
      expect((out!.body as any).recorded).toBe(true);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("answers a repeated scenario from the cache without a second model call", async () => {
    const { call, fetchImpl } = setup();
    const a = await call(live(21.5));
    const b = await call(live(21.5), "someone-else");
    expect(a!.status).toBe(200);
    expect((b!.body as any).cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("merges identical requests that arrive together into one model call", async () => {
    const { call, fetchImpl } = setup({ delayMs: 50 });
    const [a, b, c] = await Promise.all([call(live(21.5), "a"), call(live(21.5), "b"), call(live(21.5), "c")]);
    expect([a!.status, b!.status, c!.status]).toEqual([200, 200, 200]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("limits live calls per visitor, then recovers after the window", async () => {
    const { call, advance } = setup({ perVisitorLimit: 2 });
    expect((await call(live(20)))!.status).toBe(200);
    expect((await call(live(20.5)))!.status).toBe(200);
    const blocked = await call(live(19.5));
    expect(blocked!.status).toBe(429);
    expect((blocked!.body as any).error).toMatch(/presets still show/);
    expect(blocked!.headers!["Retry-After"]).toBe("600");
    // Another visitor is unaffected.
    expect((await call(live(19.5), "v2"))!.status).toBe(200);
    advance(601);
    expect((await call(live(19), "v1"))!.status).toBe(200);
  });

  it("holds the per-visitor limit when live requests arrive at the same time", async () => {
    const { call, fetchImpl } = setup({ perVisitorLimit: 3, storeMs: 5 });
    const outs = await Promise.all([20, 20.5, 21.1, 21.25, 21.75, 22, 22.5, 23].map((o2) => call(live(o2))));
    expect(outs.filter((o) => o!.status === 200)).toHaveLength(3);
    expect(outs.filter((o) => o!.status === 429)).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("holds the daily cap when live requests from many visitors arrive at the same time", async () => {
    const { call } = setup({ dailyLimit: 2, perVisitorLimit: 100, storeMs: 5 });
    const outs = await Promise.all([20, 20.5, 21.1, 21.25, 21.75].map((o2, i) => call(live(o2), `v${i}`)));
    expect(outs.filter((o) => o!.status === 200)).toHaveLength(2);
  });

  it("does not count cached or recorded answers against the limit", async () => {
    const { call } = setup({ perVisitorLimit: 1 });
    expect((await call(live(20)))!.status).toBe(200);
    expect((await call(live(20)))!.status).toBe(200); // cached
    expect((await call(presetScenario("iss")))!.status).toBe(200); // recorded
  });

  it("stops at the daily cap across all visitors", async () => {
    const { call } = setup({ dailyLimit: 2, perVisitorLimit: 100 });
    expect((await call(live(20), "a"))!.status).toBe(200);
    expect((await call(live(20.5), "b"))!.status).toBe(200);
    const out = await call(live(21.25), "c");
    expect(out!.status).toBe(429);
    expect((out!.body as any).error).toMatch(/budget/);
  });

  it("does not cache rejected answers", async () => {
    const bad = { summary: { text: "x", sources: [] }, claims: [{ kind: "Interpretation", text: "No basis.", implication: "", citations: [] }], openQuestions: [] };
    const { call, fetchImpl } = setup({ answer: bad });
    await call(live(20));
    await call(live(20));
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(3); // first + retry, then again
  });

  it("reports the limits on the status endpoint", async () => {
    const { api } = setup();
    const out = await api.handle({ method: "GET", path: "/api/ai-status", body: "", visitor: "v" });
    expect((out!.body as any).limits).toEqual({ perVisitor: 3, windowMinutes: 10, daily: 100 });
  });

  it("ignores unknown paths", async () => {
    const { api } = setup();
    expect(await api.handle({ method: "GET", path: "/api/other", body: "", visitor: "v" })).toBeNull();
  });
});

describe("visitor id", () => {
  it("is stable, short and does not contain the address", async () => {
    const a = await visitorId("203.0.113.9");
    expect(a).toBe(await visitorId("203.0.113.9"));
    expect(a).not.toContain("203");
    expect(a).toHaveLength(16);
    expect(await visitorId("203.0.113.10")).not.toBe(a);
  });
});
