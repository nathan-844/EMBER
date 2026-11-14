// Downloads the public experimental (run) tables attached to each linked NASA PSI
// investigation and stores them byte-for-byte with a SHA-256 for every file.
// Usage: npm run sync:tables                 (needs network access to psi.nasa.gov)
//        npm run sync:tables -- --from DIR    (import an earlier PSI download: DIR holds
//        table-manifest.json and tables/<id>.csv; every file must match its recorded SHA-256)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://psi.nasa.gov";
const OUT = "src/data/tables";
// Keep in step with PSI_ACCESSIONS in src/data/investigations.ts.
const ACCESSIONS = [10, 20, 21, 22, 23, 25, 26, 39, 47, 68, 69, 98, 99, 100, 101, 102, 106, 107, 159].map((n) => `PSI-${n}`);

/** RFC 4180 CSV parser that keeps embedded newlines and escaped quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if (c === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

mkdirSync(OUT, { recursive: true });
const tables = [];
const errors = [];
const fromIdx = process.argv.indexOf("--from");
const fromDir = fromIdx > 0 ? process.argv[fromIdx + 1] : null;

function store(id, accession, file, version, bytes, origin) {
  const [header = [], ...body] = parseCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  const rows = body.map((cells, i) => ({ sourceRow: i + 2, cells })).filter((r) => r.cells.some((c) => c.trim()));
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify({ header, rows }));
  tables.push({
    id,
    accession,
    file,
    version,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    rows: rows.length,
    columns: header,
    url: `${BASE}/physci/repo/data/investigations/${accession}`,
    origin,
  });
  console.log(`${id}: ${rows.length} rows · ${file}`);
}

if (fromDir) {
  const manifest = JSON.parse(readFileSync(join(fromDir, "table-manifest.json"), "utf8"));
  for (const t of manifest.tables) {
    if (!ACCESSIONS.includes(t.accession)) continue;
    const path = join(fromDir, "tables", `${t.id}.csv`);
    if (!existsSync(path)) { errors.push({ accession: t.accession, file: t.name, error: "missing local copy" }); continue; }
    const bytes = readFileSync(path);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== t.sha256) { errors.push({ accession: t.accession, file: t.name, error: "SHA-256 mismatch" }); continue; }
    store(t.id, t.accession, t.name, t.version, bytes, `PSI download of ${String(manifest.accessed).slice(0, 10)}, imported offline with matching SHA-256`);
  }
}

for (const accession of fromDir ? [] : ACCESSIONS) {
  let study;
  try {
    study = await getJson(`${BASE}/geode-py/ws/repo/investigations/${accession}`);
  } catch (e) {
    errors.push({ accession, error: String(e) });
    console.log(`Unavailable: ${accession}`);
    continue;
  }
  const files = (study.experimentalTable ?? []).filter(
    (f) => /\.csv$/i.test(f.file_name) && !f.restricted,
  );
  for (const [index, f] of files.entries()) {
    const id = `${accession}-${index}`;
    try {
      const link = `${BASE}/geode-py/ws/studies/${accession}/download?file=${f._id.$oid}&version=${f.version}&redirect=false`;
      const r = await fetch(link, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error(`PSI ${r.status}`);
      const url = (await r.text()).trim().replace(/^"|"$/g, "");
      const file = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!file.ok) throw new Error(`File ${file.status}`);
      store(id, accession, f.file_name, f.version, Buffer.from(await file.arrayBuffer()), "Live PSI download");
    } catch (e) {
      errors.push({ accession, file: f.file_name, error: String(e) });
      console.log(`Failed: ${id} ${e}`);
    }
  }
}

writeFileSync(
  "src/data/table-manifest.json",
  JSON.stringify({ syncedOn: new Date().toISOString().slice(0, 10), tables, errors }, null, 2) + "\n",
);
console.log(`Saved ${tables.length} tables (${errors.length} errors).`);
