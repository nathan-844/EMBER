// A compact copy of the atlas for the browser (src/data/atlas/atlas-rows.json): the fields the
// Data page filters on and the scenario lab measures distance with, plus NASA's raw cells.
// The full atlas.json (with per-value flags and units) stays out of the app bundle.
import { citedRow } from "../findings/rows";
import type { Atlas, FuelClass, Outcome, RowKind } from "./types";

export interface CompactRow {
  id: string;
  source: string;
  url: string;
  investigation: string;
  kind: RowKind;
  kindReason?: string;
  fuel: FuelClass | null;
  material: string;
  /** Ambient oxygen (%): the single value, or the top of a listed range. Null when not recorded. */
  o2: number | null;
  psi: number | null;
  flowCms: number | null;
  outcome: Outcome;
  flags: string[];
  cells: [string, string][];
}

const top = (q?: { v: number | null; values?: number[] }) => (typeof q?.v === "number" ? q.v : q?.values?.length ? Math.max(...q.values) : null);
const r2 = (v: number | null) => (v === null ? null : Number(v.toFixed(2)));

export function compactAtlas(atlas: Atlas): CompactRow[] {
  return atlas.rows.map((r) => {
    const c = citedRow(r);
    const valueFlags = [r.o2Pct, r.o2PctEnd, r.burnerO2Pct, r.pressurePsi, r.flowCms, ...Object.values(r.measures), ...Object.values(r.diluent ?? {})].flatMap((q) => q?.flags ?? []);
    return {
      id: r.id, source: c.source, url: c.url, investigation: r.investigation, kind: r.rowKind,
      ...(r.rowKindReason ? { kindReason: r.rowKindReason } : {}),
      fuel: r.fuelClass, material: c.material, o2: r2(top(r.o2Pct)), psi: r2(top(r.pressurePsi)), flowCms: r2(top(r.flowCms)),
      outcome: r.outcome.value, flags: [...new Set([...r.flags, ...valueFlags])].sort(), cells: c.cells,
    };
  });
}
