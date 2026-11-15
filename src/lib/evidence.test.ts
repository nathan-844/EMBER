import { describe, expect, it } from "vitest";
import rawFindings from "../data/findings.json";
import { buildEvidencePackage, findingSources } from "./evidence";
import type { FindingsFile } from "./findings/types";
import { checkAnswer, type ModelAnswer } from "./grounding";
import { presetScenario } from "./scenario";

const FINDINGS = (rawFindings as unknown as FindingsFile).findings;

describe("measured findings as AI evidence", () => {
  it("offers the findings that draw on the ranked investigations, with the generated claim as text", () => {
    const s = findingSources(["flex"]);
    expect(s.map((x) => x.id)).toEqual(["finding:F1", "finding:F2"]);
    const f2 = FINDINGS.find((f) => f.id === "F2")!;
    expect(s[1].text).toContain(f2.claim);
    expect(s[1].text).toContain(f2.notClaimed);
    expect(s[1].origin).toBe("derived");
    expect(findingSources(["daft"])).toEqual([]);
  });

  it("puts them in the package for a lunar habitat with liquid fuel", () => {
    const pkg = buildEvidencePackage({ ...presetScenario("lunar-habitat"), fuel: "liquid" });
    expect(pkg.sources.some((x) => x.id === "finding:F2")).toBe(true);
  });

  it("lets the checker accept an exact quote of a finding and reject a changed number", () => {
    const pkg = buildEvidencePackage({ ...presetScenario("lunar-habitat"), fuel: "liquid" });
    const src = pkg.sources.find((x) => x.id === "finding:F2")!;
    const excerpt = "None of these 17 flames went out before the droplet burned away or broke apart";
    expect(src.text).toContain(excerpt);
    const answer = (text: string): ModelAnswer => ({
      summary: { text: "FLEX burned droplets near exploration air.", sources: ["finding:F2"] },
      claims: [{ kind: "Interpretation", text, implication: "", citations: [{ source: "finding:F2", excerpt }] }],
      openQuestions: [],
    });
    expect(checkAnswer(answer("None of the 17 FLEX flames near exploration air went out early."), pkg).claims[0].accepted).toBe(true);
    expect(checkAnswer(answer("None of the 23 FLEX flames near exploration air went out early."), pkg).claims[0].accepted).toBe(false);
  });
});
