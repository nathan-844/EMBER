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
 * near        – just outside the range, within NEAR_TOLERANCE (earns NEAR_FRACTION of the points)
 * outside     – profile has a range and the scenario value is further outside it
 * unknown     – profile has no normalized range for this condition (earns nothing)
 * unspecified – the user left this input unspecified (earns nothing)
 */
export type ConditionStatus = "match" | "near" | "outside" | "unknown" | "unspecified";

/**
 * How far outside a recorded range still counts as "near": one small-change probe step for
 * oxygen, pressure and airflow. Gravity has no near band: microgravity is not partial gravity.
 */
export const NEAR_TOLERANCE: Record<Exclude<ConditionKey, "fuel">, number> = {
  oxygenPct: 1,
  pressurePsi: 0.5,
  gravityG: 0,
  airflowMs: 0.02,
};
/** A near value earns 8 of 15 points (rounded share of the condition's weight). */
export const NEAR_FRACTION = 8 / 15;

export interface ConditionResult {
  key: ConditionKey;
  status: ConditionStatus;
  points: number;
  range: Range | null;
  /** For near/outside: the closest tested value and how far the scenario is from it. */
  nearest?: number;
  distance?: number;
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
  nearCount: number;
  unknownCount: number;
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
  if (inRange(value, range)) return { key, status: "match", points: pts, range };
  const nearest = value < range.min ? range.min : range.max;
  const distance = +Math.abs(value - nearest).toFixed(4);
  const near = distance <= NEAR_TOLERANCE[key as Exclude<ConditionKey, "fuel">];
  return { key, status: near ? "near" : "outside", points: near ? Math.round(pts * NEAR_FRACTION) : 0, range, nearest, distance };
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
    nearCount: conditions.filter((c) => c.status === "near").length,
    unknownCount: conditions.filter((c) => c.status === "unknown").length,
  };
}

const fuelMatches = (r: Omit<RankedInvestigation, "rank" | "tied">) => r.conditions.find((c) => c.key === "fuel")?.status === "match";

/**
 * Order within equal scores (they still share a rank): matching fuel first, then direct
 * research, then more matched conditions, then fewer missing ranges, then name. Missing
 * data never wins a tie-break.
 */
function tieBreak(a: Omit<RankedInvestigation, "rank" | "tied">, b: Omit<RankedInvestigation, "rank" | "tied">): number {
  return (
    Number(fuelMatches(b)) - Number(fuelMatches(a)) ||
    Number(b.relevance === "direct") - Number(a.relevance === "direct") ||
    b.matchedCount - a.matchedCount ||
    a.unknownCount - b.unknownCount ||
    a.investigation.name.localeCompare(b.investigation.name)
  );
}

/** Rank investigations for a scenario. Equal scores share a rank (competition ranking). */
export function rankInvestigations(scenario: Scenario, pool: Investigation[] = INVESTIGATIONS, w: Weights = DEFAULT_WEIGHTS): RankedInvestigation[] {
  const scored = pool
    .map((inv) => scoreInvestigation(inv, scenario, w))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.total - a.total || tieBreak(a, b));

  // Equal scores share a rank only with the same fuel match: a droplet or gas study never
  // ties for first with a matching-fuel study.
  const same = (a: (typeof scored)[number], b: (typeof scored)[number]) => a.total === b.total && fuelMatches(a) === fuelMatches(b);
  return scored.map((r) => {
    const rank = scored.findIndex((o) => same(o, r)) + 1;
    const tied = scored.filter((o) => same(o, r)).length > 1;
    return { ...r, rank, tied };
  });
}

/** "13.6–22.2" or, for a single tested value, "0.3". */
export function rangeLabel(r: Pick<Range, "min" | "max">, unit = ""): string {
  return `${r.min === r.max ? r.min : `${r.min}–${r.max}`}${unit}`;
}

export function rankLabel(r: Pick<RankedInvestigation, "rank" | "tied">): string {
  return `${r.tied ? "T" : ""}${String(r.rank).padStart(2, "0")}`;
}

/** How many profiles carry any normalized oxygen, pressure or airflow range. */
export function profilesWithNormalizedConditions(pool: Investigation[] = INVESTIGATIONS): number {
  return pool.filter((inv) => inv.conditions.oxygenPct || inv.conditions.pressurePsi || inv.conditions.airflowMs).length;
}
