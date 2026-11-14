// Picks the real NASA PSI run-table rows closest to a scenario so the model can quote
// measured values (table cells) instead of only EMBER's summaries.
import normalized from "../src/data/normalized-conditions.json";
import { TABLES } from "../src/data/tables";
import type { EvidenceSource } from "../src/lib/evidence";
import type { Scenario } from "../src/lib/scenario";

type Key = "oxygenPct" | "pressurePsi" | "airflowMs";
type Cond = { min: number; max: number; column: string; factor: number; parser: string };
type Profile = { table: string; conditions: Partial<Record<Key, Cond>> };
const PROFILES = (normalized as unknown as { profiles: Record<string, Profile> }).profiles;

function table(id: string) {
  const t = TABLES[id];
  if (!t) throw new Error(`Run table ${id} is not indexed; run npm run data:normalize`);
  return t;
}

/** Same rules as scripts/normalize-conditions.mjs: unit-stated scalars, lists and "a - b" ranges. */
export function cellValues(raw: string | undefined, parser = "parseCell"): number[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  if (parser === "pctO2InText") return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*O2/gi)].map((m) => Number(m[1]));
  const parts = text.replace(/~/g, "").split(/;|\bor\b|,|\bto\b|(?<=\d)\s+-\s+(?=\d)/).map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d*\.?\d+)\s*(atm|bar|mmhg|cm\/s|%|mm|cm)?$/i.exec(p);
    if (!m) return [];
    out.push(Number(m[1]));
  }
  return out;
}

/** Render a row as "Header: value; ..." with blank cells skipped, capped for prompt size. */
function rowText(header: string[], cells: string[], cap = 420): string {
  const parts = header
    .map((h, i) => [h.replace(/\s+/g, " ").trim(), (cells[i] ?? "").replace(/\s+/g, " ").trim()] as const)
    .filter(([h, v]) => h && v)
    .map(([h, v]) => `${h}: ${v}`);
  const text = parts.join("; ");
  return text.length > cap ? text.slice(0, cap).replace(/;[^;]*$/, "") + "; …" : text;
}

/**
 * For one profile, return up to `k` source rows nearest the scenario on the conditions
 * the table records (distance scaled by each condition's recorded span). Rows with no
 * comparable value are skipped. This is a disclosed selection, not a representative sample.
 */
export function nearestRows(profileId: string, name: string, scenario: Scenario, k = 3): EvidenceSource[] {
  const p = PROFILES[profileId];
  if (!p) return [];
  const t = table(p.table);
  const keys = (Object.keys(p.conditions) as Key[]).filter((key) => scenario[key] != null);
  const cols = keys.map((key) => {
    const c = p.conditions[key]!;
    return { key, c, i: t.header.findIndex((h) => h.trim() === c.column), span: Math.max(c.max - c.min, 1e-6) };
  }).filter((x) => x.i >= 0);

  const scored = t.rows
    .map((r) => {
      let d = 0, n = 0;
      for (const { key, c, i, span } of cols) {
        const vals = cellValues(r.cells[i], c.parser).map((v) => v * c.factor);
        if (!vals.length) continue;
        d += Math.min(...vals.map((v) => Math.abs(v - (scenario[key] as number)))) / span;
        n++;
      }
      return { r, d: n ? d / n : Infinity, n };
    })
    .filter((x) => x.n > 0 || !cols.length)
    .sort((a, b) => a.d - b.d || a.r.sourceRow - b.r.sourceRow)
    .slice(0, k);

  return scored.map(({ r }) => ({
    id: `${profileId}:row${r.sourceRow}`,
    label: `${name} · NASA ${p.table} row ${r.sourceRow}`,
    origin: "nasa" as const,
    text: rowText(t.header, r.cells),
  }));
}
