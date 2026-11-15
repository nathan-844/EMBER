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
  /** Reviewed experiment id; rows sharing it observe the same run. Absent: the row is its own experiment. */
  experiment?: string;
  fuel: FuelClass | null;
  material: string;
  /** Ambient oxygen (%) when the cell gives one value. Null when not recorded or when it gives several (see o2Span). */
  o2: number | null;
  /** Lowest and highest value when the cell gives a range, a start-to-end drift or a list. Never one exact value. */
  o2Span?: [number, number];
  psi: number | null;
  psiSpan?: [number, number];
  flowCms: number | null;
  flowSpan?: [number, number];
  outcome: Outcome;
  flags: string[];
  cells: [string, string][];
}

type Q = { v: number | null; values?: number[] } | undefined;
/** The single value, at full precision: rounding is for display only and never decides a match. */
const one = (q: Q) => (typeof q?.v === "number" ? q.v : null);
const span = (q: Q): [number, number] | undefined => (q?.values?.length ? [Math.min(...q.values), Math.max(...q.values)] : undefined);

export function compactAtlas(atlas: Atlas): CompactRow[] {
  return atlas.rows.map((r) => {
    const c = citedRow(r);
    const valueFlags = [r.o2Pct, r.o2PctEnd, r.burnerO2Pct, r.pressurePsi, r.flowCms, ...Object.values(r.measures), ...Object.values(r.diluent ?? {})].flatMap((q) => q?.flags ?? []);
    const o2Span = span(r.o2Pct), psiSpan = span(r.pressurePsi), flowSpan = span(r.flowCms);
    return {
      id: r.id, source: c.source, url: c.url, investigation: r.investigation, kind: r.rowKind,
      ...(r.rowKindReason ? { kindReason: r.rowKindReason } : {}),
      ...(r.experiment ? { experiment: r.experiment.id } : {}),
      fuel: r.fuelClass, material: c.material,
      o2: one(r.o2Pct), ...(o2Span ? { o2Span } : {}),
      psi: one(r.pressurePsi), ...(psiSpan ? { psiSpan } : {}),
      flowCms: one(r.flowCms), ...(flowSpan ? { flowSpan } : {}),
      outcome: r.outcome.value, flags: [...new Set([...r.flags, ...valueFlags])].sort(), cells: c.cells,
    };
  });
}
