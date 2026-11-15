// Re-runs EMBER's source checks that need no network and prints a scoreboard as JSON.
// verify-report.mjs stores it in src/data/verify-report.json for the Credibility page.
// Usage: npx tsx scripts/scoreboard.ts
import { readFileSync } from "node:fs";
import { serverPackage } from "../server/analyze";
import { EARTH_LINKS, EQUIPMENT_LINKS } from "../src/data/applications";
import { INVESTIGATIONS } from "../src/data/investigations";
import { NTRS_QUOTES, NTRS_SOURCES } from "../src/data/ntrs-evidence";
import { SAFFIRE_NTRS_RUNS, SAFFIRE_NTRS_SOURCE } from "../src/data/ntrs-saffire";
import { getPsiRecord } from "../src/data/psi";
import { checkAnswer, type GroundingReport, type ModelAnswer } from "../src/lib/grounding";
import { quoteHash } from "../src/lib/ntrs-text";
import { scenarioKey } from "../src/lib/recorded";
import { PRESETS, presetScenario, type Scenario } from "../src/lib/scenario";

export interface ScoreRow {
  id: string;
  label: string;
  /** rerun: recomputed every time verify:report runs. recorded: checked by a sync script that needs the network, result stored. manual: checked by hand. */
  how: "rerun" | "recorded" | "manual";
  checked: number;
  passed: number;
  method: string;
}

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const rows: ScoreRow[] = [];

// Quotes from NASA PSI records, word for word.
const psiQuotes = [...EQUIPMENT_LINKS.map((l) => l.quote), ...EARTH_LINKS.map((l) => l.quote)];
rows.push({
  id: "psi-quotes", label: "NASA PSI quotes found word for word", how: "rerun",
  checked: psiQuotes.length,
  passed: psiQuotes.filter((q) => {
    const rec = getPsiRecord(q.accession);
    return rec && squash(rec[q.field ?? "objectives"] ?? "").includes(squash(q.text));
  }).length,
  method: "Each equipment and Earth-use quote is searched for in the stored PSI record it cites.",
});

// Quotes from NTRS PDFs.
const ntrs = read("src/data/ntrs-manifest.json");
rows.push({
  id: "ntrs-quotes", label: "NASA report quotes found in the PDF", how: "recorded",
  checked: NTRS_QUOTES.length,
  passed: NTRS_QUOTES.filter((q) => ntrs.quotes[q.id]?.sha256 === quoteHash(q.text) && ntrs.quotes[q.id].source === q.source).length,
  method: `npm run sync:ntrs found each quote in the text of its PDF (${NTRS_SOURCES.length} PDFs, SHA-256 and page recorded) on ${ntrs.checkedOn}; the stored quote hash is re-checked here.`,
});

// Profiles linked to a NASA PSI record that exists in the snapshot.
rows.push({
  id: "psi-links", label: "Profiles linked to a real PSI record", how: "rerun",
  checked: INVESTIGATIONS.length,
  passed: INVESTIGATIONS.filter((i) => i.psi.accession && getPsiRecord(i.psi.accession)).length,
  method: "Each profile's accession is looked up in the stored PSI snapshot.",
});

// Recorded AI claims: re-run the grounding check and compare with the stored verdict.
const store = read("src/data/recorded-analyses.json") as { entries: Record<string, { report: GroundingReport }> };
const byKey = new Map<string, Scenario>(
  PRESETS.flatMap((p) => (["prevention", "detection", "suppression"] as const).map((q) => {
    const s = { ...presetScenario(p.id), question: q };
    return [scenarioKey(s), s] as const;
  })),
);
let claims = 0, reproduced = 0, kept = 0;
for (const [key, entry] of Object.entries(store.entries)) {
  const scenario = byKey.get(key.split("|ask:")[0]);
  if (!scenario) continue;
  const pkg = serverPackage(scenario);
  const answer: ModelAnswer = {
    summary: { text: entry.report.summary.text, sources: pkg.sources.map((s) => s.id) },
    claims: entry.report.claims.map((c) => ({ kind: c.kind as ModelAnswer["claims"][number]["kind"], text: c.text, implication: c.implication, citations: c.citations.map((x) => ({ source: x.source, excerpt: x.excerpt })) })),
    openQuestions: entry.report.openQuestions,
  };
  const again = checkAnswer(answer, pkg);
  entry.report.claims.forEach((c, i) => {
    claims++;
    if (c.accepted) kept++;
    if (again.claims[i].accepted === c.accepted) reproduced++;
  });
}
rows.push({
  id: "recorded-claims", label: "Recorded AI claims whose verdict reproduces", how: "rerun",
  checked: claims, passed: reproduced,
  method: `Every claim in ${Object.keys(store.entries).length} recorded answers is checked again with today's evidence and checker; ${kept} were accepted when recorded, the rest are shown as rejected.`,
});

// Hashes of the NASA run tables.
const tables = read("src/data/table-manifest.json").tables as { sha256?: string }[];
rows.push({
  id: "table-hashes", label: "NASA run tables with a recorded SHA-256", how: "recorded",
  checked: tables.length, passed: tables.filter((t) => /^[0-9a-f]{64}$/.test(t.sha256 ?? "")).length,
  method: "npm run sync:tables downloads each PSI table again and refuses a file whose SHA-256 differs.",
});

// Saffire IV–VI values copied from the NTRS paper's tables.
const saffireValues = SAFFIRE_NTRS_RUNS.length * 9;
rows.push({
  id: "saffire", label: "Saffire IV–VI values checked against the paper", how: "manual",
  checked: saffireValues, passed: saffireValues,
  method: `${SAFFIRE_NTRS_RUNS.length} runs × 9 values from Tables 1 and 2 of NTRS ${SAFFIRE_NTRS_SOURCE.ntrsId}, checked by hand on ${SAFFIRE_NTRS_SOURCE.verifiedOn} (PDF SHA-256 recorded).`,
});

console.log(JSON.stringify(rows));
