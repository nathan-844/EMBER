import { describe, expect, it } from "vitest";
import recorded from "../data/recorded-analyses.json";
import { analysisKey, ASK_MAX, AWAITING_RECORDING, cleanAsk, scenarioKey, SUGGESTED_ASKS } from "./recorded";
import { PRESETS, presetScenario } from "./scenario";

const entries = Object.entries((recorded as { entries: Record<string, any> }).entries);
const questions = ["prevention", "detection", "suppression"] as const;
// Plain analyses for every preset and safety question, plus the suggested "Ask EMBER" questions.
const presetKeys = new Set(
  PRESETS.flatMap((p) => questions.flatMap((q) => {
    const s = { ...presetScenario(p.id), question: q };
    return [scenarioKey(s), ...SUGGESTED_ASKS.map((a) => analysisKey(s, a))];
  })),
);

describe("Ask EMBER questions", () => {
  it("tidies whitespace and control characters, and treats blank as no question", () => {
    expect(cleanAsk("  Why\n\tBASS-II?  ")).toBe("Why BASS-II?");
    expect(cleanAsk("   ")).toBeNull();
    expect(cleanAsk(undefined)).toBeNull();
  });

  it("rejects non-strings, very short and over-long questions", () => {
    expect(cleanAsk(42)).toBeUndefined();
    expect(cleanAsk("ok")).toBeUndefined();
    expect(cleanAsk("x".repeat(ASK_MAX + 1))).toBeUndefined();
  });

  it("keys a question apart from the plain analysis, ignoring case", () => {
    const s = presetScenario("iss");
    expect(analysisKey(s, null)).toBe(scenarioKey(s));
    expect(analysisKey(s, "Why BASS-II?")).not.toBe(scenarioKey(s));
    expect(analysisKey(s, "Why BASS-II?")).toBe(analysisKey(s, "why bass-ii?"));
  });
});

describe("recorded analyses", () => {
  it("are keyed only by unedited presets, so a replay always matches what the user sees", () => {
    for (const [key] of entries) expect(presetKeys.has(key)).toBe(true);
  });

  it("only store answers that passed the grounding check", () => {
    for (const [, v] of entries) {
      expect(v.report.verdict).not.toBe("rejected");
      expect(v.report.claims.some((c: any) => c.accepted)).toBe(true);
      expect(v.model).toMatch(/^gemini/);
    }
  });

  it("cover the whole analysis and every suggested question on each preset's opening screen", () => {
    const stored = new Set(entries.map(([k]) => k));
    for (const p of PRESETS.filter((p) => p.id !== "custom" && !AWAITING_RECORDING.includes(p.id))) {
      const s = presetScenario(p.id);
      for (const a of [null, ...SUGGESTED_ASKS]) expect(stored.has(analysisKey(s, a)), `${p.id} ${a ?? "(whole scenario)"}`).toBe(true);
    }
  });

  it("only list presets as awaiting recording while they have none", () => {
    const keys = entries.map(([k]) => k);
    for (const id of AWAITING_RECORDING) {
      expect(PRESETS.some((p) => p.id === id), id).toBe(true);
      expect(keys.some((k) => k.startsWith(`["${id}"`)), `${id} is recorded now; remove it from AWAITING_RECORDING`).toBe(false);
    }
  });

  it("changes the key when any ranking input changes", () => {
    const s = presetScenario("iss");
    expect(scenarioKey({ ...s, oxygenPct: 21.5 })).not.toBe(scenarioKey(s));
    expect(scenarioKey({ ...s, material: "Nomex" })).not.toBe(scenarioKey(s));
  });
});
