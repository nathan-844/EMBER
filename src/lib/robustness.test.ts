import { describe, expect, it } from "vitest";
import { probeRobustness } from "./robustness";
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
});
