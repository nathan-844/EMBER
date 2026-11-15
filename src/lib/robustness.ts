import { INVESTIGATIONS } from "../data/investigations";
import { CONDITION_KEYS, CONDITION_LABELS, DEFAULT_WEIGHTS, rankInvestigations, type ConditionKey, type Weights } from "./ranking";
import type { Scenario } from "./scenario";

type NumericKey = Exclude<ConditionKey, "fuel">;

/** Small perturbation steps, sized to typical uncertainty in a design atmosphere. */
export const PROBE_STEPS: Record<NumericKey, number> = {
  oxygenPct: 2,
  pressurePsi: 0.5,
  gravityG: 0.05,
  airflowMs: 0.02,
};

export interface Probe {
  kind: "change" | "removal";
  key: ConditionKey;
  label: string;
  leadAfter: string | null;
  unchanged: boolean;
}

/**
 * Alternative point schemes. None is "right": the default weights were chosen, not
 * fitted, so the app shows whether the top match depends on that choice.
 */
export const WEIGHT_SCHEMES: { id: string; label: string; weights: Weights }[] = [
  {
    id: "oxygen-gravity",
    label: "Oxygen and gravity weighted (O₂ 25, g 20, others 10)",
    weights: { question: DEFAULT_WEIGHTS.question, conditions: { oxygenPct: 25, gravityG: 20, pressurePsi: 10, airflowMs: 10, fuel: 10 } },
  },
  {
    id: "gravity-first",
    label: "Gravity first (g 35, others 10)",
    weights: { question: DEFAULT_WEIGHTS.question, conditions: { gravityG: 35, oxygenPct: 10, pressurePsi: 10, airflowMs: 10, fuel: 10 } },
  },
  {
    id: "fuel-first",
    label: "Fuel type first (fuel 35, others 10)",
    weights: { question: DEFAULT_WEIGHTS.question, conditions: { fuel: 35, oxygenPct: 10, pressurePsi: 10, gravityG: 10, airflowMs: 10 } },
  },
  {
    id: "adjacent-equal",
    label: "Direct and adjacent research scored equally",
    weights: { question: { direct: 25, adjacent: 25 }, conditions: DEFAULT_WEIGHTS.conditions },
  },
];

export interface WeightProbe {
  id: string;
  label: string;
  leadAfter: string | null;
  unchanged: boolean;
}

export interface RobustnessReport {
  lead: string | null;
  probes: Probe[];
  changesHeld: number;
  changesTotal: number;
  removalsHeld: number;
  removalsTotal: number;
  dependsOn: ConditionKey[];
  weightProbes: WeightProbe[];
  weightsHeld: number;
}

function leadIds(s: Scenario, w: Weights = DEFAULT_WEIGHTS): string[] {
  const ranked = rankInvestigations(s, INVESTIGATIONS, w);
  return ranked.filter((r) => r.rank === 1).map((r) => r.investigation.id);
}

/**
 * Re-rank under small input changes and single-input removals. The lead is
 * "unchanged" if it still shares first place. This probes the ranking rule
 * near your inputs, not the underlying experiments.
 */
export function probeRobustness(scenario: Scenario): RobustnessReport {
  const baseLeads = leadIds(scenario);
  const lead = baseLeads[0] ?? null;
  const probes: Probe[] = [];

  const run = (kind: Probe["kind"], key: ConditionKey, label: string, s: Scenario) => {
    const after = leadIds(s);
    probes.push({ kind, key, label, leadAfter: after[0] ?? null, unchanged: lead != null && after.includes(lead) });
  };

  for (const key of Object.keys(PROBE_STEPS) as NumericKey[]) {
    const v = scenario[key];
    if (v == null) continue;
    for (const sign of [-1, 1]) {
      const next = Math.max(0, +(v + sign * PROBE_STEPS[key]).toFixed(4));
      run("change", key, `${CONDITION_LABELS[key]} ${sign > 0 ? "+" : "−"}${PROBE_STEPS[key]}`, { ...scenario, [key]: next });
    }
  }

  for (const key of CONDITION_KEYS) {
    if (scenario[key] == null) continue;
    run("removal", key, `Remove ${CONDITION_LABELS[key].toLowerCase()}`, { ...scenario, [key]: null });
  }

  const weightProbes: WeightProbe[] = WEIGHT_SCHEMES.map((scheme) => {
    const after = leadIds(scenario, scheme.weights);
    return { id: scheme.id, label: scheme.label, leadAfter: after[0] ?? null, unchanged: lead != null && after.includes(lead) };
  });

  const changes = probes.filter((p) => p.kind === "change");
  const removals = probes.filter((p) => p.kind === "removal");
  return {
    lead,
    probes,
    changesHeld: changes.filter((p) => p.unchanged).length,
    changesTotal: changes.length,
    removalsHeld: removals.filter((p) => p.unchanged).length,
    removalsTotal: removals.length,
    dependsOn: removals.filter((p) => !p.unchanged).map((p) => p.key),
    weightProbes,
    weightsHeld: weightProbes.filter((p) => p.unchanged).length,
  };
}

/** How far each point weight is moved when testing rank stability: ±20%. */
export const WEIGHT_SWING = 0.2;

export interface RankRange {
  /** Rank with the disclosed default weights. */
  base: number;
  /** Best and worst rank across every weight combination tried. */
  min: number;
  max: number;
  /** Number of weight combinations tried. */
  combos: number;
}

/**
 * Every corner of the box where each of the seven point weights (direct and adjacent question
 * points, and the five condition points) is independently its default × (1 − swing) or × (1 + swing),
 * 2⁷ = 128 combinations, plus the defaults. Reports each investigation's best and worst rank. This
 * tests the scoring rule's sensitivity to its chosen weights, not the experiments.
 */
export function rankStability(scenario: Scenario, swing = WEIGHT_SWING): Map<string, RankRange> {
  const d = DEFAULT_WEIGHTS;
  const factors = 2 + CONDITION_KEYS.length;
  const out = new Map<string, RankRange>();
  for (const r of rankInvestigations(scenario)) out.set(r.investigation.id, { base: r.rank, min: r.rank, max: r.rank, combos: 1 });
  for (let mask = 0; mask < 1 << factors; mask++) {
    const f = (bit: number) => (mask & (1 << bit) ? 1 + swing : 1 - swing);
    const w: Weights = {
      question: { direct: d.question.direct * f(0), adjacent: d.question.adjacent * f(1) },
      conditions: Object.fromEntries(CONDITION_KEYS.map((k, i) => [k, d.conditions[k] * f(2 + i)])) as Weights["conditions"],
    };
    for (const r of rankInvestigations(scenario, INVESTIGATIONS, w)) {
      const cur = out.get(r.investigation.id);
      if (!cur) continue;
      cur.min = Math.min(cur.min, r.rank);
      cur.max = Math.max(cur.max, r.rank);
      cur.combos++;
    }
  }
  return out;
}

/** "Stays rank 2 if weights move ±20%" or "Rank 1–3 if weights move ±20%". */
export function rankRangeLabel(r: RankRange, swing = WEIGHT_SWING): string {
  const pct = Math.round(swing * 100);
  return r.min === r.max ? `Stays rank ${r.min} if weights move ±${pct}%` : `Rank ${r.min}–${r.max} if weights move ±${pct}%`;
}
