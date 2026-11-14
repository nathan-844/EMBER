import type { RankedInvestigation } from "./ranking";

export interface RankShift {
  id: string;
  name: string;
  before: number | null;
  after: number | null;
  delta: number;
}

/** Score changes between a saved baseline ranking and the current one. */
export function compareRankings(baseline: RankedInvestigation[], current: RankedInvestigation[]): RankShift[] {
  const ids = new Set([...baseline, ...current].map((r) => r.investigation.id));
  const shifts: RankShift[] = [];
  for (const id of ids) {
    const b = baseline.find((r) => r.investigation.id === id);
    const c = current.find((r) => r.investigation.id === id);
    const name = (b ?? c)!.investigation.name;
    const delta = (c?.total ?? 0) - (b?.total ?? 0);
    if (delta !== 0 || !b !== !c) shifts.push({ id, name, before: b?.total ?? null, after: c?.total ?? null, delta });
  }
  return shifts.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}
