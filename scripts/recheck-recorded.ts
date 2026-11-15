// Re-checks every recorded answer against today's evidence package with the same checker the live
// pipeline uses. A claim that no longer passes is kept but marked rejected, with the reason, as a
// live answer would show it. An answer whose summary no longer passes, or that has no claim left,
// is removed so the app never replays it; re-record it with a key (npm run record:demo).
// Run after any change to data, ranking or checker rules.   Usage: npm run recheck:recorded
import { readFileSync, writeFileSync } from "node:fs";
import { serverPackage } from "../server/analyze";
import { checkAnswer, type GroundingReport, type ModelAnswer } from "../src/lib/grounding";
import { PRESETS, presetScenario, type Scenario } from "../src/lib/scenario";
import { scenarioKey } from "../src/lib/recorded";

const path = "src/data/recorded-analyses.json";
const store = JSON.parse(readFileSync(path, "utf8")) as { recordedOn: string | null; recheckedOn?: string; entries: Record<string, { report: GroundingReport; ranked: unknown } & Record<string, unknown>> };
const byKey = new Map<string, Scenario>(
  PRESETS.flatMap((p) => (["prevention", "detection", "suppression"] as const).map((q) => {
    const s = { ...presetScenario(p.id), question: q };
    return [scenarioKey(s), s] as const;
  })),
);
const today = new Date().toISOString().slice(0, 10);
const removed: string[] = [];
let marked = 0;

for (const [key, entry] of Object.entries(store.entries)) {
  const scenario = byKey.get(key.split("|ask:")[0]);
  if (!scenario) { removed.push(`${key} (not a preset)`); delete store.entries[key]; continue; }
  const pkg = serverPackage(scenario);
  const claims = entry.report.claims;
  // An answer that discusses the ranking is stale once the top study has changed.
  const storedTop = (entry.ranked as { id: string }[] | undefined)?.[0]?.id;
  const talksRanking = /\brank|top match|ranked first|leads? the|first place/i.test(
    [entry.report.summary.text, ...claims.filter((c) => c.accepted).map((c) => `${c.text} ${c.implication}`)].join(" "),
  );
  if (storedTop && storedTop !== pkg.ranked[0]?.id && talksRanking) {
    removed.push(`${key} (discusses the ranking; top study was ${storedTop}, now ${pkg.ranked[0]?.id})`);
    delete store.entries[key];
    continue;
  }
  const answer: ModelAnswer = {
    summary: { text: entry.report.summary.text, sources: pkg.sources.map((s) => s.id) },
    claims: claims.map((c) => ({ kind: c.kind as ModelAnswer["claims"][number]["kind"], text: c.text, implication: c.implication, citations: c.citations.map((x) => ({ source: x.source, excerpt: x.excerpt })) })),
    openQuestions: entry.report.openQuestions,
  };
  const again = checkAnswer(answer, pkg);
  again.claims.forEach((c, i) => {
    if (claims[i].accepted && !c.accepted) {
      marked++;
      c.problems.push(`Passed when recorded; rejected on re-check on ${today} after EMBER's evidence, ranking or check rules changed.`);
    } else if (!claims[i].accepted && !c.accepted) {
      c.problems = claims[i].problems; // keep the original reason
    }
  });
  const kept = again.claims.filter((c) => c.accepted).length;
  if (!entry.report.summary.accepted || !again.summary.accepted || kept === 0) {
    removed.push(`${key} (${!again.summary.accepted ? again.summary.problems.join(" ") : "no claim passes"})`);
    delete store.entries[key];
    continue;
  }
  entry.report = { ...again, summary: entry.report.summary, verdict: kept === again.claims.length ? "accepted" : "partial" };
  entry.ranked = pkg.ranked;
}
store.recheckedOn = today;
writeFileSync(path, JSON.stringify(store, null, 2) + "\n");
console.log(`${Object.keys(store.entries).length} recorded answers kept; ${marked} claims newly marked rejected; ${removed.length} removed.`);
for (const r of removed) console.log(`  removed: ${r}`);
