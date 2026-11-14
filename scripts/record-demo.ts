// Records live Gemini analyses for the unedited presets through the exact server pipeline
// (evidence package → Gemini → grounding check → one corrective retry), so a host without
// an API key can replay them, clearly labelled as recorded.
// Usage: npm run record:demo   (needs GEMINI_API_KEY in .env.local)
import { readFileSync, writeFileSync } from "node:fs";
import { analyze, type AnalysisResponse } from "../server/analyze";
import { parseModelList } from "../server/gemini";
import { scenarioKey } from "../src/lib/recorded";
import { PRESETS, presetScenario } from "../src/lib/scenario";
import type { SafetyQuestion } from "../src/data/types";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\w+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Set GEMINI_API_KEY in .env.local");
const cfg = { apiKey, models: parseModelList(env.GEMINI_MODEL || process.env.GEMINI_MODEL) };

const questions: SafetyQuestion[] = ["prevention", "detection", "suppression"];
const jobs = PRESETS.filter((p) => p.id !== "custom").flatMap((p) => questions.map((q) => ({ ...presetScenario(p.id), question: q })));

const path = "src/data/recorded-analyses.json";
const store = JSON.parse(readFileSync(path, "utf8")) as { recordedOn: string | null; entries: Record<string, AnalysisResponse> };
// --fresh drops every earlier recording first, so nothing checked under older evidence survives.
if (process.argv.includes("--fresh")) store.entries = {};
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const log: string[] = [];

for (const s of jobs) {
  const label = `${s.environment}/${s.question}`;
  if (only.length && !only.includes(label)) continue;
  const out = await analyze(cfg, s);
  if ("error" in out) {
    log.push(`${label}: ERROR ${out.error} ${JSON.stringify(out.tried ?? [])}`);
    console.log(log.at(-1));
    continue;
  }
  store.entries[scenarioKey(s)] = out;
  const r = out.report.receipt;
  log.push(`${label}: ${out.report.verdict} · ${r.acceptedClaims}/${r.claims} claims · NASA ${r.nasaExcerpts} (rows ${r.tableRowExcerpts}) EMBER ${r.emberExcerpts} · ${out.model} · ${out.attempts} attempt(s) · ${(out.ms / 1000).toFixed(0)} s`);
  console.log(log.at(-1));
  store.recordedOn = new Date().toISOString().slice(0, 10);
  writeFileSync(path, JSON.stringify(store, null, 2) + "\n");
}
console.log(`\n${Object.keys(store.entries).length} recorded analyses in ${path}`);
