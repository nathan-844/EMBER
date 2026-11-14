// Data explorer: reads the stored NASA PSI run tables row by row, so modellers get test points
// (and results) rather than only EMBER's min–max ranges. Imported lazily by the UI because it
// pulls in every stored table.
import manifest from "../data/table-manifest.json";
import { NORMALIZED } from "../data/investigations";
import { TABLES, type RunTable } from "../data/tables";
import type { Investigation } from "../data/types";
import { cellValues, cleanHeader, isNoValue } from "./cells";

type CondKey = "oxygenPct" | "pressurePsi" | "airflowMs";
export const APP_UNIT: Record<CondKey, string> = { oxygenPct: "vol %", pressurePsi: "psia", airflowMs: "m/s" };

export interface TableMeta {
  id: string;
  accession: string;
  file: string;
  rows: number;
  sha256: string;
  url: string;
}
const TABLE_META = (manifest as { tables: TableMeta[] }).tables;

/** Every stored NASA table for an investigation (some have two, e.g. normal and inverse flames). */
export function tablesFor(inv: Pick<Investigation, "psi">): TableMeta[] {
  return TABLE_META.filter((t) => t.accession === inv.psi.accession && TABLES[t.id]);
}

export function getTable(id: string): RunTable {
  const t = TABLES[id];
  if (!t) throw new Error(`Run table ${id} is not stored`);
  return t;
}

/**
 * condition   – a column EMBER converts into a ranked condition (oxygen, pressure, airflow)
 * result      – a column whose header names a test outcome (burn length, spread rate, extinction…);
 *               judged from the header only
 * bookkeeping – run ids, dates, times, camera files and free-text notes
 * setting     – everything else that describes how a run was set up
 */
export type ColumnRole = "condition" | "result" | "bookkeeping" | "setting";

const BOOKKEEPING = /^(pi|date|gmt|day|year|month|test ?#?|test type|test day\*?|as run test #|sample ?#|sample number|flex number|flex identifier|flex test #|test date|test gmt|local time|cir|session name|actual day|camera ?\d|notes?|comments?|gmt date|gmt ignition|gmt flame off|same test #)$/i;
const RESULT = /burn length|spread (length|rate)|extinction|weight loss|smoke point|lift-?off|soot|rt\/r0|burn time|flames ignited|self.?ext|cool flame\?|hot ignition|burn ?rate|peak burner|final o2|final co2?|tfp|mean zst|tad \(k\)|zst/i;

/** Columns of one table that EMBER converts into conditions, with their unit factor. */
function conditionColumns(tableId: string): Map<string, { key: CondKey; factor: number; parser: string }> {
  const out = new Map<string, { key: CondKey; factor: number; parser: string }>();
  for (const p of Object.values(NORMALIZED.profiles)) {
    if (p.table !== tableId) continue;
    for (const [key, c] of Object.entries(p.conditions) as [CondKey, { column: string; factor?: number; parser?: string }][]) {
      out.set(c.column, { key, factor: c.factor ?? 1, parser: c.parser ?? "parseCell" });
    }
  }
  return out;
}

export function columnRole(header: string, conditions: Map<string, unknown>): ColumnRole {
  const h = header.replace(/\s+/g, " ").trim();
  if (conditions.has(h)) return "condition";
  if (BOOKKEEPING.test(h)) return "bookkeeping";
  if (RESULT.test(h)) return "result";
  return "setting";
}

/** Unit written in a NASA header, e.g. "Air Flow (cm/s)" → "cm/s", "Ambient pressure; mmHg" → "mmHg". */
export function unitOf(header: string): string | null {
  const h = header.replace(/\s+/g, " ").trim();
  const paren = /\(([^()]+)\)\s*\*?$/.exec(h);
  if (paren) return paren[1].trim();
  const semi = /;\s*([^;]+)$/.exec(h);
  if (semi && semi[1].length <= 16) return semi[1].trim();
  return null;
}

/** Same physical limits as scripts/normalize-conditions.mjs, in the app's units. */
const LIMITS: Record<CondKey, (v: number) => boolean> = {
  oxygenPct: (v) => v > 0 && v <= 100,
  pressurePsi: (v) => v > 0 && v < 200,
  airflowMs: (v) => v >= 0 && v < 10,
};

export interface ColumnSummary {
  header: string;
  role: ColumnRole;
  unit: string | null;
  filled: number;
  distinct: number;
  /** Present when at least 80% of filled cells are numbers. */
  numeric: { min: number; max: number } | null;
  /** Most common values, for text columns or a fixed value. */
  examples: string[];
  /** Every row carries the same list of levels (e.g. "0.17; 0.21; 0.25; 0.3"): a test matrix, not a fixed value. */
  sameListEveryRow?: boolean;
  /** Condition values outside physical limits, left out of min–max as in the ranked ranges. */
  dropped?: string[];
}

export interface TableSummary {
  table: TableMeta;
  rows: number;
  varied: ColumnSummary[];
  fixed: ColumnSummary[];
  empty: string[];
  bookkeeping: string[];
  noValueCells: number;
}

/** What varied and what stayed fixed across the runs in one NASA table. */
export function summarizeTable(meta: TableMeta): TableSummary {
  const t = getTable(meta.id);
  const conds = conditionColumns(meta.id);
  const out: TableSummary = { table: meta, rows: t.rows.length, varied: [], fixed: [], empty: [], bookkeeping: [], noValueCells: 0 };
  t.header.forEach((rawHeader, i) => {
    const header = cleanHeader(rawHeader);
    if (!header) return;
    const role = columnRole(rawHeader, conds);
    if (role === "bookkeeping") { out.bookkeeping.push(header); return; }
    const values: string[] = [];
    for (const r of t.rows) {
      const v = (r.cells[i] ?? "").replace(/\s+/g, " ").trim();
      if (!v) continue;
      if (isNoValue(v)) { out.noValueCells++; continue; }
      values.push(v);
    }
    if (!values.length) { out.empty.push(header); return; }
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const cond = conds.get(rawHeader.replace(/\s+/g, " ").trim());
    const dropped: string[] = [];
    const nums = values
      .map((v) => {
        const n = cellValues(v, cond?.parser);
        if (!cond) return n;
        const ok = n.filter((x) => LIMITS[cond.key](x * cond.factor));
        if (ok.length < n.length) dropped.push(v);
        return ok;
      })
      .filter((n) => n.length);
    const numeric = nums.length >= values.length * 0.8 ? { min: Math.min(...nums.flat()), max: Math.max(...nums.flat()) } : null;
    const summary: ColumnSummary = {
      header,
      role,
      unit: unitOf(rawHeader),
      filled: values.length,
      distinct: counts.size,
      numeric,
      examples: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v),
      ...(dropped.length ? { dropped } : {}),
    };
    const listLevels = counts.size === 1 && cellValues(values[0], cond?.parser).length > 1;
    if (listLevels) summary.sameListEveryRow = true;
    (counts.size === 1 && !listLevels ? out.fixed : out.varied).push(summary);
  });
  return out;
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Tidy (long) CSV of every filled cell in the NASA tables of the given investigations: one row per
 * test run and column, with the cell exactly as NASA wrote it, the numbers parsed from it and,
 * for the columns EMBER ranks on, the value converted into the app's unit.
 */
export function buildRowsCsv(invs: Investigation[]): string {
  const header = [
    "investigation", "psi_accession", "psi_table", "table_sha256", "source_row", "column", "column_role",
    "unit_in_header", "value_as_written", "numbers_parsed", "ember_condition", "ember_value", "ember_unit",
  ];
  const lines = [header.join(",")];
  for (const inv of invs) {
    for (const meta of tablesFor(inv)) {
      const t = getTable(meta.id);
      const conds = conditionColumns(meta.id);
      for (const r of t.rows) {
        t.header.forEach((rawHeader, i) => {
          const value = (r.cells[i] ?? "").replace(/\s+/g, " ").trim();
          if (!value || isNoValue(value) || !rawHeader.trim()) return;
          const key = rawHeader.replace(/\s+/g, " ").trim();
          const cond = conds.get(key);
          const nums = cellValues(value, cond?.parser);
          const converted = cond ? nums.map((n) => +(n * cond.factor).toPrecision(6)) : [];
          lines.push([
            inv.name, meta.accession, meta.id, meta.sha256, r.sourceRow, cleanHeader(rawHeader), columnRole(rawHeader, conds),
            unitOf(rawHeader), value, nums.join(";"), cond?.key ?? "", converted.join(";"), cond ? APP_UNIT[cond.key] : "",
          ].map(csvCell).join(","));
        });
      }
    }
  }
  return lines.join("\n") + "\n";
}
