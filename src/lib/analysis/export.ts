import { analyze, sensitivity, LIMITATIONS, type AnalysisSpec } from "./engine";
import { assertSnapshot, OBSERVATIONS, RAW_TABLE } from "./bass";
import { REFERENCES, SOURCE_MANIFEST } from "./review";
import license from "../../../LICENSE?raw";

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
function csv(rows: unknown[][]) {
  return rows.map((row) => row.map((value) => {
    let s = value === null || value === undefined ? "" : String(value);
    if (/^[=+@-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n") + "\r\n";
}
export async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function packageFiles(spec: AnalysisSpec, engine: string, history: AnalysisSpec[] = []) {
  assertSnapshot(spec);
  const result = analyze(OBSERVATIONS, spec);
  if (result.status === "blocked") throw new Error(result.messages.join(" "));
  const files: Record<string, string> = {
    "analysis.json": json(spec), "filter-history.json": json(history),
    "analysis-schema.json": json({
      $schema: "https://json-schema.org/draft/2020-12/schema", title: "EMBER BASS-II analysis v1", type: "object",
      required: ["schemaVersion", "method", "dataset", "reviewVersion", "question", "outcome", "a", "b", "oxygen", "sourceMode", "excludeQuestionable", "seed", "replicates"],
      properties: {
        schemaVersion: { const: 1 }, method: { const: spec.method }, dataset: { const: spec.dataset }, reviewVersion: { const: spec.reviewVersion },
        question: { type: "string" }, outcome: { const: "final-minus-initial-co-ppm" },
        a: { enum: ["PMMA slab", "SIBAL fabric"] }, b: { enum: ["PMMA slab", "SIBAL fabric"] },
        oxygen: { type: "array", minItems: 2, maxItems: 2, items: { type: "number", minimum: 0, maximum: 100 } },
        sourceMode: { enum: ["raw", "reviewed"] }, excludeQuestionable: { type: "boolean" },
        seed: { type: "integer", minimum: 0, maximum: 4294967295 }, replicates: { type: "integer", minimum: 100, maximum: 10000 },
      }, $comment: "Engine additionally requires different cohorts and an ordered oxygen window.",
    }),
    "observations.json": json(OBSERVATIONS), "raw-table.json": json(RAW_TABLE),
    "observations.csv": csv([["id", "test", "cohort", "CO start (ppm)", "CO end (ppm)", "CO change (ppm)", "initial O2 (vol%)", "final O2 (vol%)", "raw material / geometry", "raw air display", "PSI source row", "report PDF page", "review"], ...result.used.map((used) => {
      const r = OBSERVATIONS.find((o) => o.id === used.id)!;
      return [r.id, r.test, used.cohort, r.coStart, r.coEnd, used.delta, r.o2Start, r.o2End, r.material, r.flowRaw, r.sourceRow, r.review.page, r.review.status];
    })]),
    "excluded.csv": csv([["id", "test", "raw CO start", "raw CO end", "reasons"], ...result.excluded.map((excluded) => {
      const r = OBSERVATIONS.find((o) => o.id === excluded.id)!;
      return [r.id, r.test, r.coStartRaw, r.coEndRaw, excluded.reasons.join("; ")];
    })]),
    "source-manifest.json": json({ dataset: spec.dataset, ...SOURCE_MANIFEST, references: REFERENCES }),
    "expected-results.json": json({ result, sensitivity: sensitivity(OBSERVATIONS, spec) }),
    "engine.mjs": engine, "LICENSE.txt": license,
    "reproduce.mjs": `import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const base = new URL('./', import.meta.url);
const read = (name) => readFile(new URL(name, base), 'utf8');
const checks = JSON.parse(await read('checksums.json'));
for (const [name, expected] of Object.entries(checks)) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('Invalid package path');
  const actual = createHash('sha256').update(await read(name)).digest('hex');
  if (actual !== expected) throw new Error('Checksum mismatch: ' + name);
}
const { analyze, sensitivity, makeObservations, validateSpec } = await import('./engine.mjs');
const spec = JSON.parse(await read('analysis.json'));
const manifest = JSON.parse(await read('source-manifest.json'));
if (spec.dataset !== manifest.dataset || spec.reviewVersion !== manifest.reviewVersion) throw new Error('Snapshot mismatch');
if (validateSpec(spec).length) throw new Error(validateSpec(spec).join('; '));
const rows = makeObservations(JSON.parse(await read('raw-table.json')));
if (!isDeepStrictEqual(rows, JSON.parse(await read('observations.json')))) throw new Error('Raw-to-normalized observation mismatch');
const actual = { result: analyze(rows, spec), sensitivity: sensitivity(rows, spec) };
if (!isDeepStrictEqual(actual, JSON.parse(await read('expected-results.json')))) throw new Error('Result mismatch');
await writeFile(new URL('reproduced-results.json', base), JSON.stringify(actual, null, 2) + '\\n');
console.log('PASS: checksums, raw-cell normalization, comparison and sensitivity reproduced exactly.');
console.log('A n=' + actual.result.a.n + ', B n=' + actual.result.b.n + ', median difference=' + actual.result.difference + ' ppm');
`,
    "README.md": `# EMBER BASS-II comparison\n\nUnzip the entire folder. With Node.js 22 or later installed, run:\n\n\`\`\`sh\nnode reproduce.mjs\n\`\`\`\n\nNo npm install, web server, network access or AI key required. The runner verifies included file hashes, reconstructs the 47 candidate observations from all 129 stored PSI table rows, then recomputes the comparison and every sensitivity policy with the same bundled engine as EMBER. It compares the complete unrounded result exactly and writes reproduced-results.json. A mismatch exits with an error.\n\nSnapshot: ${spec.dataset}; review: ${spec.reviewVersion}; method: ${spec.method}; seed: ${spec.seed}; bootstrap replicates: ${spec.replicates}.\n\nanalysis.json stores the exact controls. observations.csv contains included rows; excluded.csv contains every excluded row and all reasons. observations.json includes all candidates. raw-table.json preserves original PSI cell strings (including missing/bounded readings). source-manifest.json contains report transcriptions, locators, source hashes and review limits. Filter history is local to this page session, not a preregistered plan.\n\nCO change is final minus initial ppm; oxygen is vol%. The estimand is median(A) minus median(B). Negative readings are preserved unless excluded by policy. The interval is the interpolated 2.5th–97.5th percentile of seeded observation bootstrap differences. No interval is returned without overlapping oxygen or two distinct changes in each group.\n\nPackage SHA-256 hashes detect accidental changes, not authenticity. Original CSV/PDF hashes identify upstream snapshots; original PDF/CSV bytes are not bundled. Preserved JSON cells support recalculation, not verification of a fresh NASA download.\n\n## Limits\n\n${LIMITATIONS.map((s) => "- " + s).join("\n")}\n\nReview covers four gas cells per candidate and material context. T23 remains unresolved. No numeric corrections were justified; reconciled mode is an eligibility overlay, not replacement measurements.\n\n## Reuse\n\nPSI-25 metadata: CC0-1.0, DOI https://doi.org/${SOURCE_MANIFEST.psi.doi}. Code: EMBER (MIT), see LICENSE.txt. Cite NASA's dataset/reports and identify the EMBER snapshot/method.\n`,
    "units.json": json({ coStart: "ppm", coEnd: "ppm", delta: "ppm; final minus initial", o2Start: "vol%", o2End: "vol%", interval: "ppm; median(A) minus median(B)", missing: "null means no exact scalar; censored values retain raw strings", sourceRow: "PSI CSV row, header = 1", page: "PDF page, one-based" }),
  };
  const hashes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, value]) => [name, await sha256(value)])));
  files["checksums.sha256"] = Object.entries(hashes).map(([name, hash]) => `${hash}  ${name}`).join("\n") + "\n";
  files["checksums.json"] = json({ ...hashes, "checksums.sha256": await sha256(files["checksums.sha256"]) });
  return files;
}

/** ZIP method 0 (stored), UTF-8; fixed 1980-01-01 timestamp for reproducible bytes. */
export function zipFiles(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder(), chunks: Uint8Array[] = [], directory: Uint8Array[] = [];
  let offset = 0;
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;
    for (const b of bytes) { crc ^= b; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  for (const [name, contents] of Object.entries(files)) {
    const filename = encoder.encode(name), body = encoder.encode(contents), crc = crc32(body);
    const local = new Uint8Array(30 + filename.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, body.length, true); l.setUint32(22, body.length, true); l.setUint16(26, filename.length, true); local.set(filename, 30);
    const central = new Uint8Array(46 + filename.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, body.length, true); c.setUint16(28, filename.length, true); c.setUint32(42, offset, true); central.set(filename, 46);
    chunks.push(local, body); directory.push(central); offset += local.length + body.length;
  }
  const dirLength = directory.reduce((n, b) => n + b.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length, true); e.setUint16(10, directory.length, true); e.setUint32(12, dirLength, true); e.setUint32(16, offset, true);
  const zip = new Uint8Array(offset + dirLength + end.length);
  let p = 0; for (const chunk of [...chunks, ...directory, end]) { zip.set(chunk, p); p += chunk.length; }
  return zip;
}
