import { describe, expect, it } from "vitest";
import { gravityRegime, oxygenIncreaseVsEarth, oxygenPartialPressure, ppo2Sentence, ppo2VsEarth, presetScenario, PRESETS } from "./scenario";

describe("scenario presets", () => {
  it("lunar habitat follows the challenge atmosphere", () => {
    const s = presetScenario("lunar-habitat");
    expect(s.oxygenPct).toBe(30);
    expect(s.pressurePsi).toBe(10.2);
    expect(s.gravityG).toBeCloseTo(0.166);
  });

  it("custom preset leaves every condition unspecified", () => {
    const s = presetScenario("custom");
    expect([s.oxygenPct, s.pressurePsi, s.gravityG, s.airflowMs]).toEqual([null, null, null, null]);
  });

  it("keeps question and fuel when switching environment", () => {
    const prev = { ...presetScenario("iss"), question: "detection" as const, fuel: "liquid" as const };
    const next = presetScenario("spacesuit", prev);
    expect(next.question).toBe("detection");
    expect(next.fuel).toBe("liquid");
  });

  it("clears material, thickness and flow direction when switching environment", () => {
    const prev = { ...presetScenario("lunar-habitat"), material: "Nomex", thicknessMm: 5, flowDirection: "opposed" as const };
    const next = presetScenario("iss", prev);
    expect([next.material, next.thicknessMm, next.flowDirection]).toEqual([null, null, null]);
    expect(next).toEqual(presetScenario("iss"));
  });

  it("every preset has a unique id", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });
});

describe("oxygen partial pressure", () => {
  it("is 3.06 psia for 30% at 10.2 psi", () => {
    expect(oxygenPartialPressure({ oxygenPct: 30, pressurePsi: 10.2 })).toBeCloseTo(3.06, 2);
  });

  it("is null when an input is unspecified", () => {
    expect(oxygenPartialPressure({ oxygenPct: null, pressurePsi: 10.2 })).toBeNull();
  });

  it("30% O2 is more than a 40% increase over Earth air", () => {
    expect(oxygenIncreaseVsEarth(30)!).toBeGreaterThan(0.4);
  });
});

describe("gravity regime", () => {
  it.each([
    [0, "microgravity"],
    [0.166, "partial"],
    [0.38, "partial"],
    [1, "earth"],
    [null, "unspecified"],
  ] as const)("%s g is %s", (g, regime) => {
    expect(gravityRegime(g)).toBe(regime);
  });
});

describe("oxygen partial pressure against Earth", () => {
  it("puts the lunar-base atmosphere at Earth's partial pressure with 43% more oxygen fraction", () => {
    const c = ppo2VsEarth(presetScenario("lunar-habitat"))!;
    expect(c.psi).toBeCloseTo(3.06, 2);
    expect(c.kpa).toBeCloseTo(21.1, 1);
    expect(c.earthKpa).toBeCloseTo(21.23, 1);
    expect(ppo2Sentence(c)).toBe("about the same as Earth sea level (21.2 kPa), although the oxygen fraction is 43% higher than Earth air");
  });

  it("says when a richer atmosphere still has less oxygen pressure, or more", () => {
    expect(ppo2Sentence(ppo2VsEarth(presetScenario("lunar-exploration"))!)).toBe("9% below Earth sea level (21.2 kPa), although the oxygen fraction is 62% higher than Earth air");
    expect(ppo2Sentence(ppo2VsEarth(presetScenario("spacesuit"))!)).toBe("40% above Earth sea level (21.2 kPa)");
    expect(ppo2VsEarth({ oxygenPct: null, pressurePsi: 10 })).toBeNull();
  });
});
