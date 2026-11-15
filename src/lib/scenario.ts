import type { FuelType, SafetyQuestion } from "../data/types";

export type EnvironmentId = "iss" | "lunar-habitat" | "lunar-exploration" | "artemis-surface-habitat" | "lunar-rover" | "mars-habitat" | "spacesuit" | "custom";

export interface Scenario {
  environment: EnvironmentId;
  question: SafetyQuestion;
  /** null means "unspecified" and earns no condition points for any investigation. */
  oxygenPct: number | null;
  pressurePsi: number | null;
  gravityG: number | null;
  airflowMs: number | null;
  fuel: FuelType | null;
  /** Descriptive only: no profile has normalized material, thickness or flow-direction data yet. */
  material: string | null;
  thicknessMm: number | null;
  flowDirection: "opposed" | "concurrent" | "quiescent" | null;
  includeAdjacent: boolean;
}

/** The materials the scenario panel offers; the server accepts nothing else. */
export const MATERIAL_OPTIONS = ["Cotton-fiberglass fabric", "Nomex", "PMMA", "Ultem", "Silicone"] as const;

export interface EnvironmentPreset {
  id: EnvironmentId;
  label: string;
  note: string;
  values: Pick<Scenario, "oxygenPct" | "pressurePsi" | "gravityG" | "airflowMs">;
  /** A NASA document that states this oxygen and pressure: an NTRS id and a checked quote id (src/data/ntrs-evidence.ts). */
  source?: { ntrsId: string; quote: string; label: string };
}

/**
 * Atmosphere presets. "Lunar habitat" follows the Space Apps challenge text (30% O2 or more at
 * 10.2 psi or less). The two exploration presets use values NASA documents state, quoted in
 * src/data/ntrs-evidence.ts. Airflow is EMBER's assumption. Mars uses an Earth-like placeholder.
 */
export const PRESETS: EnvironmentPreset[] = [
  {
    id: "iss",
    label: "ISS module",
    note: "Sea-level-like cabin air in orbit.",
    values: { oxygenPct: 21, pressurePsi: 14.7, gravityG: 0, airflowMs: 0.1 },
  },
  {
    id: "lunar-habitat",
    label: "Lunar habitat",
    note: "Exploration atmosphere expected for a Moon base.",
    values: { oxygenPct: 30, pressurePsi: 10.2, gravityG: 0.166, airflowMs: 0.05 },
  },
  {
    id: "lunar-exploration",
    label: "Exploration 8.2 psia / 34% O₂",
    note: "NASA's exploration atmosphere for EVA-heavy lunar missions, at lunar gravity.",
    values: { oxygenPct: 34, pressurePsi: 8.2, gravityG: 0.166, airflowMs: 0.05 },
    source: { ntrsId: "20150021491", quote: "eaw-8-2-34", label: "NASA exploration atmosphere evidence report" },
  },
  {
    id: "artemis-surface-habitat",
    label: "Artemis habitat 10.2 / 26.5%",
    note: "Nominal atmosphere assumed for the Artemis Surface Habitat, at lunar gravity.",
    values: { oxygenPct: 26.5, pressurePsi: 10.2, gravityG: 0.166, airflowMs: 0.05 },
    source: { ntrsId: "20220000245", quote: "artemis-sh", label: "Artemis Deep Space Habitation paper" },
  },
  {
    id: "lunar-rover",
    label: "Pressurized rover",
    note: "Assumed to share the lunar exploration atmosphere.",
    values: { oxygenPct: 30, pressurePsi: 10.2, gravityG: 0.166, airflowMs: 0.1 },
  },
  {
    id: "mars-habitat",
    label: "Mars habitat",
    note: "Earth-like placeholder atmosphere at Mars gravity.",
    values: { oxygenPct: 21, pressurePsi: 14.7, gravityG: 0.38, airflowMs: 0.05 },
  },
  {
    id: "spacesuit",
    label: "Spacesuit",
    note: "100% oxygen at 4.3 psi.",
    values: { oxygenPct: 100, pressurePsi: 4.3, gravityG: 0.166, airflowMs: 0 },
  },
  {
    id: "custom",
    label: "Custom",
    note: "Set every condition yourself.",
    values: { oxygenPct: null, pressurePsi: null, gravityG: null, airflowMs: null },
  },
];

export const EARTH_SEA_LEVEL = { oxygenPct: 20.95, pressurePsi: 14.7 } as const;

/**
 * A preset's scenario. Switching keeps the safety question, fuel and analogue setting, but
 * clears material, thickness and flow direction: presets don't set them, and carrying them
 * over made a freshly chosen preset count as edited (a live analysis, not its recorded answer).
 */
export function presetScenario(id: EnvironmentId, previous?: Scenario): Scenario {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[1];
  return {
    environment: preset.id,
    question: previous?.question ?? "prevention",
    fuel: previous?.fuel ?? "solid",
    includeAdjacent: previous?.includeAdjacent ?? true,
    material: null,
    thicknessMm: null,
    flowDirection: null,
    ...preset.values,
  };
}

export const DEFAULT_SCENARIO: Scenario = presetScenario("lunar-habitat");

/** Oxygen partial pressure in psia, or null when either input is unspecified. */
export function oxygenPartialPressure(s: Pick<Scenario, "oxygenPct" | "pressurePsi">): number | null {
  if (s.oxygenPct == null || s.pressurePsi == null) return null;
  return (s.oxygenPct / 100) * s.pressurePsi;
}

export const PSI_TO_KPA = 6.894757;
/** Oxygen partial pressure of Earth sea-level air: 20.95% of 14.7 psia, about 3.08 psia or 21.2 kPa. */
export const EARTH_PPO2_PSI = (EARTH_SEA_LEVEL.oxygenPct / 100) * EARTH_SEA_LEVEL.pressurePsi;

export interface Ppo2Comparison {
  psi: number;
  kpa: number;
  earthKpa: number;
  /** Relative difference from Earth sea level, e.g. -0.006 for 30% O2 at 10.2 psia. */
  vsEarth: number;
  /** Relative difference of the O2 fraction from Earth air, e.g. 0.43 for 30%. */
  fractionVsEarth: number;
}

/** The scenario's oxygen partial pressure in psia and kPa, against Earth sea level. */
export function ppo2VsEarth(s: Pick<Scenario, "oxygenPct" | "pressurePsi">): Ppo2Comparison | null {
  const psi = oxygenPartialPressure(s);
  if (psi == null) return null;
  return {
    psi,
    kpa: psi * PSI_TO_KPA,
    earthKpa: EARTH_PPO2_PSI * PSI_TO_KPA,
    vsEarth: psi / EARTH_PPO2_PSI - 1,
    fractionVsEarth: s.oxygenPct! / EARTH_SEA_LEVEL.oxygenPct - 1,
  };
}

/** "about the same as Earth sea level (21.2 kPa), although the oxygen fraction is 43% higher". */
export function ppo2Sentence(c: Ppo2Comparison): string {
  const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
  const earth = `Earth sea level (${c.earthKpa.toFixed(1)} kPa)`;
  const rel = Math.abs(c.vsEarth) < 0.02 ? `about the same as ${earth}` : `${pct(c.vsEarth)} ${c.vsEarth < 0 ? "below" : "above"} ${earth}`;
  const fractionUp = c.fractionVsEarth >= 0.02;
  if (fractionUp && c.vsEarth < 0.02) return `${rel}, although the oxygen fraction is ${pct(c.fractionVsEarth)} higher than Earth air`;
  return rel;
}

/** Relative change in O2 concentration versus Earth sea-level air, e.g. 0.43 for 30%. */
export function oxygenIncreaseVsEarth(oxygenPct: number | null): number | null {
  if (oxygenPct == null) return null;
  return oxygenPct / EARTH_SEA_LEVEL.oxygenPct - 1;
}

export type GravityRegime = "microgravity" | "partial" | "earth" | "unspecified";

export function gravityRegime(g: number | null): GravityRegime {
  if (g == null) return "unspecified";
  if (g <= 0.001) return "microgravity";
  if (g < 0.95) return "partial";
  return "earth";
}
