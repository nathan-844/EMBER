// Computes the measured findings from the Fire Test Atlas into src/data/findings.json, and the rows
// they cite (with NASA's raw cells) into src/data/findings-rows.json for the Findings page.
// Usage: npm run data:findings (run npm run data:atlas first if the atlas rules changed)
import { writeFileSync } from "node:fs";
import manifest from "../src/data/table-manifest.json";
import { TABLES } from "../src/data/tables";
import { buildAtlas } from "../src/lib/atlas/build";
import { computeFindings } from "../src/lib/findings";
import { citedRows } from "../src/lib/findings/rows";

const atlas = buildAtlas(TABLES, manifest);
const findings = computeFindings(atlas);
writeFileSync("src/data/findings.json", JSON.stringify(findings, null, 1) + "\n");
writeFileSync("src/data/findings-rows.json", JSON.stringify(citedRows(atlas, findings)) + "\n");
for (const f of findings.findings) console.log(`${f.id} (${f.n} tests) ${f.title}\n   ${f.claim}\n`);
