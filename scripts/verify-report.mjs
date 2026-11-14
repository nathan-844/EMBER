// Runs the test suite and records a credibility report the app can display.
// Usage: npm run verify:report
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "ember-"));
const out = join(dir, "vitest.json");
try {
  execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], { stdio: "inherit" });
} catch {
  // Failures are recorded in the report rather than aborting.
}
const result = JSON.parse(readFileSync(out, "utf8"));

const dataFiles = ["src/data/investigations.ts", "src/data/types.ts"];
const fingerprint = createHash("sha256");
for (const f of dataFiles) fingerprint.update(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));

const report = {
  recordedAt: new Date().toISOString().slice(0, 10),
  node: process.version,
  tests: {
    passed: result.numPassedTests,
    failed: result.numFailedTests,
    total: result.numTotalTests,
    files: result.testResults.length,
    names: result.testResults.flatMap((f) =>
      f.assertionResults.map((a) => ({ file: f.name.split(/[\\/]src[\\/]/).pop(), title: a.fullName, status: a.status })),
    ),
  },
  dataFingerprint: { algorithm: "sha256", files: dataFiles, value: fingerprint.digest("hex") },
};

writeFileSync("src/data/verify-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(`Recorded ${report.tests.passed}/${report.tests.total} passing checks (${report.tests.files} files).`);
