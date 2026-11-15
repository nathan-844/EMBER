import { TABLES } from "../../data/tables";
import manifest from "../../data/table-manifest.json";
import { PSI_SNAPSHOT } from "../../data/psi";
import { SAFFIRE_NTRS_SOURCE } from "../../data/ntrs-saffire";
import { RESEARCH_ATLAS } from "./research-data";
import { missionReport, type MissionSpec } from "./mission";
import { sha256 } from "./export";
import license from "../../../LICENSE?raw";
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
export async function missionPackage(engine: string, spec: MissionSpec) {
  const files: Record<string, string> = {
    "mission.json": json(spec), "expected-results.json": json(missionReport(RESEARCH_ATLAS.rows, spec)),
    "raw-tables.json": json(TABLES), "table-manifest.json": json(manifest), "engine.mjs": engine, "LICENSE.txt": license,
    "source-manifest.json": json({ psi: PSI_SNAPSHOT, ntrs: SAFFIRE_NTRS_SOURCE, enrichment: "Mission v1 recovers thickness from explicit thickness measures, material labels and the Saffire VI source labels (cm × 10). No missing pressure or numeric gravity is filled. Source bytes not included; hashes/locators preserved. Unknown licenses are not CC0." }),
    "README.md": `# EMBER mission evidence and proposed tests\n\nRun node reproduce.mjs with Node.js 22+. No npm, network, server or AI key. Checksums are checked before rebuilding the Atlas and rerunning every A/B classification, exclusion, sensitivity, Pareto set and greedy planner step. Results must match exactly.\n\nThis reproduces calculations from preserved source cells, not independent PDF/workbook extraction. Source locators, hashes and licenses are in source-manifest.json and table-manifest.json. Code is MIT.\n\nDocumented match refers only to selected conditions within adjustable rectangular windows. Full reported intervals/levels must fit. Unselected fields are not verified. Material name does not certify formulation identity. Missing values are never zero or evidence that a test never happened. Unknown numeric gravity, session dependence and measurement uncertainty remain unknown. Distances are not probabilities. Pareto uses only documented observations and the selected continuous dimensions.\n\nPlanner candidates and costs are user assumptions, never NASA observations. Greedy marginal coverage/cost is not optimal experimental design or expected information gain. Unknown feasibility is conditional and can be excluded. No assembly combustion prediction, risk probability or safety certification. Results include all included/excluded row IDs and reasons. SHA-256 detects corruption, not authenticity.\n`,
    "reproduce.mjs": `import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const base = new URL('./', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, base), 'utf8'));
for (const [name, hash] of Object.entries(await read('checksums.json'))) {
  if (!/^[\\w.-]+$/.test(name)) throw new Error('Invalid file name');
  if (createHash('sha256').update(await readFile(new URL(name, base))).digest('hex') !== hash) throw new Error('Checksum mismatch: ' + name);
}
const { buildAtlas, missionReport } = await import('./engine.mjs');
const atlas = buildAtlas(await read('raw-tables.json'), await read('table-manifest.json'));
const actual = missionReport(atlas.rows, await read('mission.json'));
if (!isDeepStrictEqual(actual, await read('expected-results.json'))) throw new Error('Reproduction mismatch');
await writeFile(new URL('reproduced-results.json', base), JSON.stringify(actual, null, 2));
console.log('PASS: mission evidence, sensitivity, Pareto sets and proposed-test coverage reproduced exactly.');
`,
  };
  files["checksums.json"] = json(Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, data]) => [name, await sha256(data)]))));
  return files;
}
