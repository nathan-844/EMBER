// Joint coverage: how many individual NASA tests sit near a scenario's oxygen AND pressure together,
// counted from Fire Test Atlas rows. The ranking's ranges are min–max envelopes per condition; this
// counts actual test points instead. It selects evidence; it predicts nothing.
import type { CompactRow } from "./atlas/compact";
import type { FuelClass, Outcome } from "./atlas/types";
import type { Scenario } from "./scenario";

/** A test is "near" when it is within these of the scenario. Chosen, not fitted; shown in the app. */
export const NEAR_WINDOW = { oxygenPct: 5, pressurePsi: 2.5 } as const;

export interface NearbyGroup {
  fuel: FuelClass;
  /** Tests that record oxygen (the only ones that can be placed). */
  placed: number;
  /** Within the oxygen and pressure windows, both recorded. */
  joint: CompactRow[];
  /** Within the oxygen window, but the table records no pressure. */
  oxygenOnly: CompactRow[];
  /** Outcome counts of the joint tests. */
  outcomes: Partial<Record<Outcome, number>>;
  /** The closest test that records both, with its scaled distance (1 = the edge of the window). */
  nearest: { row: CompactRow; distance: number } | null;
}

export interface Nearby {
  /** False when the scenario has no pressure: only the oxygen window applies. */
  usesPressure: boolean;
  groups: NearbyGroup[];
  totalJoint: number;
}

const FUELS: FuelClass[] = ["solid", "liquid", "gas"];

type Placed = Pick<CompactRow, "o2" | "o2Span" | "psi" | "psiSpan">;

/** The oxygen a row records as an interval: one value, or the span of a range. Null when not recorded. */
export const o2Interval = (r: Pick<CompactRow, "o2" | "o2Span">): [number, number] | null => (r.o2 !== null ? [r.o2, r.o2] : r.o2Span ?? null);
const psiInterval = (r: Pick<CompactRow, "psi" | "psiSpan">): [number, number] | null => (r.psi !== null ? [r.psi, r.psi] : r.psiSpan ?? null);
/** How far the farthest point of an interval is from a value: a range is never credited with its nearest end. */
const farthest = ([lo, hi]: [number, number], x: number) => Math.max(Math.abs(lo - x), Math.abs(hi - x));

/**
 * Scaled distance from a scenario (1 = the edge of the window). A row that records a range is
 * placed by the end of the range farthest from the scenario, so it counts as near only when the
 * whole range is.
 */
export function scaledDistance(row: Placed, s: Pick<Scenario, "oxygenPct" | "pressurePsi">): number | null {
  const o = o2Interval(row);
  if (o === null || s.oxygenPct === null) return null;
  const dO = farthest(o, s.oxygenPct) / NEAR_WINDOW.oxygenPct;
  if (s.pressurePsi === null) return dO;
  const p = psiInterval(row);
  if (p === null) return null;
  return Math.hypot(dO, farthest(p, s.pressurePsi) / NEAR_WINDOW.pressurePsi);
}

/** Null when the scenario has no oxygen level: nothing can be placed. */
export function nearbyTests(rows: CompactRow[], s: Pick<Scenario, "oxygenPct" | "pressurePsi">): Nearby | null {
  if (s.oxygenPct === null) return null;
  const usesPressure = s.pressurePsi !== null;
  const tests = rows.filter((r) => r.kind === "test" && o2Interval(r) !== null);
  const groups = FUELS.map((fuel): NearbyGroup => {
    const mine = tests.filter((r) => r.fuel === fuel);
    const inO2 = mine.filter((r) => farthest(o2Interval(r)!, s.oxygenPct!) <= NEAR_WINDOW.oxygenPct);
    const joint = usesPressure ? inO2.filter((r) => psiInterval(r) !== null && farthest(psiInterval(r)!, s.pressurePsi!) <= NEAR_WINDOW.pressurePsi) : inO2;
    const oxygenOnly = usesPressure ? inO2.filter((r) => psiInterval(r) === null) : [];
    const outcomes: Partial<Record<Outcome, number>> = {};
    for (const r of joint) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    let nearest: NearbyGroup["nearest"] = null;
    for (const r of mine) {
      const d = scaledDistance(r, s);
      if (d !== null && (!nearest || d < nearest.distance)) nearest = { row: r, distance: d };
    }
    if (nearest) nearest = { row: nearest.row, distance: Number(nearest.distance.toFixed(2)) };
    return { fuel, placed: mine.length, joint, oxygenOnly, outcomes, nearest };
  });
  return { usesPressure, groups, totalJoint: groups.reduce((n, g) => n + g.joint.length, 0) };
}
