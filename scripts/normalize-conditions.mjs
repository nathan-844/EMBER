// Turns stored NASA PSI run tables (src/data/tables) into per-profile condition ranges.
// Usage: npm run data:normalize
//
// Rules: only columns whose unit is stated in the header or the cell are converted.
// Uncalibrated instrument readings (e.g. BASS-II "Air display"), burner oxidizer
// streams (inverse flames) and free-text notes are not used. Values outside physical
// limits are dropped and counted. Every range keeps its source column, row count and
// the table's SHA-256, so the app can show exactly where a number came from.
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("src/data/table-manifest.json", "utf8"));
const ATM = 14.6959;
const BAR = 14.5038;
const MMHG = 14.6959 / 760;

/**
 * Parse one cell into numbers. Accepts a plain number, a number with an optional
 * unit suffix, "~ n" (approximate), "a - b" / "a to b" (both ends) and ";"-separated
 * lists. Anything else returns no values.
 */
export function parseCell(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { values: [], approx: false };
  const approx = /~/.test(text);
  const parts = text
    .replace(/~/g, "")
    .split(/;|\bor\b|,|\bto\b|(?<=\d)\s+-\s+(?=\d)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const values = [];
  for (const p of parts) {
    const m = /^(\d*\.?\d+)\s*(atm|bar|mmhg|cm\/s|%|mm|cm)?$/i.exec(p);
    if (!m) return { values: [], approx }; // any non-numeric part: reject the whole cell
    values.push(Number(m[1]));
  }
  return { values, approx };
}

/** Pull every "N% O2" out of free text such as "~30% O2 with He". */
function pctO2InText(raw) {
  const values = [...String(raw ?? "").matchAll(/(\d+(?:\.\d+)?)\s*%\s*O2/gi)].map((m) => Number(m[1]));
  return { values, approx: /~/.test(raw ?? "") };
}

const LIMITS = {
  oxygenPct: (v) => v > 0 && v <= 100,
  pressurePsi: (v) => v > 0 && v < 200,
  airflowMs: (v) => v >= 0 && v < 10,
};

// profile id → table + column mappings. `factor` converts the source unit into the app unit.
const MAPPINGS = {
  "acme-flame-design": { table: "PSI-10-0", oxygenPct: { column: "XO2 (init)", factor: 100, unit: "mole fraction" }, pressurePsi: { column: "pinit (atm)", factor: ATM, unit: "atm" } },
  "acme-bre": { table: "PSI-20-0", oxygenPct: { column: "Oxygen Conc (percent)", factor: 1, unit: "vol %" } },
  "acme-s-flame": { table: "PSI-23-0", oxygenPct: { column: "Atmosphere*", factor: 1, unit: "% O2 in text", parse: pctO2InText } },
  "bass-ii": { table: "PSI-25-0", oxygenPct: { column: "Calibrated  initial O2 % by vol ", factor: 1, unit: "vol %" } },
  cfi: { table: "PSI-39-0", oxygenPct: { column: "Oxygen", factor: 100, unit: "mole fraction" }, pressurePsi: { column: "Pressure", factor: ATM, unit: "atm" } },
  "flex-2": {
    table: "PSI-68-0",
    oxygenPct: { column: "Oxygen Mole Fraction", factor: 100, unit: "mole fraction" },
    pressurePsi: { column: "Ambient Pressure (atm)", factor: ATM, unit: "atm" },
    airflowMs: { column: "Flow Velocity (cm/s)", factor: 0.01, unit: "cm/s" },
  },
  flex: { table: "PSI-69-0", oxygenPct: { column: "O initial ambient composition; mole fraction", factor: 100, unit: "mole fraction" }, pressurePsi: { column: "Ambient pressure; mmHg", factor: MMHG, unit: "mmHg" } },
  "saffire-i": { table: "PSI-98-0", oxygenPct: { column: "Percent O2", factor: 1, unit: "vol %" }, airflowMs: { column: "Air Flow (cm/s)", factor: 0.01, unit: "cm/s" }, materialColumn: "Material", directionColumn: "Flow Direction " },
  "saffire-ii": { table: "PSI-99-0", oxygenPct: { column: "Percent O2 (Note 1)", factor: 1, unit: "vol %" }, airflowMs: { column: "Air Flow (cm/s)", factor: 0.01, unit: "cm/s" }, materialColumn: "Material", directionColumn: "Flow Direction" },
  "saffire-iii": { table: "PSI-100-0", airflowMs: { column: "Air Flow ", factor: 0.01, unit: "cm/s" }, materialColumn: "Material", directionColumn: "Direction" },
  "same-r": { table: "PSI-101-0", airflowMs: { column: "Inlet velocity (cm/s)", factor: 0.01, unit: "cm/s" } },
  same: { table: "PSI-102-0", airflowMs: { column: "Air Flow (cm/s)", factor: 0.01, unit: "cm/s" } },
  spice: { table: "PSI-107-0", airflowMs: { column: "Air Rate (cm/s)", factor: 0.01, unit: "cm/s" } },
  "acme-cfi-g": { table: "PSI-159-0", oxygenPct: { column: " XO2 before test", factor: 100, unit: "mole fraction" }, pressurePsi: { column: "approx p (bar)", factor: BAR, unit: "bar" } },
};

const MATERIALS = [
  ["Cotton-fiberglass fabric", /sibal|cotton/i],
  ["Nomex", /nomex/i],
  ["PMMA", /pmma/i],
  ["Silicone", /silicone/i],
  ["Ultem", /ultem/i],
];

const round = (v) => Math.round(v * 100) / 100;
const profiles = {};

for (const [id, map] of Object.entries(MAPPINGS)) {
  const meta = manifest.tables.find((t) => t.id === map.table);
  if (!meta) throw new Error(`Table ${map.table} is not in the manifest; run npm run sync:tables`);
  const table = JSON.parse(readFileSync(`src/data/tables/${map.table}.json`, "utf8"));
  const col = (name) => {
    const i = table.header.indexOf(name);
    if (i < 0) throw new Error(`Schema changed: ${map.table} has no column ${JSON.stringify(name)}`);
    return i;
  };
  const out = { accession: meta.accession, table: meta.id, file: meta.file, sha256: meta.sha256, totalRows: meta.rows, conditions: {} };

  for (const key of ["oxygenPct", "pressurePsi", "airflowMs"]) {
    const m = map[key];
    if (!m) continue;
    const i = col(m.column);
    const values = [];
    let rowsUsed = 0, dropped = 0, approx = false;
    for (const r of table.rows) {
      const parsed = (m.parse ?? parseCell)(r.cells[i]);
      const converted = parsed.values.map((v) => v * m.factor);
      const ok = converted.filter(LIMITS[key]);
      dropped += converted.length - ok.length;
      if (ok.length) { rowsUsed++; values.push(...ok); approx ||= parsed.approx; }
    }
    if (!values.length) continue;
    out.conditions[key] = {
      min: round(Math.min(...values)),
      max: round(Math.max(...values)),
      column: m.column.trim(),
      sourceUnit: m.unit,
      factor: m.factor,
      parser: m.parse ? "pctO2InText" : "parseCell",
      rowsUsed,
      dropped,
      approx,
    };
  }

  if (map.materialColumn) {
    const i = col(map.materialColumn);
    const names = new Set();
    for (const r of table.rows) for (const [name, re] of MATERIALS) if (re.test(r.cells[i] ?? "")) names.add(name);
    out.materials = [...names].sort();
  } else if (id === "bass-ii") {
    out.materials = table.rows.some((r) => /pmma/i.test(r.cells[col("Fuel Sample Material")])) ? ["PMMA"] : [];
  }
  if (map.directionColumn) {
    const i = col(map.directionColumn);
    const dirs = new Set(table.rows.map((r) => (r.cells[i] ?? "").trim().toLowerCase()).filter((d) => d === "opposed" || d === "concurrent"));
    out.flowDirections = [...dirs].sort();
  }
  profiles[id] = out;
}

writeFileSync(
  "src/data/normalized-conditions.json",
  JSON.stringify(
    {
      method:
        "Scalar cells with a stated unit only. Lists and 'a - b' ranges contribute both ends; '~' marks a value as approximate. Ranges are marginal envelopes per condition, not joint coverage or a continuous test matrix.",
      profiles,
    },
    null,
    2,
  ) + "\n",
);
for (const [id, p] of Object.entries(profiles)) {
  console.log(id.padEnd(18), Object.entries(p.conditions).map(([k, c]) => `${k} ${c.min}–${c.max} (${c.rowsUsed}/${p.totalRows} rows${c.dropped ? `, ${c.dropped} dropped` : ""})`).join(" · "), p.materials ? `materials: ${p.materials.join(", ")}` : "", p.flowDirections ? `flow: ${p.flowDirections.join(", ")}` : "");
}
