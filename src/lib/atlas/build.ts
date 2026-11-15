// Builds the EMBER Fire Test Atlas from the stored NASA tables and the NTRS Saffire IV–VI runs.
// Pure: takes the tables and returns the atlas, so tests can rebuild it and compare with the
// committed file. scripts/build-atlas.ts writes the result to src/data/atlas/.
import { cellValues } from "../cells";
import { SAFFIRE_NTRS_RUNS, SAFFIRE_NTRS_SOURCE } from "../../data/ntrs-saffire";
import { normaliseMaterial } from "./materials";
import { SPECS, type QSpec, type TSpec, type TableSpec } from "./specs";
import type { Atlas, AtlasRow, Quantity, RowKind, TextValue } from "./types";

export const ATLAS_VERSION = "atlas-v1";

export interface TableIn {
  header: string[];
  rows: { sourceRow: number; cells: string[] }[];
}
export interface ManifestIn {
  syncedOn: string;
  tables: { id: string; accession: string; sha256: string; rows: number }[];
}

const norm = (h: string) => h.replace(/\s+/g, " ").trim();

const LIMITS: Record<string, (v: number) => boolean> = {
  "%": (v) => v > 0 && v <= 100,
  psia: (v) => v > 0 && v < 200,
  "cm/s": (v) => v >= 0 && v < 1000,
};

/** Cells that mean "no measurement": NASA's dash, "none", "n/a", or a character lost in export. */
const NO_VALUE = /^(�+|[–—-]|none|n\/a|na)$/i;
/** Cells that say the reading was off the scale. */
const CENSORED = /^(>\s*\d+(\.\d+)?|or|over)$/i;

/** Length units a cell may state itself, in mm. */
const LENGTH_MM: Record<string, number> = { mm: 1, cm: 10 };

/**
 * A cell that states its own unit ("80 W", "145 s", "1 cm"): the number in the spec's unit, or
 * null with a flag when the stated unit cannot be converted. Undefined when the cell has no unit.
 */
function ownUnit(text: string, spec: QSpec): { values: number[]; flag?: string } | undefined {
  const m = /^\s*~?\s*(\d*\.?\d+)\s*(w|s|mm|cm)\s*$/i.exec(text);
  if (!m) return undefined;
  const unit = m[2].toLowerCase();
  const target = spec.from.toLowerCase();
  if (unit === target) return { values: [Number(m[1])] };
  if (LENGTH_MM[unit] && LENGTH_MM[target]) return { values: [+(Number(m[1]) * (LENGTH_MM[unit] / LENGTH_MM[target])).toPrecision(10)], flag: "cell-unit-converted" };
  return { values: [], flag: "unit-mismatch" };
}

/** Read one cell into a quantity. Unit conversion only uses the spec's stated source unit. */
export function readQuantity(spec: QSpec, raw: string): Quantity | undefined {
  const text = raw ?? "";
  if (!text.trim() || NO_VALUE.test(text.trim())) return undefined;
  const q: Quantity = { col: spec.col, raw: text, v: null, unit: spec.unit };
  const flags = [...(spec.flags ?? [])];
  if (/~/.test(text)) q.approx = true;
  const neg = /^\s*-(\d*\.?\d+)\s*$/.exec(text);
  const own = ownUnit(text, spec);
  let values: number[];
  if (CENSORED.test(text.trim())) {
    values = [];
    flags.push("censored");
  } else if (/^\s*ramp(ed)?\s*$/i.test(text)) {
    values = [];
    flags.push("ramped");
  } else if (/^#/.test(text.trim())) {
    values = [];
    flags.push("spreadsheet-error");
  } else if (neg) {
    values = [-Number(neg[1])];
    flags.push("negative-reading");
  } else if (/(^|[^\d.])0\d/.test(text)) {
    values = [];
    flags.push("leading-zero");
  } else if (spec.zeroIsMissing && /^\s*0(\.0+)?\s*$/.test(text)) {
    values = [];
    flags.push("zero-placeholder");
  } else if (own) {
    values = own.values;
    if (own.flag) flags.push(own.flag);
  } else {
    values = cellValues(text, spec.parser ?? "parseCell");
    if (!values.length) flags.push("not-numeric");
  }
  const factor = spec.factor ?? 1;
  const converted = values.map((v) => +(v * factor).toPrecision(10));
  const limit = LIMITS[spec.unit];
  const ok = limit ? converted.filter(limit) : converted;
  if (ok.length < converted.length) flags.push("out-of-range");
  if (ok.length === 1) q.v = ok[0];
  if (ok.length > 1) {
    q.values = ok;
    q.shape = multiShape(text);
  }
  if (flags.length) q.flags = [...new Set(flags)];
  const status = quantityStatus(q, factor);
  if (status) q.status = status;
  return q;
}

/** What a cell with several numbers means, from how NASA wrote it. */
export function multiShape(text: string): NonNullable<Quantity["shape"]> {
  if (/\d\s+to\s+\d/i.test(text)) return "trajectory";
  if (/\d\s+-\s+\d/.test(text) && !/;|\bor\b|,/.test(text)) return "range";
  return "list";
}

const UNUSABLE = ["out-of-range", "leading-zero", "spreadsheet-error", "unit-mismatch", "not-numeric", "ramped"];
/** How the number was obtained, when it is not simply read as written (see Quantity.status). */
function quantityStatus(q: Quantity, factor: number): Quantity["status"] {
  const f = q.flags ?? [];
  if (f.includes("censored")) return "bound";
  if (f.includes("zero-placeholder")) return "placeholder";
  if (q.v === null && !q.values?.length && f.some((x) => UNUSABLE.includes(x))) return "invalid";
  if ((q.v !== null || q.values?.length) && (factor !== 1 || f.includes("cell-unit-converted"))) return "converted";
  return undefined;
}

function readText(spec: TSpec, raw: string): TextValue | undefined {
  const v = (raw ?? "").trim();
  if (!v || NO_VALUE.test(v)) return undefined;
  return spec.flags?.length ? { col: spec.col, raw, v, flags: spec.flags } : { col: spec.col, raw, v };
}

function psiRows(id: string, table: TableIn, meta: ManifestIn["tables"][number], spec: TableSpec): AtlasRow[] {
  const index = new Map(table.header.map((h, i) => [norm(h), i]));
  const colIndex = (col: string) => {
    const i = index.get(norm(col));
    if (i === undefined) throw new Error(`Schema changed: ${id} has no column ${JSON.stringify(col)}`);
    return i;
  };
  // Resolve every column named in the spec up front, so a renamed column fails loudly.
  const named = [
    "col" in spec.material ? spec.material.col : null,
    spec.o2Pct?.col, spec.o2PctEnd?.col, spec.burnerO2Pct?.col, spec.pressurePsi?.col, spec.flowCms?.col, spec.flowDirection,
    spec.diluent?.n2?.col, spec.diluent?.co2?.col, spec.diluent?.he?.col,
    ...Object.values(spec.measures ?? {}).map((m) => m.col),
  ].filter((c): c is string => !!c);
  for (const c of named) colIndex(c);

  return table.rows.map((r) => {
    const get = (col: string) => r.cells[colIndex(col)] ?? "";
    const isBlank = r.cells.every((c) => !String(c ?? "").trim());
    // A footnote line ("Note 1 Derived from…") in the first cell with the rest blank is not a test.
    const footnote = /^\s*note\s*\d/i.test(r.cells[0] ?? "") && r.cells.slice(1).every((c) => !String(c ?? "").trim());
    const kind = footnote ? (["aside", `NASA footnote: "${r.cells[0].trim()}"`] as [RowKind, string]) : spec.rowKind(get, isBlank);
    const [rowKind, rowKindReason] = Array.isArray(kind) ? kind : [kind as RowKind, undefined];
    const label = "col" in spec.material ? get(spec.material.col) : spec.material.fixed;
    const mat = normaliseMaterial(label, id);
    const { fuelClass: matClass, ...materialInfo } = mat;
    const flags = new Set<string>(spec.rowFlags?.(get) ?? []);
    for (const f of mat.flags ?? []) flags.add(f);

    const row: AtlasRow = {
      id: `${id}:r${r.sourceRow}`,
      source: { kind: "psi", table: id, accession: meta.accession, sha256: meta.sha256, sourceRow: r.sourceRow },
      investigation: typeof spec.investigation === "function" ? spec.investigation(get) : spec.investigation,
      rowKind,
      ...(rowKindReason ? { rowKindReason } : {}),
      fuelClass: rowKind === "aside" ? null : (spec.fuelClass ?? matClass),
      material: { ...materialInfo, col: "col" in spec.material ? spec.material.col : `(fixed: ${spec.material.why})`, raw: label },
      ...(spec.flameConfig ? { flameConfig: spec.flameConfig } : {}),
      gravity: "microgravity",
      outcome: spec.outcome && rowKind === "test" ? (() => {
        const o = spec.outcome!(get);
        return { value: o.value, rule: o.rule, ...(o.col ? { cell: { col: o.col, raw: get(o.col) } } : {}) };
      })() : { value: "not-recorded", rule: spec.outcome ? `not a test row (${rowKind})` : "this table has no outcome column" },
      measures: {},
      flags: [],
    };
    const exp = spec.experiment?.(get);
    if (exp && rowKind !== "aside") row.experiment = { id: `${row.investigation}:${exp.key}`, role: exp.role, basis: exp.basis };
    for (const key of ["o2Pct", "o2PctEnd", "burnerO2Pct", "pressurePsi", "flowCms"] as const) {
      const s = spec[key];
      if (!s) continue;
      const q = readQuantity(s, get(s.col));
      if (q) row[key] = q;
    }
    // Say why a key condition has no value: the table lacks the column, or the cell is empty.
    if (rowKind !== "aside") {
      const absent: NonNullable<AtlasRow["absent"]> = {};
      for (const key of ["o2Pct", "pressurePsi", "flowCms"] as const) {
        if (row[key]) continue;
        // Inverse flames record the burner's oxygen stream instead of an ambient value.
        if (key === "o2Pct" && row.burnerO2Pct) continue;
        absent[key] = spec[key] ? "blank" : "not-in-table";
      }
      if (Object.keys(absent).length) row.absent = absent;
    }
    if (spec.flowDirection) {
      const t = readText({ col: spec.flowDirection, text: true }, get(spec.flowDirection));
      if (t) row.flowDirection = t;
    }
    if (spec.diluent) {
      const d: NonNullable<AtlasRow["diluent"]> = {};
      for (const k of ["n2", "co2", "he"] as const) {
        const s = spec.diluent[k];
        const q = s && readQuantity(s, get(s.col));
        if (q) d[k] = q;
      }
      if (Object.keys(d).length) row.diluent = d;
    }
    for (const [key, s] of Object.entries(spec.measures ?? {})) {
      const v = "text" in s ? readText(s, get(s.col)) : readQuantity(s, get(s.col));
      if (v) row.measures[key] = v;
    }
    // A row with no material, no condition and no measured value is an empty line in the file.
    const hasData = row.material.raw.trim() || row.o2Pct || row.pressurePsi || row.flowCms || Object.keys(row.measures).length;
    if (row.rowKind !== "aside" && !hasData) {
      row.rowKind = "aside";
      row.rowKindReason = "empty line: no material, condition or measured value";
      row.fuelClass = null;
      row.outcome = { value: "not-recorded", rule: "not a test row (aside)" };
    }
    row.flags = [...flags].sort();
    return row;
  });
}

function ntrsRows(): AtlasRow[] {
  const S = SAFFIRE_NTRS_SOURCE;
  const cell = (col: string, v: number | string) => ({ col, raw: String(v) });
  return SAFFIRE_NTRS_RUNS.map((r) => {
    const mat = normaliseMaterial(r.material, "NTRS");
    const { fuelClass, ...materialInfo } = mat;
    const q = (col: string, v: number, unit: string, extra: Partial<Quantity> = {}): Quantity => ({ ...cell(col, v), v, unit, ...extra });
    return {
      id: `NTRS-${S.ntrsId}:${r.sample}`,
      source: { kind: "ntrs", ntrsId: S.ntrsId, tables: S.tables, sample: r.sample, pdfSha256: S.pdfSha256 },
      investigation: "saffire-iv-vi",
      rowKind: "test",
      fuelClass,
      material: { ...materialInfo, col: "Table 1: Material", raw: r.material },
      gravity: "microgravity",
      o2Pct: q("Table 1: Oxygen Concentration (mol %)", r.oxygenPct, "%"),
      pressurePsi: { ...cell("Table 1: Pressure (kPa)", r.pressureKpa), v: r.pressurePsi, unit: "psia" },
      flowCms: q("Table 1: Flow (cm/s)", r.flowCms, "cm/s"),
      flowDirection: { ...cell("Table 1: Flow direction", r.flowDirection), v: r.flowDirection },
      outcome: { value: "burned", rule: "Table 2 reports a burn duration and heat release for this sample", cell: cell("Table 2: Burn duration (s)", r.burnS) },
      measures: {
        lengthCm: q("Table 1: Sample length (cm)", r.lengthCm, "cm"),
        freeVolumeM3: q("Table 1: Free volume (m³)", r.freeVolumeM3, "m³"),
        burnTimeS: q("Table 2: Burn duration (s)", r.burnS, "s"),
        heatReleaseW: q("Table 2: Heat release (W)", r.heatReleaseW, "W"),
        heatReleaseMethod: { ...cell("Table 2: Heat release method", r.heatReleaseMethod), v: r.heatReleaseMethod },
        co2IncreasePpm: q("Table 2: CO₂ increase (ppm)", r.co2IncreasePpm, "ppm"),
        coIncreasePpm: q("Table 2: CO increase (ppm)", r.coIncreasePpm, "ppm"),
      },
      flags: [],
    } satisfies AtlasRow;
  });
}

const tally = (rows: AtlasRow[], key: (r: AtlasRow) => string) =>
  rows.reduce<Record<string, number>>((acc, r) => ((acc[key(r)] = (acc[key(r)] ?? 0) + 1), acc), {});

export function buildAtlas(tables: Record<string, TableIn>, manifest: ManifestIn): Atlas {
  const rows: AtlasRow[] = [];
  for (const meta of manifest.tables) {
    const spec = SPECS[meta.id];
    if (!spec) throw new Error(`No atlas spec for ${meta.id}; add one to src/lib/atlas/specs.ts`);
    const table = tables[meta.id];
    if (!table) throw new Error(`Table ${meta.id} is in the manifest but not stored`);
    rows.push(...psiRows(meta.id, table, meta, spec));
  }
  rows.push(...ntrsRows());
  // A supplement row is matched when the run table lists a test with the same experiment identity.
  const runIds = new Set(rows.filter((r) => r.rowKind === "test" && r.experiment).map((r) => r.experiment!.id));
  for (const r of rows) if (r.rowKind === "supplement" && r.experiment) r.experiment.match = runIds.has(r.experiment.id) ? "matched" : "unmatched";
  return {
    version: ATLAS_VERSION,
    builtFrom: { manifestSyncedOn: manifest.syncedOn, tables: manifest.tables.length, ntrs: [SAFFIRE_NTRS_SOURCE.ntrsId] },
    method:
      "One record per NASA source row. Values keep the cell they came from; units are converted only where NASA states the unit, and values outside physical limits are kept as raw text with a flag. Outcomes come only from a table's own outcome column, by the rule recorded on each row. Materials are normalised by a dictionary; inferred materials are marked as such.",
    counts: {
      rows: rows.length,
      byKind: { test: 0, session: 0, matrix: 0, supplement: 0, aside: 0, ...tally(rows, (r) => r.rowKind) } as Record<RowKind, number>,
      experiments: experimentCount(rows),
      byFuelClass: tally(rows, (r) => r.fuelClass ?? "none"),
      byOutcome: tally(rows, (r) => r.outcome.value),
    },
    rows,
  };
}

/**
 * Distinct experiments among test rows. Rows that observe the same reviewed run (a fresh and an aged
 * smoke measurement) count once; a row with no reviewed identity counts as its own experiment.
 */
export function experimentCount(rows: AtlasRow[]): number {
  return new Set(rows.filter((r) => r.rowKind === "test").map((r) => r.experiment?.id ?? r.id)).size;
}

const CSV_BASE = [
  "id", "source", "sourceRow", "sha256", "investigation", "rowKind", "experimentId", "experimentRole", "fuelClass", "material", "materialBasis", "materialRaw", "form",
  "thicknessMm", "widthCm", "diameterMm", "sides", "flameConfig", "o2Pct", "o2PctStatus", "o2PctEnd", "burnerO2Pct", "pressurePsi", "pressurePsiStatus", "flowCms", "flowCmsStatus",
  "flowDirection", "n2Fraction", "co2Fraction", "heFraction", "outcome", "outcomeRule", "flags",
];

/**
 * One word for where a key condition's value stands: reported (read as written), converted (exact
 * unit factor), list / range / trajectory (several values, not one exact number), invalid, bound,
 * placeholder, blank (empty cell) or not-in-table (this NASA table has no such column).
 */
export function conditionStatus(r: AtlasRow, key: "o2Pct" | "pressurePsi" | "flowCms"): string {
  const q = r[key];
  if (!q) return r.absent?.[key] ?? (r.rowKind === "aside" ? "" : key === "o2Pct" && r.burnerO2Pct ? "burner-stream-only" : "");
  if (q.shape) return q.shape;
  return q.status ?? "reported";
}

const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const qv = (q?: Quantity | TextValue) => (q ? (q.v ?? ("values" in q && q.values ? q.values.join(";") : "")) : "");

/** Wide tidy CSV: one line per atlas row; measured results as extra columns. Cell lineage is in the JSON. */
export function atlasCsv(atlas: Atlas): string {
  const measureKeys = [...new Set(atlas.rows.flatMap((r) => Object.keys(r.measures)))].sort();
  const lines = [[...CSV_BASE, ...measureKeys].join(",")];
  for (const r of atlas.rows) {
    const src = r.source;
    const base = [
      r.id, src.kind === "psi" ? src.table : `NTRS ${src.ntrsId}`, src.kind === "psi" ? src.sourceRow : src.sample, src.kind === "psi" ? src.sha256 : src.pdfSha256,
      r.investigation, r.rowKind, r.experiment?.id, r.experiment?.role, r.fuelClass, r.material.name, r.material.basis, r.material.raw.trim(), r.material.form,
      r.material.thicknessMm, r.material.widthCm, r.material.diameterMm, r.material.sides, r.flameConfig,
      qv(r.o2Pct), conditionStatus(r, "o2Pct"), qv(r.o2PctEnd), qv(r.burnerO2Pct), qv(r.pressurePsi), conditionStatus(r, "pressurePsi"), qv(r.flowCms), conditionStatus(r, "flowCms"), r.flowDirection?.v,
      qv(r.diluent?.n2), qv(r.diluent?.co2), qv(r.diluent?.he), r.outcome.value, r.outcome.rule, r.flags.join(";"),
    ];
    lines.push([...base, ...measureKeys.map((k) => qv(r.measures[k]))].map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}
