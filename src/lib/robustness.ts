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
