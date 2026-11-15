// F1 and F2: FLEX (PSI-69) droplet burns. Every FLEX row records how the burn ended
// ("Test end": Extinction / Disruption / Completion), the starting droplet diameter and,
// when the flame went out, the droplet diameter at that moment.
import type { AtlasRow } from "../atlas/types";
import { bootstrapCI, ciText, median, pctCi, round, spearman, wilson } from "./stats";
import type { Finding } from "./types";

type Diluent = "none" | "CO2" | "He";
const diluentOf = (r: AtlasRow): Diluent => ((r.diluent?.co2?.v ?? 0) > 0 ? "CO2" : (r.diluent?.he?.v ?? 0) > 0 ? "He" : "none");
const DILUENT_WORDS: Record<Diluent, string> = { none: "nitrogen only", CO2: "CO₂ added", He: "helium added" };

/** Pressure bands FLEX ran at (psia). Runs outside them (≈3 atm, or no usable pressure) are left out. */
const BANDS = [
  { id: "1 atm", min: 12, max: 16 },
  { id: "0.7 atm", min: 9, max: 12 },
] as const;
const bandOf = (psi: number | null | undefined) => (psi == null ? null : BANDS.find((b) => psi >= b.min && psi < b.max)?.id ?? null);

const flexTests = (rows: AtlasRow[]) => rows.filter((r) => r.investigation === "flex" && r.rowKind === "test");

/** Groups need this many extinguished runs at this many oxygen levels to measure a trend. */
const MIN_RUNS = 6;
const MIN_LEVELS = 3;

export function f1ExtinctionVsOxygen(rows: AtlasRow[]): Finding {
  const tests = flexTests(rows);
  const extinguished = tests.filter((r) => r.outcome.value === "extinguished");
  let noDiameter = 0, outOfBand = 0;
  const groups = new Map<string, { fuel: string; diluent: Diluent; band: string; runs: { id: string; o2: number; ratio: number }[] }>();
  for (const r of extinguished) {
    const d0 = r.measures.dropletDiameterMm?.v, de = r.measures.extinctionDiameterMm?.v, o2 = r.o2Pct?.v;
    if (typeof d0 !== "number" || typeof de !== "number" || typeof o2 !== "number" || d0 <= 0) { noDiameter++; continue; }
    const band = bandOf(r.pressurePsi?.v);
    if (!band) { outOfBand++; continue; }
    const key = `${r.material.name}|${diluentOf(r)}|${band}`;
    if (!groups.has(key)) groups.set(key, { fuel: r.material.name!, diluent: diluentOf(r), band, runs: [] });
    groups.get(key)!.runs.push({ id: r.id, o2, ratio: de / d0 });
  }

  const measured = [...groups.values()]
    .map((g) => {
      const levels = [...new Set(g.runs.map((x) => x.o2))].sort((a, b) => a - b);
      const at = (o2: number) => median(g.runs.filter((x) => x.o2 === o2).map((x) => x.ratio))!;
      const rhoOf = (rs: typeof g.runs) => spearman(rs.map((x) => x.o2), rs.map((x) => x.ratio));
      return { ...g, levels, rho: rhoOf(g.runs), rhoCi: bootstrapCI([g.runs], ([rs]) => rhoOf(rs)), lowRatio: at(levels[0]), highRatio: at(levels[levels.length - 1]) };
    })
    .filter((g) => g.runs.length >= MIN_RUNS && g.levels.length >= MIN_LEVELS && g.rho !== null)
    .sort((a, b) => a.fuel.localeCompare(b.fuel) || a.band.localeCompare(b.band) || a.diluent.localeCompare(b.diluent));
  const tooSmall = [...groups.values()].reduce((n, g) => n + g.runs.length, 0) - measured.reduce((n, g) => n + g.runs.length, 0);

  const used = measured.flatMap((g) => g.runs);
  const negative = measured.filter((g) => g.rho! < 0).length;
  const rhos = measured.map((g) => g.rho!);
  const ref = measured.find((g) => g.fuel === "Methanol" && g.diluent === "none" && g.band === "1 atm")!;
  const clearlyNegative = measured.filter((g) => g.rhoCi && g.rhoCi[1] < 0).length;
  const crossesZero = measured.filter((g) => !g.rhoCi || (g.rhoCi[0] <= 0 && g.rhoCi[1] >= 0)).length;
  const numbers = {
    groups: measured.length,
    groupsFallingOxygenMoreFuelLeft: negative,
    groupsIntervalBelowZero: clearlyNegative,
    groupsIntervalSpansZero: crossesZero,
    refRhoCiLow: ref.rhoCi ? round(ref.rhoCi[0]) : "n/a",
    refRhoCiHigh: ref.rhoCi ? round(ref.rhoCi[1]) : "n/a",
    runs: used.length,
    rhoMin: round(Math.min(...rhos)),
    rhoMax: round(Math.max(...rhos)),
    refLowO2: ref.levels[0],
    refLowRatio: round(ref.lowRatio),
    refHighO2: ref.levels[ref.levels.length - 1],
    refHighRatio: round(ref.highRatio),
  };
  return {
    id: "F1",
    title: "Less oxygen, and the flame goes out with more fuel left",
    claim:
      `In ${negative} of ${measured.length} groups of FLEX droplet burns (same fuel, added gas and pressure), flames that went out did so earlier, with more of the droplet unburned, the lower the oxygen (rank correlation ${numbers.rhoMin} to ${numbers.rhoMax}, ${used.length} runs). ` +
      `For methanol in nitrogen at about 1 atm, the flame went out at a median ${numbers.refLowRatio} of the starting droplet diameter at ${numbers.refLowO2}% O₂, against ${numbers.refHighRatio} at ${numbers.refHighO2}%.`,
    numbers,
    n: used.length,
    rows: used.map((x) => x.id),
    excluded: [
      { reason: "ended another way (disruption or burned away), so there is no extinction diameter", count: tests.length - extinguished.length },
      { reason: "extinction or starting diameter, or oxygen, not recorded", count: noDiameter },
      { reason: "pressure outside the 0.7 atm and 1 atm bands (about 3 atm, or written as 0)", count: outOfBand },
      { reason: `group too small to measure a trend (fewer than ${MIN_RUNS} runs or ${MIN_LEVELS} oxygen levels)`, count: tooSmall },
    ].filter((e) => e.count > 0),
    method:
      `1. Take FLEX runs whose "Test end" is Extinction and that record both the starting droplet diameter and the visible flame extinction diameter. ` +
      `2. Divide extinction diameter by starting diameter: 1 means the flame went out at once, near 0 that almost all the fuel burned. ` +
      `3. Group runs by fuel, added gas (none, CO₂ or helium, from NASA's composition columns) and pressure band (0.7 atm: 9–12 psia; 1 atm: 12–16 psia). ` +
      `4. In each group with at least ${MIN_RUNS} runs over ${MIN_LEVELS} oxygen levels, compute Spearman's rank correlation between oxygen and the ratio. A negative value means less oxygen, more fuel left.`,
    uncertainty: {
      text:
        `In ${clearlyNegative} of ${measured.length} groups the 95% bootstrap interval of the rank correlation lies wholly below zero; in ${crossesZero} it includes zero, so those groups alone do not show a direction. ` +
        `For methanol in nitrogen at about 1 atm the correlation is ${round(ref.rho!)} (95% interval ${ciText(ref.rhoCi)}).`,
      method: `Percentile bootstrap: each group's runs resampled with replacement ${2000} times (seeded, so the interval is the same on every rebuild), Spearman's correlation recomputed each time, and the middle 95% kept.`,
    },
    confounders: [
      "Starting droplet size varies between runs (about 1.5 to 5 mm), and large droplets can go out from radiative heat loss at any oxygen level.",
      "Where CO₂ or helium was added, its share changes with the oxygen level, so oxygen and added gas are not varied independently.",
      "Runs that ended in disruption or burned away are left out, which removes the burns that lasted longest.",
      "Each oxygen level has only one to a few runs in most groups.",
    ],
    notClaimed:
      "Liquid fuel droplets, not cabin solids. This shows a direction within FLEX's own runs; it is not an oxygen limit, a flammability prediction or a fire-safety rating.",
    investigations: ["flex"],
    table: {
      columns: ["Fuel", "Added gas", "Pressure", "Runs", "O₂ levels (%)", "Rank correlation", "95% interval", "Ratio at lowest O₂", "Ratio at highest O₂"],
      rows: measured.map((g) => [g.fuel, DILUENT_WORDS[g.diluent], g.band, g.runs.length, `${g.levels[0]}–${g.levels[g.levels.length - 1]}`, round(g.rho!), ciText(g.rhoCi), round(g.lowRatio), round(g.highRatio)]),
    },
  };
}

/** The Space Apps challenge's exploration atmosphere: 30% O₂ or more at 10.2 psi or less (EMBER's lunar preset). */
export const EXPLORATION_ATMOSPHERE = { minO2Pct: 30, maxPsi: 10.2 } as const;

export function f2FlexNearExplorationAir(rows: AtlasRow[]): Finding {
  const tests = flexTests(rows).filter((r) => typeof r.o2Pct?.v === "number" && typeof r.pressurePsi?.v === "number");
  const high = tests.filter((r) => r.o2Pct!.v! >= EXPLORATION_ATMOSPHERE.minO2Pct && bandOf(r.pressurePsi!.v) === "0.7 atm" && diluentOf(r) === "none");
  const air = tests.filter((r) => r.o2Pct!.v === 21 && bandOf(r.pressurePsi!.v) === "1 atm" && diluentOf(r) === "none");
  const out = (rs: AtlasRow[]) => rs.filter((r) => r.outcome.value === "extinguished").length;
  const psis = high.map((r) => r.pressurePsi!.v!);
  const levels = [...new Set(high.map((r) => r.o2Pct!.v!))].sort((a, b) => a - b);
  const count = (rs: AtlasRow[], v: string) => rs.filter((r) => r.outcome.value === v).length;
  const numbers = {
    runs: high.length,
    o2Levels: levels.join(" and "),
    psiMin: round(Math.min(...psis)),
    psiMax: round(Math.max(...psis)),
    wentOut: out(high),
    disrupted: count(high, "disrupted"),
    burnedOut: count(high, "burned-out"),
    airRuns: air.length,
    airWentOut: out(air),
    challengeMaxPsi: EXPLORATION_ATMOSPHERE.maxPsi,
    wentOutCi: pctCi(wilson(out(high), high.length)),
    airWentOutCi: pctCi(wilson(out(air), air.length)),
  };
  const byGroup = new Map<string, AtlasRow[]>();
  for (const r of [...high, ...air]) {
    const k = `${r.material.name}|${r.o2Pct!.v}|${bandOf(r.pressurePsi!.v)}`;
    byGroup.set(k, [...(byGroup.get(k) ?? []), r]);
  }
  return {
    id: "F2",
    title: "FLEX already burned fuel near Moon-base air",
    claim:
      `FLEX burned ${high.length} fuel droplets at ${numbers.o2Levels}% O₂ and ${numbers.psiMin}–${numbers.psiMax} psia, close to the challenge's exploration atmosphere (30% O₂ or more at ${numbers.challengeMaxPsi} psi or less). ` +
      `${numbers.wentOut === 0 ? `None of these ${high.length} flames` : `${numbers.wentOut} of these flames`} went out before the droplet burned away or broke apart, against ${numbers.airWentOut} of ${air.length} in air at 1 atm.`,
    numbers,
    n: high.length + air.length,
    rows: [...high, ...air].map((r) => r.id),
    excluded: [{ reason: "other oxygen levels, pressures or added gases", count: flexTests(rows).length - high.length - air.length }],
    method:
      `1. Take FLEX runs with no CO₂ or helium added. 2. High-oxygen set: oxygen of ${EXPLORATION_ATMOSPHERE.minO2Pct}% or more in the 0.7 atm band (9–12 psia). Reference set: 21% oxygen in the 1 atm band (12–16 psia). ` +
      `3. Count how each burn ended, from NASA's "Test end" column: Extinction (the flame went out), Disruption (the droplet broke apart) or Completion (it burned away).`,
    uncertainty: {
      text:
        `Share of flames that went out: ${Math.round((100 * numbers.wentOut) / high.length)}% of ${high.length} near exploration air (95% interval ${numbers.wentOutCi}) against ${Math.round((100 * numbers.airWentOut) / air.length)}% of ${air.length} in air (${numbers.airWentOutCi}). ` +
        `${high.length < 20 ? `With only ${high.length} high-oxygen runs the first interval is wide.` : ""}`.trim(),
      method: "Wilson score 95% interval for each proportion, treating each burn as one independent trial.",
    },
    confounders: [
      "The high-oxygen runs are at about 10.4 psia, slightly above the challenge's 10.2 psi, so their oxygen partial pressure is higher than the exploration atmosphere's.",
      "The reference runs differ in pressure as well as oxygen.",
      "Disruption (the droplet breaking apart) ends a burn before the fuel is used up; it is not the flame going out.",
    ],
    notClaimed:
      "These are liquid fuel droplets (methanol and n-heptane), not cabin materials, and they burned in microgravity, not lunar gravity. They are analogue evidence for exploration atmospheres, not a prediction for solids.",
    investigations: ["flex"],
    table: {
      columns: ["Fuel", "O₂ (%)", "Pressure", "Runs", "Went out", "Broke apart", "Burned away"],
      rows: [...byGroup.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, rs]) => {
          const [fuel, o2, band] = k.split("|");
          return [fuel, Number(o2), band, rs.length, count(rs, "extinguished"), count(rs, "disrupted"), count(rs, "burned-out")];
        }),
    },
  };
}
