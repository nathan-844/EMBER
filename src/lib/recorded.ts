import type { Scenario } from "./scenario";

/**
 * Stable key for a scenario: only the fields that change the ranking or the evidence
 * package, in a fixed order. Used to replay recorded analyses when no API key is set.
 */
export function scenarioKey(s: Scenario): string {
  return JSON.stringify([
    s.environment,
    s.question,
    s.oxygenPct,
    s.pressurePsi,
    s.gravityG,
    s.airflowMs,
    s.fuel,
    s.material,
    s.thicknessMm,
    s.flowDirection,
    s.includeAdjacent,
  ]);
}
