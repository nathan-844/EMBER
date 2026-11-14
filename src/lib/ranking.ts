import { INVESTIGATIONS } from "../data/investigations";
import type { ConditionEnvelope, Investigation, Range } from "../data/types";
import type { Scenario } from "./scenario";

export const QUESTION_POINTS = { direct: 25, adjacent: 10 } as const;
export const CONDITION_POINTS = 15;
export const CONDITION_KEYS = ["oxygenPct", "pressurePsi", "gravityG", "airflowMs", "fuel"] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];
export const MAX_CONDITION_POINTS = CONDITION_POINTS * CONDITION_KEYS.length; // 75

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  oxygenPct: "Oxygen",
  pressurePsi: "Pressure",
  gravityG: "Gravity",
  airflowMs: "Airflow",
  fuel: "Fuel type",
};

/**
 * match       – scenario value lies inside the profile's range
 * outside     – profile has a range and the scenario value is outside it
 * unknown     – profile has no normalized range for this condition (earns nothing)
 * unspecified – the user left this input unspecified (earns nothing)
 */
export type ConditionStatus = "match" | "outside" | "unknown" | "unspecified";

export interface ConditionResult {
  key: ConditionKey;
  status: ConditionStatus;
  points: number;
  range: Range | null;
}

export interface RankedInvestigation {
  investigation: Investigation;
  rank: number;
  tied: boolean;
  total: number;
  questionPoints: number;
  relevance: "direct" | "adjacent";
  conditionPoints: number;
  conditions: ConditionResult[];
  specifiedCount: number;
  matchedCount: number;
}

export function inRange(value: number, range: Range): boolean {
  return value >= range.min && value <= range.max;
}

/** Point scheme. The default is the disclosed 25 + 5 × 15 scheme; alternatives exist only to probe sensitivity. */
export interface Weights {
  question: { direct: number; adjacent: number };
  conditions: Record<ConditionKey, number>;
}

export const DEFAULT_WEIGHTS: Weights = {
  question: QUESTION_POINTS,
  conditions: { oxygenPct: CONDITION_POINTS, pressurePsi: CONDITION_POINTS, gravityG: CONDITION_POINTS, airflowMs: CONDITION_POINTS, fuel: CONDITION_POINTS },
};

function scoreCondition(inv: Investigation, scenario: Scenario, key: ConditionKey, w: Weights = DEFAULT_WEIGHTS): ConditionResult {
  const pts = w.conditions[key];
  if (key === "fuel") {
    if (scenario.fuel == null) return { key, status: "unspecified", points: 0, range: null };
    if (inv.fuelTypes.length === 0) return { key, status: "unknown", points: 0, range: null };
    const ok = inv.fuelTypes.includes(scenario.fuel);
    return { key, status: ok ? "match" : "outside", points: ok ? pts : 0, range: null };
  }
  const value = scenario[key];
  const range = inv.conditions[key as keyof ConditionEnvelope];
  if (value == null) return { key, status: "unspecified", points: 0, range };
  if (range == null) return { key, status: "unknown", points: 0, range: null };
  const ok = inRange(value, range);
  return { key, status: ok ? "match" : "outside", points: ok ? pts : 0, range };
}

export function scoreInvestigation(inv: Investigation, scenario: Scenario, w: Weights = DEFAULT_WEIGHTS): Omit<RankedInvestigation, "rank" | "tied"> | null {
  let relevance: "direct" | "adjacent";
  if (inv.questions.includes(scenario.question)) relevance = "direct";
  else if (scenario.includeAdjacent && inv.adjacentQuestions.includes(scenario.question)) relevance = "adjacent";
  else return null;

  const conditions = CONDITION_KEYS.map((k) => scoreCondition(inv, scenario, k, w));
  const conditionPoints = conditions.reduce((sum, c) => sum + c.points, 0);
  const questionPoints = w.question[relevance];
  return {
    investigation: inv,
    relevance,
    questionPoints,
    conditionPoints,
    total: questionPoints + conditionPoints,
    conditions,
    specifiedCount: conditions.filter((c) => c.status !== "unspecified").length,
    matchedCount: conditions.filter((c) => c.status === "match").length,
  };
}

/** Rank investigations for a scenario. Equal scores share a rank (competition ranking). */
export function rankInvestigations(scenario: Scenario, pool: Investigation[] = INVESTIGATIONS, w: Weights = DEFAULT_WEIGHTS): RankedInvestigation[] {
  const scored = pool
    .map((inv) => scoreInvestigation(inv, scenario, w))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.total - a.total || a.investigation.name.localeCompare(b.investigation.name));

  return scored.map((r) => {
    const rank = scored.findIndex((o) => o.total === r.total) + 1;
    const tied = scored.filter((o) => o.total === r.total).length > 1;
    return { ...r, rank, tied };
  });
}

export function rankLabel(r: Pick<RankedInvestigation, "rank" | "tied">): string {
  return `${r.tied ? "T" : ""}${String(r.rank).padStart(2, "0")}`;
}

/** How many profiles carry any normalized oxygen, pressure or airflow range. */
export function profilesWithNormalizedConditions(pool: Investigation[] = INVESTIGATIONS): number {
  return pool.filter((inv) => inv.conditions.oxygenPct || inv.conditions.pressurePsi || inv.conditions.airflowMs).length;
}
