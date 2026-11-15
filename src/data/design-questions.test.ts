import { describe, expect, it } from "vitest";
import findings from "./findings.json";
import { EQUIPMENT_LINKS } from "./applications";
import { DESIGN_QUESTIONS, designQuestionsFor } from "./design-questions";
import { NTRS_QUOTES } from "./ntrs-evidence";
import { safetyConclusion } from "../lib/grounding";
import { presetScenario } from "../lib/scenario";

describe("design questions", () => {
  it("are questions, never safety conclusions", () => {
    for (const q of DESIGN_QUESTIONS) {
      expect(q.question.endsWith("?"), q.id).toBe(true);
      expect(safetyConclusion(q.question), q.id).toBe(false);
      expect(safetyConclusion(q.why), q.id).toBe(false);
    }
  });

  it("cite only evidence EMBER has checked", () => {
    const ntrs = new Set(NTRS_QUOTES.map((x) => x.id));
    const psi = new Set(EQUIPMENT_LINKS.map((x) => x.id));
    const found = new Set(findings.findings.map((f) => f.id));
    for (const q of DESIGN_QUESTIONS) {
      expect(q.evidence.length, q.id).toBeGreaterThan(0);
      for (const e of q.evidence) {
        const ok = e.kind === "ntrs" ? ntrs.has(e.quote) : e.kind === "psi" ? psi.has(e.link) : found.has(e.id);
        expect(ok, `${q.id} → ${JSON.stringify(e)}`).toBe(true);
      }
    }
    expect(new Set(DESIGN_QUESTIONS.map((q) => q.id)).size).toBe(DESIGN_QUESTIONS.length);
  });

  it("put the questions that apply to the scenario first", () => {
    const moon = designQuestionsFor(presetScenario("lunar-exploration"));
    const applies = moon.filter((x) => x.applies).map((x) => x.q.id);
    expect(applies).toEqual(expect.arrayContaining(["dq-vent-shutdown", "dq-self-extinguish", "dq-screening", "dq-atmosphere", "dq-lunar-gap"]));
    expect(moon.findIndex((x) => !x.applies)).toBe(applies.length);
    const iss = designQuestionsFor({ ...presetScenario("iss"), question: "detection" }).filter((x) => x.applies).map((x) => x.q.id);
    expect(iss).toEqual(expect.arrayContaining(["dq-airflow", "dq-co-detection", "dq-smoke-size"]));
    expect(iss).not.toContain("dq-vent-shutdown");
  });
});
