import { describe, expect, it } from "vitest";
import { probeRobustness, rankRangeLabel, rankStability, WEIGHT_SCHEMES } from "./robustness";
import { rankInvestigations } from "./ranking";
import { presetScenario, PRESETS } from "./scenario";

describe("robustness probes", () => {
  it("runs two changes per specified numeric input and one removal per specified input", () => {
    const r = probeRobustness(presetScenario("lunar-habitat"));
    expect(r.changesTotal).toBe(8);
    expect(r.removalsTotal).toBe(5);
  });

  it("runs no probes for an empty custom scenario without fuel", () => {
    const r = probeRobustness({ ...presetScenario("custom"), fuel: null });
    expect(r.probes).toHaveLength(0);
  });

  it("held counts never exceed totals for every preset and question", () => {
    for (const p of PRESETS) {
      for (const question of ["prevention", "detection", "suppression"] as const) {
        const r = probeRobustness({ ...presetScenario(p.id), question });
        expect(r.changesHeld).toBeLessThanOrEqual(r.changesTotal);
        expect(r.removalsHeld).toBeLessThanOrEqual(r.removalsTotal);
      }
    }
  });

  it("dependencies are exactly the removals that moved the lead", () => {
    const r = probeRobustness(presetScenario("lunar-habitat"));
    expect(r.dependsOn.length).toBe(r.removalsTotal - r.removalsHeld);
  });

  it("never perturbs below zero", () => {
    const r = probeRobustness({ ...presetScenario("iss"), airflowMs: 0 });
    expect(r.changesTotal).toBeGreaterThan(0);
  });

  it("re-ranks under every alternative point scheme", () => {
    const r = probeRobustness(presetScenario("iss"));
    expect(r.weightProbes).toHaveLength(WEIGHT_SCHEMES.length);
    expect(r.weightsHeld).toBe(r.weightProbes.filter((p) => p.unchanged).length);
  });

  it("keeps a lead that matches every condition under all schemes", () => {
    const r = probeRobustness(presetScenario("iss"));
    expect(r.lead).toBe("bass-ii");
    expect(r.weightsHeld).toBe(WEIGHT_SCHEMES.length);
  });
});

describe("rank stability under ±20% weights", () => {
  it("tries all 128 corners plus the defaults and keeps the default rank inside the range", () => {
    for (const p of PRESETS.filter((x) => x.id !== "custom")) {
      const s = presetScenario(p.id);
      const ranked = rankInvestigations(s);
      const ranges = rankStability(s);
      expect(ranges.size).toBe(ranked.length);
      for (const r of ranked) {
        const range = ranges.get(r.investigation.id)!;
        expect(range.combos).toBe(129);
        expect(range.base).toBe(r.rank);
        expect(range.min).toBeLessThanOrEqual(r.rank);
        expect(range.max).toBeGreaterThanOrEqual(r.rank);
      }
    }
  });

  it("finds ranks that hold and ranks that move", () => {
    const lunar = rankStability(presetScenario("lunar-habitat"));
    expect(lunar.get("acme-bre")).toMatchObject({ min: 1, max: 1 });
    const iss = rankStability(presetScenario("iss"));
    expect(iss.get("bass-ii")).toMatchObject({ min: 1, max: 1 });
    expect(iss.get("acme-bre")!.max).toBeGreaterThan(iss.get("acme-bre")!.min);
  });

  it("widens or keeps the range as the swing grows, and is a single rank with no swing", () => {
    const s = presetScenario("iss");
    const none = rankStability(s, 0);
    for (const r of none.values()) expect(r.min).toBe(r.max);
    const small = rankStability(s, 0.1), big = rankStability(s, 0.3);
    for (const [id, r] of small) {
      expect(big.get(id)!.min).toBeLessThanOrEqual(r.min);
      expect(big.get(id)!.max).toBeGreaterThanOrEqual(r.max);
    }
  });

  it("says plainly whether a rank holds", () => {
    expect(rankRangeLabel({ base: 1, min: 1, max: 1, combos: 129 })).toBe("Stays rank 1 if weights move ±20%");
    expect(rankRangeLabel({ base: 2, min: 2, max: 6, combos: 129 })).toBe("Rank 2–6 if weights move ±20%");
  });
});
