import { describe, expect, it } from "vitest";
import recorded from "../data/recorded-analyses.json";
import { scenarioKey } from "./recorded";
import { PRESETS, presetScenario } from "./scenario";

const entries = Object.entries((recorded as { entries: Record<string, any> }).entries);
const questions = ["prevention", "detection", "suppression"] as const;
const presetKeys = new Set(PRESETS.flatMap((p) => questions.map((q) => scenarioKey({ ...presetScenario(p.id), question: q }))));

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

  it("changes the key when any ranking input changes", () => {
    const s = presetScenario("iss");
    expect(scenarioKey({ ...s, oxygenPct: 21.5 })).not.toBe(scenarioKey(s));
    expect(scenarioKey({ ...s, material: "Nomex" })).not.toBe(scenarioKey(s));
  });
});
