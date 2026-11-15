// Data audit: every data-quality issue EMBER found in NASA's tables while building the atlas, each
// with the table, the count, example cells exactly as NASA wrote them, and how EMBER handles it.
// Built by scripts/build-atlas.ts into src/data/atlas/audit.json.
import type { TableIn } from "./build";
import { FLAG_TEXT } from "./specs";
import type { Atlas, AtlasRow, Quantity, TextValue } from "./types";

/**
 * error – very likely a mistake in the file (typo, lost character, impossible value)
 * gap   – something a reader needs that the file does not record
 * note  – a quirk of how the table is written; not a mistake, but it trips up a naive reader
 */
export type AuditKind = "error" | "gap" | "note";

export interface AuditExample {
  /** "PSI-99-0 row 5" */
  where: string;
  column?: string;
  /** Cell text exactly as NASA wrote it. */
  raw: string;
}

export interface AuditIssue {
  id: string;
  kind: AuditKind;
  table: string;
  accession: string;
  title: string;
  /** What is wrong, in plain words. */
  detail: string;
  /** How EMBER handles it. */
  handling: string;
  /** Cells, rows or columns affected (see `unit`). */
  count: number;
  unit: "cells" | "rows" | "columns" | "tables";
  examples: AuditExample[];
}

export interface AuditFile {
  version: string;
  method: string;
  totals: { issues: number; error: number; gap: number; note: number; tablesAffected: number; tablesChecked: number };
  issues: AuditIssue[];
}

interface FlagMeta { kind: AuditKind; title: string; handling: string; per?: "column" }
const FLAGS: Record<string, FlagMeta> = {
  "out-of-range": { kind: "error", title: "Value outside physical limits", handling: "Not used as a number; the raw cell is kept." },
  "leading-zero": { kind: "error", title: "Number missing its decimal point", handling: "Not used: the magnitude is ambiguous. The raw cell is kept." },
  "o2-end-implausible": { kind: "error", title: "Final oxygen that a glovebox burn cannot produce", handling: "The row is kept but left out of the carbon-monoxide finding (F4)." },
  "label-fill-down": { kind: "error", title: "Fuel label counts up row by row (spreadsheet fill-down)", handling: "No fuel name is assigned; the label is kept as written." },
  "label-typo": { kind: "error", title: "Typo in a material label", handling: "Matched with its evident meaning; the label is kept as written." },
  "header-subscript-lost": { kind: "error", title: "Column header lost its subscripts", handling: "Read with the evident meaning (O is O₂, CO is CO₂, N is N₂ in FLEX's composition columns).", per: "column" },
  "header-encoding": { kind: "error", title: "Column header lost the µ in µ-g", handling: "Read as µ-g (microgravity).", per: "column" },
  "header-typo": { kind: "error", title: "Typo in a column header", handling: "Read with its evident meaning.", per: "column" },
  "unit-doubtful": { kind: "error", title: "Header unit does not fit the quantity", handling: "Values are kept in the unit as stated and not used in any finding.", per: "column" },
  "spreadsheet-error": { kind: "error", title: "Spreadsheet error left in a cell", handling: "Not used." },
  "length-width-swapped": { kind: "error", title: "Sample length and width look swapped", handling: "Kept as written and flagged; not used in any finding." },
  "material-blank": { kind: "gap", title: "Material cell blank on a test row", handling: "Not filled in; the test is reported as \"not stated in NASA's table\"." },
  censored: { kind: "gap", title: "Reading off the instrument's scale", handling: "No number is used; counted separately in F4." },
  "negative-reading": { kind: "note", title: "Negative instrument reading", handling: "Kept as written (air rates below zero are not used as a flow)." },
  ramped: { kind: "note", title: "Flow marked RAMPED, so the run has no single value", handling: "No number is used for the ramped columns." },
  "not-numeric": { kind: "note", title: "Text in a numeric column", handling: "Kept as text; no number is used." },
  "cell-unit-converted": { kind: "note", title: "Cell states a different unit from its column", handling: "Converted using the unit the cell states." },
  "unit-mismatch": { kind: "note", title: "Cell unit cannot be converted to the column's unit", handling: "Not used." },
};

const valuesOf = (r: AtlasRow): (Quantity | TextValue)[] =>
  [r.o2Pct, r.o2PctEnd, r.burnerO2Pct, r.pressurePsi, r.flowCms, r.flowDirection, r.diluent?.n2, r.diluent?.co2, r.diluent?.he, ...Object.values(r.measures)].filter(
    (q): q is Quantity | TextValue => !!q,
  );
const clean = (h: string) => h.replace(/\s+/g, " ").trim();
const MAX_EXAMPLES = 4;

export function buildAudit(atlas: Atlas, tables: Record<string, TableIn>): AuditFile {
  const psi = atlas.rows.filter((r): r is AtlasRow & { source: { kind: "psi"; table: string; accession: string; sha256: string; sourceRow: number } } => r.source.kind === "psi");
  const accession = new Map(psi.map((r) => [r.source.table, r.source.accession]));
  const where = (r: (typeof psi)[number]) => `${r.source.table} row ${r.source.sourceRow}`;
  const issues: AuditIssue[] = [];
  const add = (i: Omit<AuditIssue, "accession" | "id">) => issues.push({ ...i, id: "", accession: accession.get(i.table) ?? "", examples: i.examples.slice(0, MAX_EXAMPLES) });

  // 1. Flags recorded while reading each cell and row.
  const groups = new Map<string, { table: string; flag: string; examples: AuditExample[]; cells: number; columns: Set<string>; raws: Set<string> }>();
  const note = (table: string, flag: string, ex: AuditExample) => {
    const k = `${table}|${flag}`;
    const g = groups.get(k) ?? { table, flag, examples: [], cells: 0, columns: new Set<string>(), raws: new Set<string>() };
    groups.set(k, g);
    g.cells++;
    if (ex.column) g.columns.add(ex.column);
    if (!g.raws.has(ex.raw)) { g.raws.add(ex.raw); g.examples.push(ex); }
  };
  for (const r of psi) {
    for (const q of valuesOf(r)) {
      for (const f of q.flags ?? []) {
        // A negative reading is reported once, as a negative reading, not again as out of range.
        if (f === "out-of-range" && q.flags?.includes("negative-reading")) continue;
        note(r.source.table, f, { where: where(r), column: clean(q.col), raw: q.raw.trim() });
      }
    }
    for (const f of r.flags) {
      // Row flags that repeat a value flag (ramped) are already counted cell by cell.
      if (valuesOf(r).some((q) => q.flags?.includes(f))) continue;
      const ex: AuditExample =
        f === "o2-end-implausible" ? { where: where(r), column: "initial → final O2 % by vol", raw: `${r.o2Pct?.raw.trim()} → ${r.o2PctEnd?.raw.trim()}` }
        : f === "length-width-swapped" ? { where: where(r), column: "Sample Length (cm) × Sample Width (cm)", raw: `${r.measures.lengthCm?.raw.trim()} × ${r.measures.widthCm?.raw.trim()}` }
        : { where: where(r), column: clean(r.material.col), raw: r.material.raw.trim() || "(blank)" };
      note(r.source.table, f, ex);
    }
  }
  for (const g of groups.values()) {
    const meta = FLAGS[g.flag];
    if (!meta) throw new Error(`Audit has no entry for flag ${g.flag}`);
    const perColumn = meta.per === "column";
    add({
      kind: meta.kind, table: g.table, title: meta.title, detail: FLAG_TEXT[g.flag], handling: meta.handling,
      count: perColumn ? g.columns.size : g.cells, unit: perColumn ? "columns" : g.flag === "o2-end-implausible" || g.flag === "length-width-swapped" || g.flag === "material-blank" ? "rows" : "cells",
      examples: perColumn ? [...g.columns].map((c) => ({ where: `${g.table} header`, raw: c })) : g.examples,
    });
  }

  // 2. Rows that are not tests, mixed into the test table.
  const asides = new Map<string, (typeof psi)[number][]>();
  for (const r of psi) if (r.rowKind === "aside") asides.set(r.source.table, [...(asides.get(r.source.table) ?? []), r]);
  for (const [table, rs] of asides) {
    add({
      kind: "note", table, title: "Lines that are not tests inside the test table",
      detail: "Footnotes, flow-visualisation lines, cleaning runs, continuation lines or empty lines sit among the test rows, so a row count overstates the number of tests.",
      handling: "Marked as asides with the reason, and left out of every count of tests.",
      count: rs.length, unit: "rows",
      examples: rs.map((r) => ({ where: where(r), raw: (r.rowKindReason ?? "").replace(/^NASA footnote: |^not a test: /, "").replace(/^"|"$/g, "") })),
    });
  }

  // 3. Gas composition that does not add up to 1 (FLEX and CFI give mole fractions).
  for (const [inv, parts] of [["flex", ["n2", "co2", "he"]], ["cfi", ["n2", "he"]]] as const) {
    const off = psi.filter((r) => r.investigation === inv && r.rowKind === "test" && typeof r.o2Pct?.v === "number").map((r) => {
      const sum = r.o2Pct!.v! / 100 + parts.reduce((n, p) => n + (r.diluent?.[p]?.v ?? 0), 0);
      return { r, sum: +sum.toFixed(3) };
    }).filter((x) => Math.abs(x.sum - 1) > 0.011);
    if (off.length) add({
      kind: "error", table: off[0].r.source.table, title: "Gas mole fractions do not add up to 1",
      detail: "The oxygen, nitrogen and added-gas fractions of the ambient gas should sum to 1. On these rows they do not, so one fraction is mistyped or a gas is missing from the table.",
      handling: "Values are kept as written; the rows stay in the findings because oxygen is the only fraction they use.",
      count: off.length, unit: "rows", examples: off.map((x) => ({ where: where(x.r), column: "sum of the composition columns", raw: String(x.sum) })),
    });
  }

  // 4. Oxygen that rose during a sealed burn.
  const rose = psi.filter((r) => r.investigation === "bass-ii" && typeof r.o2Pct?.v === "number" && typeof r.o2PctEnd?.v === "number" && r.o2PctEnd.v > r.o2Pct.v + 0.05 && !r.flags.includes("o2-end-implausible"));
  if (rose.length) add({
    kind: "note", table: rose[0].source.table, title: "Oxygen higher after the burn than before",
    detail: "A burn uses up oxygen, so the final reading should not be above the initial one. These rows rise by about 0.1 point, which is within what a sensor can drift; they may also record a top-up of the glovebox air.",
    handling: "Kept as written.",
    count: rose.length, unit: "rows", examples: rose.map((r) => ({ where: where(r), column: "initial → final O2 % by vol", raw: `${r.o2Pct!.raw.trim()} → ${r.o2PctEnd!.raw.trim()}` })),
  });

  // 5. Identical rows, and repeated test identifiers.
  for (const [table, t] of Object.entries(tables)) {
    const aside = new Set(psi.filter((r) => r.source.table === table && r.rowKind === "aside").map((r) => r.source.sourceRow));
    const seen = new Map<string, number>();
    const dups: AuditExample[] = [];
    for (const r of t.rows) {
      if (aside.has(r.sourceRow)) continue;
      const k = r.cells.map((c) => String(c ?? "").trim()).join("|");
      const first = seen.get(k);
      if (first !== undefined) dups.push({ where: `${table} row ${r.sourceRow}`, raw: `identical to row ${first}` });
      else seen.set(k, r.sourceRow);
    }
    if (dups.length) add({
      kind: "note", table, title: "Rows identical in every column",
      detail: "Two or more rows have the same value in every column the table records. They may be genuine repeat runs that the table cannot tell apart, or duplicated lines.",
      handling: "Every row is kept as its own test; findings that count tests say so.",
      count: dups.length, unit: "rows", examples: dups,
    });
  }
  const flex = tables["PSI-69-0"];
  if (flex) {
    const col = flex.header.findIndex((h) => clean(h) === "FLEX Identifier");
    const seen = new Map<string, number>();
    const dups: AuditExample[] = [];
    for (const r of flex.rows) {
      const id = (r.cells[col] ?? "").trim();
      if (seen.has(id)) dups.push({ where: `PSI-69-0 row ${r.sourceRow}`, column: "FLEX Identifier", raw: `${id} (also row ${seen.get(id)})` });
      else seen.set(id, r.sourceRow);
    }
    if (dups.length) add({
      kind: "error", table: "PSI-69-0", title: "Test identifier used twice",
      detail: "Each FLEX run has its own identifier, but this one appears on two rows with different results.",
      handling: "EMBER identifies rows by table and row number, never by NASA's identifier, so both rows are kept apart.",
      count: dups.length, unit: "rows", examples: dups,
    });
  }

  // 6. The same fabric with three different thicknesses across the Saffire tables.
  const sibal = psi.filter((r) => /^saffire-/.test(r.investigation) && r.rowKind === "test" && /SIBAL/.test(r.material.name ?? ""));
  const thick = sibal.map((r) => ({ r, q: r.measures.thicknessCm ?? r.measures.thicknessMm })).filter((x) => x.q);
  if (new Set(thick.map((x) => `${x.q!.raw.trim()}|${clean(x.q!.col)}`)).size > 1) add({
    kind: "error", table: "PSI-98-0", title: "Same fabric, three different thicknesses",
    detail: "Saffire-I, II and III all burned SIBAL cotton-fiberglass fabric, but its thickness is written 0.37 under a cm header, \"037 mm\" and \".33 cm\". A fabric sheet is a fraction of a millimetre thick, so the cm values look like unit slips.",
    handling: "No thickness is used for SIBAL in any finding; each cell is kept as written.",
    count: new Set(thick.map((x) => x.r.source.table)).size, unit: "tables",
    examples: [...new Map(thick.map((x) => [x.r.source.table, { where: where(x.r), column: clean(x.q!.col), raw: x.q!.raw.trim() }])).values()],
  });

  const order: Record<AuditKind, number> = { error: 0, gap: 1, note: 2 };
  const num = (t: string) => Number(t.split("-")[1]) * 10 + Number(t.split("-")[2]);
  issues.sort((a, b) => order[a.kind] - order[b.kind] || num(a.table) - num(b.table) || a.title.localeCompare(b.title));
  issues.forEach((i, n) => (i.id = `A${n + 1}`));
  const by = (k: AuditKind) => issues.filter((i) => i.kind === k).length;
  return {
    version: "audit-v1",
    method:
      "Found while reading every cell of every stored NASA PSI combustion table into the Fire Test Atlas, plus cross-checks: gas fractions that should sum to 1, oxygen before and after a burn, identical rows, repeated identifiers and the same material across tables. Nothing in NASA's files is changed; each issue says how EMBER handles it. The tables were not compared with their source papers.",
    totals: { issues: issues.length, error: by("error"), gap: by("gap"), note: by("note"), tablesAffected: new Set(issues.map((i) => i.table)).size, tablesChecked: Object.keys(tables).length },
    issues,
  };
}
