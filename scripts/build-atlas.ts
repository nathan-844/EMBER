// Builds the EMBER Fire Test Atlas (src/data/atlas/atlas.json and atlas.csv) from the stored
// NASA PSI tables and the NTRS Saffire IV–VI runs. Usage: npm run data:atlas
import { mkdirSync, writeFileSync } from "node:fs";
import manifest from "../src/data/table-manifest.json";
import { TABLES } from "../src/data/tables";
import { buildAudit } from "../src/lib/atlas/audit";
import { atlasCsv, buildAtlas } from "../src/lib/atlas/build";
import { compactAtlas } from "../src/lib/atlas/compact";

const atlas = buildAtlas(TABLES, manifest);
mkdirSync("src/data/atlas", { recursive: true });
writeFileSync("src/data/atlas/atlas.json", JSON.stringify(atlas, null, 1) + "\n");
writeFileSync("src/data/atlas/atlas.csv", atlasCsv(atlas));
const audit = buildAudit(atlas, TABLES);
writeFileSync("src/data/atlas/audit.json", JSON.stringify(audit, null, 1) + "\n");

writeFileSync("src/data/atlas/atlas-rows.json", JSON.stringify(compactAtlas(atlas)) + "\n");

const { counts } = atlas;
console.log(`Atlas ${atlas.version}: ${counts.rows} rows`);
console.log("  by kind:", counts.byKind);
console.log("  by fuel class:", counts.byFuelClass);
console.log("  by outcome:", counts.byOutcome);
console.log(`Audit: ${audit.totals.issues} issues in ${audit.totals.tablesAffected} of ${audit.totals.tablesChecked} tables`, audit.totals);
