import { INVESTIGATIONS } from "../data/investigations";
import type { FuelType, Investigation } from "../data/types";

/** Oxygen span of the NASA run tables for one fuel type (ranges read from PSI tables only). */
export function tableOxygenSpan(fuel: FuelType, pool: Investigation[] = INVESTIGATIONS): { min: number; max: number; top: string } | null {
  const ranges = pool
    .filter((inv) => inv.fuelTypes.includes(fuel) && inv.conditions.oxygenPct?.source === "psi-table")
    .map((inv) => ({ name: inv.name, ...inv.conditions.oxygenPct! }));
  if (!ranges.length) return null;
  const top = ranges.reduce((a, b) => (b.max > a.max ? b : a));
  return { min: Math.min(...ranges.map((r) => r.min)), max: top.max, top: top.name };
}

/**
 * A claim the checker rejected, copied from src/data/recorded-analyses.json (Mars habitat,
 * detection). The landing page shows it as an example; a test checks it is still in the recording.
 */
export const REJECTED_EXAMPLE = {
  kind: "Measured data",
  text: "Saffire-III tested SIBAL fabric samples with a thickness of 0.33 cm in a concurrent airflow of 30 cm/s.",
  problem: "Number 0.33 not found in the cited sources, scenario or Earth reference values.",
} as const;
