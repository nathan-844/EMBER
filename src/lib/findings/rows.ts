// Compact copies of the atlas rows the findings cite, with the raw NASA cell behind every value,
// so the Findings page can show "the rows behind this" without loading the whole atlas.
import type { Atlas, AtlasRow, Quantity, TextValue } from "../atlas/types";
import type { FindingsFile } from "./types";

export interface CitedRow {
  id: string;
  /** "NASA PSI-69-0, row 12" or "NASA NTRS 20240002981, sample VI-2". */
  source: string;
  /** Where to read the source online. */
  url: string;
  material: string;
  outcome: string;
  /** Header → cell exactly as NASA wrote it, for every value the atlas read from this row. */
  cells: [string, string][];
}

const PSI_URL = (accession: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${accession}`;
const NTRS_URL = (id: string) => `https://ntrs.nasa.gov/citations/${id}`;

export function citedRow(r: AtlasRow): CitedRow {
  const vals: (Quantity | TextValue | undefined)[] = [
    r.o2Pct, r.o2PctEnd, r.burnerO2Pct, r.pressurePsi, r.flowCms, r.flowDirection, r.diluent?.n2, r.diluent?.co2, r.diluent?.he,
    ...Object.values(r.measures),
  ];
  const cells: [string, string][] = [[r.material.col, r.material.raw]];
  if (r.outcome.cell) cells.push([r.outcome.cell.col, r.outcome.cell.raw]);
  for (const v of vals) if (v && !cells.some(([c]) => c === v.col)) cells.push([v.col, v.raw]);
  const s = r.source;
  return {
    id: r.id,
    source: s.kind === "psi" ? `NASA ${s.table}, row ${s.sourceRow}` : `NASA NTRS ${s.ntrsId}, sample ${s.sample}`,
    url: s.kind === "psi" ? PSI_URL(s.accession) : NTRS_URL(s.ntrsId),
    material: r.material.name ? `${r.material.name}${r.material.basis === "inferred" ? " (inferred)" : ""}` : "not named in NASA's table",
    outcome: r.outcome.value,
    cells: cells.map(([c, v]) => [c.replace(/\s+/g, " ").trim().replace(/^\?-g/, "µ-g"), v.trim()]),
  };
}

/** Every row any finding cites, keyed by atlas id. */
export function citedRows(atlas: Atlas, findings: FindingsFile): Record<string, CitedRow> {
  const byId = new Map(atlas.rows.map((r) => [r.id, r]));
  const out: Record<string, CitedRow> = {};
  for (const f of findings.findings) for (const id of f.rows) out[id] ??= citedRow(byId.get(id)!);
  return out;
}
