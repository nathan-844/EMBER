// Runs the test suite and records a credibility report the app can display.
// Usage: npm run verify:report
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "ember-"));
const out = join(dir, "vitest.json");
try {
  execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], { stdio: "inherit", shell: process.platform === "win32" });
} catch {
  // Failures are recorded in the report rather than aborting.
}
const result = JSON.parse(readFileSync(out, "utf8"));

const dataFiles = [
  "src/data/investigations.ts",
  "src/data/types.ts",
  "src/data/psi-snapshot.json",
  "src/data/table-manifest.json",
  "src/data/normalized-conditions.json",
  "src/data/atlas/atlas.json",
  "src/data/findings.json",
  "src/data/atlas/audit.json",
  "src/data/ntrs-manifest.json",
];
const fingerprint = createHash("sha256");
for (const f of dataFiles) fingerprint.update(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));

// The verification scoreboard: tests plus source checks (scripts/scoreboard.ts), re-run where they need no network.
const scoreboard = [
  {
    id: "tests", label: "Automated tests passing", how: "rerun",
    checked: result.numTotalTests, passed: result.numPassedTests,
    method: "The full Vitest suite: ranking rules, data checks, quote checks, the AI claim checker and the server.",
  },
  ...JSON.parse(execFileSync("npx", ["tsx", "scripts/scoreboard.ts"], { encoding: "utf8", shell: process.platform === "win32" })),
];

// Which code and data these results belong to. The report is written before it is committed, so it
// cannot name its own commit: it records the parent commit and a hash of the exact source tree
// tested (every tracked or new file except this report), which identifies the code either way.
const git = (args, input) => execFileSync("git", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 64 << 20 });
let code = null;
try {
  const files = git(["ls-files", "-co", "--exclude-standard"]).split("\n").filter((f) => f && f !== "src/data/verify-report.json").sort();
  const blobs = git(["hash-object", "--stdin-paths"], files.join("\n") + "\n").trim().split("\n");
  const tree = createHash("sha256");
  files.forEach((f, i) => tree.update(`${f}\0${blobs[i]}\n`));
  code = {
    parentCommit: git(["rev-parse", "HEAD"]).trim(),
    sourceTreeSha256: tree.digest("hex"),
    files: files.length,
    uncommittedChanges: git(["status", "--porcelain"]).split("\n").filter((l) => l && !l.endsWith("src/data/verify-report.json")).length,
  };
} catch {
  // Not a git checkout: the report still records the data snapshot below.
}
const counts = JSON.parse(readFileSync("src/data/counts.json", "utf8"));

const report = {
  recordedAt: new Date().toISOString().slice(0, 10),
  node: process.version,
  code,
  dataSnapshot: { id: counts.snapshot.id, sha256: counts.snapshot.sha256 },
  tests: {
    passed: result.numPassedTests,
    failed: result.numFailedTests,
    total: result.numTotalTests,
    files: result.testResults.length,
    names: result.testResults.flatMap((f) =>
      f.assertionResults.map((a) => ({ file: relative(process.cwd(), f.name).replace(/\\/g, "/").replace(/^src\//, ""), title: a.fullName, status: a.status })),
    ),
  },
  dataFingerprint: { algorithm: "sha256", files: dataFiles, value: fingerprint.digest("hex") },
  scoreboard,
};

writeFileSync("src/data/verify-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(`Recorded ${report.tests.passed}/${report.tests.total} passing checks (${report.tests.files} files).`);
