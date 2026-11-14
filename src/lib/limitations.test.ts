import { describe, expect, it } from "vitest";
import { leadInsight, scenarioLimitations } from "./limitations";
import { rankInvestigations } from "./ranking";
import { presetScenario } from "./scenario";

const ids = (s: ReturnType<typeof presetScenario>) => scenarioLimitations(s, rankInvestigations(s)).map((l) => l.id);

describe("limitations", () => {
  it("flags partial gravity for a lunar habitat", () => {
    expect(ids(presetScenario("lunar-habitat"))).toContain("partial-gravity");
  });

  it("does not flag partial gravity in orbit", () => {
    expect(ids(presetScenario("iss"))).not.toContain("partial-gravity");
  });

  it("always warns that overlapping ranges are not joint coverage", () => {
    expect(ids(presetScenario("custom"))).toContain("joint");
  });

  it("flags elevated oxygen nobody covers", () => {
    expect(ids(presetScenario("spacesuit"))).toContain("elevated-o2");
  });

  it("drops the material caveat once material is set", () => {
    const s = { ...presetScenario("lunar-habitat"), material: "Nomex" };
    expect(ids(s)).not.toContain("material");
  });
});

describe("lead insight", () => {
  it("is null when nothing ranks", () => {
    const s = { ...presetScenario("iss"), question: "detection" as const, includeAdjacent: false };
    expect(leadInsight(s, [])).toBeNull();
  });

  it("names the lead investigation", () => {
    const s = presetScenario("lunar-habitat");
    const r = rankInvestigations(s);
    expect(leadInsight(s, r)!.investigation).toBe(r[0].investigation.name);
  });
});
