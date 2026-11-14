import type { FuelType, SafetyQuestion } from "../data/types";

export type EnvironmentId = "iss" | "lunar-habitat" | "lunar-rover" | "mars-habitat" | "spacesuit" | "custom";

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

export interface EnvironmentPreset {
  id: EnvironmentId;
  label: string;
  note: string;
  values: Pick<Scenario, "oxygenPct" | "pressurePsi" | "gravityG" | "airflowMs">;
}

/**
 * Illustrative atmosphere presets. Lunar values follow the Space Apps challenge
 * text (30% O2 or more at 10.2 psi or less). Mars uses an Earth-like placeholder.
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

export function presetScenario(id: EnvironmentId, previous?: Scenario): Scenario {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[1];
  return {
    environment: preset.id,
    question: previous?.question ?? "prevention",
    fuel: previous?.fuel ?? "solid",
    includeAdjacent: previous?.includeAdjacent ?? true,
    material: previous?.material ?? null,
    thicknessMm: previous?.thicknessMm ?? null,
    flowDirection: previous?.flowDirection ?? null,
    ...preset.values,
  };
}

export const DEFAULT_SCENARIO: Scenario = presetScenario("lunar-habitat");

/** Oxygen partial pressure in psia, or null when either input is unspecified. */
export function oxygenPartialPressure(s: Pick<Scenario, "oxygenPct" | "pressurePsi">): number | null {
  if (s.oxygenPct == null || s.pressurePsi == null) return null;
  return (s.oxygenPct / 100) * s.pressurePsi;
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
