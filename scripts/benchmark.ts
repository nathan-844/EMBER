import { writeFileSync } from "node:fs";
import { runBenchmark } from "../src/lib/analysis/benchmark";
const report = runBenchmark();
const path = process.argv[2];
if (path) writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(`${report.passed}/${report.total} deterministic cases pass. Live AI and citation entailment are not evaluated.`);
for (const r of report.results.filter((r) => !r.passed)) console.error(r.id, r.question, { expected: r.expected, actual: r.actual, error: r.error });
if (report.passed !== report.total) process.exitCode = 1;
