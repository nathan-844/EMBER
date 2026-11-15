import { TABLES } from "../../data/tables";
import manifest from "../../data/table-manifest.json";
import { PSI_SNAPSHOT } from "../../data/psi";
import { SAFFIRE_NTRS_SOURCE } from "../../data/ntrs-saffire";
import { RESEARCH_ATLAS } from "./research-data";
import { researchAtlas } from "../atlas/research";
import { computeFindings } from "../findings";
import { SNAPSHOT } from "../snapshot";
import { compareWorkbench, type WorkbenchSpec } from "./workbench";
import { sha256 } from "./export";
import license from "../../../LICENSE?raw";
export { RESEARCH_ATLAS } from "./research-data";
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
export async function researchPackage(engine: string, spec: WorkbenchSpec | null) {
  if (spec && spec.snapshot !== SNAPSHOT.id) throw new Error("Dataset snapshot mismatch. Use the original package.");
  const comparison = spec ? compareWorkbench(RESEARCH_ATLAS.rows, spec) : null;
  if (comparison?.status === "blocked") throw new Error(comparison.errors.join(" "));
  const expected = { findings: computeFindings(RESEARCH_ATLAS), comparison };
  const files: Record<string, string> = {
    "analysis.json": json({ snapshot: SNAPSHOT, spec, extraction: "atlas-v1", researchSchema: "atlas-research-v2", numericalTolerance: 0, uncertainty: { seed: 20261115, replicates: 2000, method: "percentile bootstrap or exact paired sign test, as stated in the result", independentSessions: "unknown", measurementUncertainty: "not modeled" } }),
    "raw-tables.json": json(TABLES), "table-manifest.json": json(manifest),
    "atlas-research-v2.json": json(researchAtlas(RESEARCH_ATLAS, TABLES)),
    "expected-results.json": json(expected), "engine.mjs": engine, "LICENSE.txt": license,
    "source-manifest.json": json({ psi: PSI_SNAPSHOT, ntrs: SAFFIRE_NTRS_SOURCE, workbook: manifest.tables.find((t) => t.id === "PSI-101-1"), licenseNote: "Use each record's own license; null is unknown, not CC0. Original workbook/PDF bytes are not bundled. The package preserves extracted raw cell strings and original hashes; it does not reproduce PDF/OCR or workbook formula evaluation." }),
    "included.json": json(spec ? comparison!.used : expected.findings.findings.map((f) => ({ finding: f.id, observationIds: f.rows, denominator: f.n, unit: f.unit ?? "observations" }))),
    "excluded.json": json(spec ? comparison!.excluded : expected.findings.findings.map((f) => ({ finding: f.id, exclusions: f.excluded, note: "Legacy findings expose aggregate exclusion reasons; source tables and engine reconstruct the selection. F8 also records excluded pair IDs." }))),
    "README.md": `# EMBER reusable research package\n\nExtract all files. With Node.js 22+, run: node reproduce.mjs\n\nNo server, npm dependencies, internet or AI key needed. The runner verifies hashes, rebuilds the Atlas from preserved raw tables and bundled NTRS transcription, recomputes all eight findings and the optional selected comparison, and compares every unrounded result exactly. It also verifies the additive research-v2 view. Outputs reproduced-results.json. Original workbook/PDF bytes are not bundled: this is calculation and normalization reproduction, not independent source extraction.\n\nSnapshot ${SNAPSHOT.id}. Definitions and uncertainty assumptions are in each finding/result. F8 preserves paired fresh/aged observations and excludes ambiguous/invalid pairs. All-eight export reproduces published definitions; it does not replace them with M1's stricter BASS policy. Source licenses are per-record; unknown licenses remain unknown. Code: MIT, LICENSE.txt.\n\nThe v2 view distinguishes stable source labels, snapshot row locators, reviewed experiment IDs, paired endpoint relationships, and unknown sessions. Numeric gravity and measurement uncertainty stay unknown when unreported; ranges and bounds retain their semantics. It is additive and leaves legacy findings unchanged. SHA-256 checks detect corruption, not authenticity.\n`,
    "reproduce.mjs": `import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const base = new URL('./', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, base), 'utf8'));
for (const [name, hash] of Object.entries(await read('checksums.json'))) {
  if (!/^[\\w.-]+$/.test(name)) throw new Error('Invalid file path');
  if (createHash('sha256').update(await readFile(new URL(name, base))).digest('hex') !== hash) throw new Error('Checksum mismatch: ' + name);
}
const { buildAtlas, researchAtlas, computeFindings, compareWorkbench } = await import('./engine.mjs');
const tables = await read('raw-tables.json'), manifest = await read('table-manifest.json'), analysis = await read('analysis.json');
if (analysis.spec && analysis.spec.snapshot !== analysis.snapshot.id) throw new Error('Snapshot mismatch');
const atlas = buildAtlas(tables, manifest);
const actual = { findings: computeFindings(atlas), comparison: analysis.spec ? compareWorkbench(atlas.rows, analysis.spec) : null };
if (!isDeepStrictEqual(actual, await read('expected-results.json'))) throw new Error('Computed result mismatch');
if (!isDeepStrictEqual(researchAtlas(atlas, tables), await read('atlas-research-v2.json'))) throw new Error('Research schema mismatch');
await writeFile(new URL('reproduced-results.json', base), JSON.stringify(actual, null, 2));
console.log('PASS: all eight findings, selected comparison and research-v2 schema reproduced exactly.');
`,
  };
  files["checksums.json"] = json(Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, data]) => [name, await sha256(data)]))));
  return files;
}
