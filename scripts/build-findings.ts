// Computes the measured findings from the Fire Test Atlas into src/data/findings.json.
// Usage: npm run data:findings (run npm run data:atlas first if the atlas rules changed)
import { writeFileSync } from "node:fs";
import manifest from "../src/data/table-manifest.json";
import { TABLES } from "../src/data/tables";
import { buildAtlas } from "../src/lib/atlas/build";
import { computeFindings } from "../src/lib/findings";

const findings = computeFindings(buildAtlas(TABLES, manifest));
writeFileSync("src/data/findings.json", JSON.stringify(findings, null, 1) + "\n");
for (const f of findings.findings) console.log(`${f.id} (${f.n} tests) ${f.title}\n   ${f.claim}\n`);
