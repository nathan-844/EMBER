// Writes src/data/counts.json: every count the app and docs show, and the snapshot identity that
// exports carry. Run by `npm run data:atlas` after the atlas, audit and findings are built.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { INVESTIGATIONS } from "../src/data/investigations";
import { NTRS_QUOTES, NTRS_SOURCES } from "../src/data/ntrs-evidence";
import { computeCounts } from "../src/lib/counts";

// The data a result depends on. Hashed with line endings normalised, so the id is the same on every platform.
const FILES = [
  "src/data/table-manifest.json",
  "src/data/atlas/atlas.json",
  "src/data/atlas/audit.json",
  "src/data/findings.json",
  "src/data/psi-snapshot.json",
  "src/data/ntrs-manifest.json",
  "src/data/normalized-conditions.json",
];
const text = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const hash = createHash("sha256");
for (const f of FILES) hash.update(f).update("\0").update(text(f)).update("\0");
const json = (p: string) => JSON.parse(text(p));

const manifest = json("src/data/table-manifest.json");
const counts = computeCounts({
  atlas: json("src/data/atlas/atlas.json"),
  audit: json("src/data/atlas/audit.json"),
  findings: json("src/data/findings.json"),
  tables: manifest.tables,
  tablesSyncedOn: manifest.syncedOn,
  psi: json("src/data/psi-snapshot.json"),
  profiles: INVESTIGATIONS.length,
  quotes: { sources: NTRS_SOURCES, count: NTRS_QUOTES.length },
  snapshot: { sha256: hash.digest("hex"), files: FILES },
});
writeFileSync("src/data/counts.json", JSON.stringify(counts, null, 1) + "\n");
console.log(`Counts for snapshot ${counts.snapshot.id}: ${counts.rows.total} source rows, ${counts.observations.testRows} test rows, ${counts.experiments.total} experiments, ${counts.findings.count} findings`);
