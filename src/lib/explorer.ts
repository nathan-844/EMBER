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

/** Header key with whitespace collapsed (NASA headers carry double and trailing spaces). */
const norm = (h: string) => h.replace(/\s+/g, " ").trim();

/** Columns of one table that EMBER converts into conditions, with their unit factor. */
function conditionColumns(tableId: string): Map<string, { key: CondKey; factor: number; parser: string }> {
  const out = new Map<string, { key: CondKey; factor: number; parser: string }>();
  for (const p of Object.values(NORMALIZED.profiles)) {
    if (p.table !== tableId) continue;
    for (const [key, c] of Object.entries(p.conditions) as [CondKey, { column: string; factor?: number; parser?: string }][]) {
      out.set(norm(c.column), { key, factor: c.factor ?? 1, parser: c.parser ?? "parseCell" });
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
  // "(Note 1)" is a footnote marker, not a unit.
  // A unit has a letter or symbol; "(1000 250 50 10)" lists settings.
  if (paren && !/^note\b/i.test(paren[1].trim()) && /[a-zA-Z%°/µ]/.test(paren[1])) return paren[1].trim();
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

export type GapFuel = "solid" | "liquid" | "gas" | "none";

export interface GapPoint {
  id: string;
  name: string;
  fuel: GapFuel;
  table: string;
  oxygenPct: number;
  /** null when neither the table nor a curated value gives the pressure. */
  pressurePsi: number | null;
  /** true when the table has no pressure column and EMBER's curated cabin pressure is used. */
  pressureAssumed: boolean;
  /** Source rows that fall on this exact point. */
  rows: number[];
}

export interface GapData {
  points: GapPoint[];
  /** Rows where both oxygen and pressure list several levels, so the pairing is unknown. */
  ambiguousRows: number;
  /** Profiles with an oxygen range written as an approximation rather than read from a table. */
  curatedOnly: string[];
}

/**
 * One point per NASA run-table row (oxygen against pressure, both from the same row where the
 * table records both), for every profile whose oxygen comes from a run table. These are joint
 * test conditions, unlike the per-condition min–max ranges used for ranking.
 */
export function gapPoints(invs: Investigation[]): GapData {
  const byKey = new Map<string, GapPoint>();
  let ambiguousRows = 0;
  const curatedOnly: string[] = [];
  for (const inv of invs) {
    const prof = NORMALIZED.profiles[inv.id] as unknown as
      | { table: string; conditions: Partial<Record<CondKey, { column: string; factor: number; parser?: string }>> }
      | undefined;
    const o2c = prof?.conditions.oxygenPct;
    if (!prof || !o2c) {
      if (inv.conditions.oxygenPct) curatedOnly.push(inv.name);
      continue;
    }
    const t = getTable(prof.table);
    const col = (name: string) => t.header.findIndex((h) => norm(h) === norm(name));
    const oi = col(o2c.column);
    const pc = prof.conditions.pressurePsi;
    const pi = pc ? col(pc.column) : -1;
    const curatedP = !pc && inv.conditions.pressurePsi ? +((inv.conditions.pressurePsi.min + inv.conditions.pressurePsi.max) / 2).toFixed(2) : null;
    const fuel: GapFuel = (inv.fuelTypes[0] as GapFuel | undefined) ?? "none";
    for (const r of t.rows) {
      const o2 = cellValues(r.cells[oi], o2c.parser).map((v) => +(v * o2c.factor).toPrecision(4)).filter(LIMITS.oxygenPct);
      if (!o2.length) continue;
      let pairs: [number, number | null][];
      if (pc && pi >= 0) {
        const p = cellValues(r.cells[pi], pc.parser).map((v) => +(v * pc.factor).toPrecision(4)).filter(LIMITS.pressurePsi);
        if (!p.length) continue;
        if (o2.length > 1 && p.length > 1) { ambiguousRows++; continue; }
        pairs = o2.flatMap((o) => p.map((q) => [o, q] as [number, number]));
      } else {
        pairs = o2.map((o) => [o, curatedP]);
      }
      for (const [o, q] of pairs) {
        const key = `${inv.id}|${o}|${q}`;
        const hit = byKey.get(key);
        if (hit) hit.rows.push(r.sourceRow);
        else byKey.set(key, { id: inv.id, name: inv.name, fuel, table: prof.table, oxygenPct: o, pressurePsi: q, pressureAssumed: !pc && q != null, rows: [r.sourceRow] });
      }
    }
  }
  return { points: [...byKey.values()], ambiguousRows, curatedOnly };
}

/** The solid-material test point closest to a scenario's oxygen level, if any. */
export function nearestSolid(points: GapPoint[], oxygenPct: number): GapPoint | null {
  const solid = points.filter((p) => p.fuel === "solid");
  if (!solid.length) return null;
  return solid.reduce((best, p) => (Math.abs(p.oxygenPct - oxygenPct) < Math.abs(best.oxygenPct - oxygenPct) ? p : best));
}
