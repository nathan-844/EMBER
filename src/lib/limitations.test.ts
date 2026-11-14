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

  it("flags elevated oxygen nobody covers when the fuel is unspecified", () => {
    expect(ids({ ...presetScenario("spacesuit"), fuel: null })).toContain("elevated-o2");
  });

  it("states the Moon-base finding: no solid-material test reaches 30% oxygen", () => {
    const s = presetScenario("lunar-habitat");
    const gap = scenarioLimitations(s, rankInvestigations(s)).find((l) => l.id === "o2-fuel-gap");
    expect(gap?.text).toMatch(/No solid-material test in the PSI data goes above 22.2% oxygen/);
    expect(gap?.text).toMatch(/fuel droplets|gas flames/);
    expect(leadInsight(s, rankInvestigations(s))!.keyFinding).toBe(gap?.text);
  });

  it("cites NASA for the partial-gravity caveat and does not claim the 0 g/1 g bound fails", () => {
    const s = presetScenario("lunar-habitat");
    const pg = scenarioLimitations(s, rankInvestigations(s)).find((l) => l.id === "partial-gravity")!;
    expect(pg.source?.href).toMatch(/nasa.gov/);
    expect(pg.text).toMatch(/may bound/);
    expect(pg.text).not.toMatch(/not bracketed/);
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

  it("never claims coverage from one matching condition on the Moon", () => {
    const s = presetScenario("lunar-habitat");
    const r = rankInvestigations(s);
    const insight = leadInsight(s, r)!;
    expect(insight.title).not.toMatch(/covers your/);
    if (r[0].conditions.find((c) => c.key === "gravityG")?.status === "outside") {
      expect(insight.title.toLowerCase()).toContain("gravity");
      expect(insight.gaps[0]).toMatch(/^gravity/);
      expect(insight.consideration).toMatch(/partial-gravity/);
    }
  });

  it("reports full coverage only when every specified condition matches", () => {
    const s = presetScenario("iss");
    const r = rankInvestigations(s);
    const insight = leadInsight(s, r)!;
    expect(insight.fullCoverage).toBe(r[0].matchedCount === r[0].specifiedCount);
    expect(insight.fullCoverage).toBe(insight.gaps.length === 0);
  });
});

describe("tested materials", () => {
  it("notes when a material appears in a PSI run table", () => {
    const s = { ...presetScenario("iss"), material: "Nomex" };
    expect(ids(s)).toContain("material-tested");
  });

  it("notes when no run table lists the material", () => {
    // Detection studies (Saffire, SAME) never ran Ultem; BASS did, but it is not ranked here.
    const s = { ...presetScenario("iss"), question: "detection" as const, includeAdjacent: false, material: "Ultem" };
    expect(ids(s)).toContain("material-untested");
  });

  it("does not say 'covers all' about a single specified condition", () => {
    const s = presetScenario("custom");
    const i = leadInsight(s, rankInvestigations(s))!;
    expect(i.title).not.toMatch(/covers all 1/);
    expect(i.title).toMatch(/only condition you specified/);
    expect(i.body).toMatch(/Left unspecified/);
  });
});

describe("ventilation in elevated oxygen", () => {
  it("warns for the 30% lunar habitat, citing BRE", () => {
    const s = presetScenario("lunar-habitat");
    const l = scenarioLimitations(s, rankInvestigations(s)).find((x) => x.id === "ventilation-high-o2");
    expect(l?.text).toMatch(/BRE/);
    expect(l?.source?.href).toMatch(/PSI-20$/);
  });

  it("does not warn for cabin air", () => {
    expect(ids(presetScenario("iss"))).not.toContain("ventilation-high-o2");
  });
});
