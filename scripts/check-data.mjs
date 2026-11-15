// Rebuilds every derived data file from the stored NASA tables and fails if any committed file
// differs, so the data in the repository can always be reproduced from its sources.
// Usage: npm run data:check (CI runs it on every push)
import { execFileSync } from "node:child_process";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
run("node", ["scripts/normalize-conditions.mjs"]);
run("node", ["scripts/index-tables.mjs"]);
run("npx", ["tsx", "scripts/build-atlas.ts"]);
run("npx", ["tsx", "scripts/build-findings.ts"]);

// verify-report.json records a date and a test run, so it is not part of this check.
// `git diff` compares content after line-ending normalisation, so a CRLF checkout does not count as a change.
const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const changed = (git(["diff", "--name-only", "--", "src/data"]) + git(["ls-files", "--others", "--exclude-standard", "--", "src/data"]))
  .split("\n")
  .filter((l) => l.trim() && !l.includes("verify-report.json"));
if (changed.length) {
  console.error("\nDerived data is out of date. Run `npm run data:all` and commit the result:\n" + changed.join("\n"));
  process.exit(1);
}
console.log("\nDerived data matches a fresh rebuild.");
