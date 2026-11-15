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
/**
 * A near value earns two thirds of what a value inside the range earns: 10 of 15 for a NASA
 * run-table range, 7 of 10 for a curated estimate. So a value just outside measured data is worth
 * as much as one inside an estimate, and measured data never loses to an estimate by a near miss.
 */
export const NEAR_FRACTION = 2 / 3;
/**
 * A range EMBER estimated (curated) rather than read from a NASA run table earns two thirds of
 * the points: 10 instead of 15 inside it, 7 instead of 10 just outside it.
 */
export const CURATED_FRACTION = 2 / 3;

/**
 * Fuel group. With a fuel type set, studies of that fuel ("same") are listed before studies of
 * other or no fuel ("other"), which are analogue evidence. With no fuel set, all are "all".
 */
export type FuelGroup = "same" | "other" | "all";

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
  /** Ranks and ties are counted within a fuel group; "same" is always listed first. */
  group: FuelGroup;
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

/**
 * Point scheme. The default is the disclosed 25 + 5 × 15 scheme (curated ranges earn two thirds);
 * alternatives exist only to probe sensitivity.
 */
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
    // A burner built to emulate this fuel (BRE: gas emulating solids) is a partial match.
    if (!ok && inv.emulates === scenario.fuel) return { key, status: "near", points: Math.round(pts * NEAR_FRACTION), range: null };
    return { key, status: ok ? "match" : "outside", points: ok ? pts : 0, range: null };
  }
  const value = scenario[key];
  const range = inv.conditions[key as keyof ConditionEnvelope];
  if (value == null) return { key, status: "unspecified", points: 0, range };
  if (range == null) return { key, status: "unknown", points: 0, range: null };
  const full = range.source === "psi-table" ? pts : Math.round(pts * CURATED_FRACTION);
  if (inRange(value, range)) return { key, status: "match", points: full, range };
  const nearest = value < range.min ? range.min : range.max;
  const distance = +Math.abs(value - nearest).toFixed(4);
  const near = distance <= NEAR_TOLERANCE[key as Exclude<ConditionKey, "fuel">];
  return { key, status: near ? "near" : "outside", points: near ? Math.round(full * NEAR_FRACTION) : 0, range, nearest, distance };
}

export function scoreInvestigation(inv: Investigation, scenario: Scenario, w: Weights = DEFAULT_WEIGHTS): Omit<RankedInvestigation, "rank" | "tied" | "group"> | null {
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

type Scored = Omit<RankedInvestigation, "rank" | "tied">;

const GROUP_ORDER: Record<FuelGroup, number> = { same: 0, all: 0, other: 1 };

function fuelGroup(r: Omit<Scored, "group">, scenario: Scenario): FuelGroup {
  if (scenario.fuel == null) return "all";
  const fuel = r.conditions.find((c) => c.key === "fuel")?.status;
  // An emulator of the scenario's fuel is listed with that fuel's studies, labelled as an emulator.
  return fuel === "match" || fuel === "near" ? "same" : "other";
}

/** Conditions inside or just outside a range read from a NASA run table. */
const measured = (r: Scored) => r.conditions.filter((c) => (c.status === "match" || c.status === "near") && c.range?.source === "psi-table").length;

/**
 * Order within equal scores (they still share a rank): direct research first, then more
 * conditions backed by NASA run-table data, then more matched conditions, then fewer missing
 * ranges, then name. Missing or estimated data never wins a tie-break over measured data.
 */
function tieBreak(a: Scored, b: Scored): number {
  return (
    Number(b.relevance === "direct") - Number(a.relevance === "direct") ||
    measured(b) - measured(a) ||
    b.matchedCount - a.matchedCount ||
    a.unknownCount - b.unknownCount ||
    a.investigation.name.localeCompare(b.investigation.name)
  );
}

/**
 * Rank investigations for a scenario.
 *
 * Fuel type is a grouping, not just points: with a fuel set, every study of that fuel is listed
 * before any study of another fuel, whatever their scores. A droplet or gas-flame study at the
 * right oxygen is analogue evidence for a solid-material fire, not a better match than a
 * solid-material study at the wrong oxygen. (This extends the earlier rule that equal scores share
 * a rank only with the same fuel match.) Within a group, equal scores share a rank.
 */
export function rankInvestigations(scenario: Scenario, pool: Investigation[] = INVESTIGATIONS, w: Weights = DEFAULT_WEIGHTS): RankedInvestigation[] {
  const scored: Scored[] = pool
    .map((inv) => scoreInvestigation(inv, scenario, w))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, group: fuelGroup(r, scenario) }))
    .sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || b.total - a.total || tieBreak(a, b));

  const same = (a: Scored, b: Scored) => a.total === b.total && a.group === b.group;
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
