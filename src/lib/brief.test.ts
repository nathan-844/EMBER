import { describe, expect, it } from "vitest";
import { buildBrief, buildCsv } from "./brief";
import { compareRankings } from "./compare";
import { scenarioLimitations } from "./limitations";
import { rankInvestigations } from "./ranking";
import { presetScenario } from "./scenario";

describe("evidence brief", () => {
  const s = presetScenario("lunar-habitat");
  const ranked = rankInvestigations(s);
  const md = buildBrief(s, ranked, scenarioLimitations(s, ranked), new Date("2026-11-14"));

  it("includes the computed O2 partial pressure", () => {
    expect(md).toContain("3.06 psia");
  });

  it("lists every ranked investigation", () => {
    for (const r of ranked) expect(md).toContain(r.investigation.name);
  });

  it("cites the PSI record of every ranked investigation", () => {
    for (const r of ranked) expect(md).toContain(r.investigation.psi.url!);
  });

  it("states it is not a safety certification", () => {
    expect(md).toMatch(/not a safety certification/);
  });
});

describe("baseline comparison", () => {
  it("is empty when nothing changed", () => {
    const r = rankInvestigations(presetScenario("iss"));
    expect(compareRankings(r, r)).toEqual([]);
  });

  it("reports score shifts when oxygen changes", () => {
    const base = rankInvestigations(presetScenario("iss"));
    const now = rankInvestigations({ ...presetScenario("iss"), oxygenPct: 30 });
    expect(compareRankings(base, now).some((x) => x.delta < 0)).toBe(true);
  });
});

describe("csv export", () => {
  it("has one row per ranked investigation and condition, with sources", () => {
    const s = presetScenario("iss");
    const ranked = rankInvestigations(s);
    const lines = buildCsv(s, ranked).trim().split("\n");
    expect(lines.length).toBe(1 + ranked.length * 5);
    expect(lines[0]).toMatch(/^rank,investigation/);
    expect(lines.some((l) => l.includes("psi-table") && l.includes("PSI-25-0"))).toBe(true);
    expect(lines.some((l) => l.includes(",curated,"))).toBe(true);
  });

  it("quotes cells containing commas or quotes", () => {
    const s = presetScenario("iss");
    const csv = buildCsv(s, rankInvestigations(s));
    // The run-table basis holds both: NASA PSI-25-0 run table, column "Calibrated ..."
    expect(csv).toContain('"NASA PSI-25-0 run table, column ""Calibrated');
  });
});
