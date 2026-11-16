// Runs the fixed AI benchmark questions through the same server pipeline the site uses
// (evidence package -> Gemini -> grounding check -> one corrective retry) and records every answer.
// Usage: npm run benchmark:ai                 every question, twice
//        npm run benchmark:ai -- --runs=1 --pause=5 F-01 D-02
// Needs GEMINI_API_KEY in .env.local. Results: src/data/ai-benchmark.json (written after every call).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { analyze } from "../server/analyze";
import { parseModelList } from "../server/gemini";
import { QUESTIONS, VERDICT, type BenchQuestion } from "../src/lib/ai-benchmark/questions";
import { presetScenario } from "../src/lib/scenario";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Set GEMINI_API_KEY in .env.local");
const cfg = { apiKey, models: parseModelList(env.GEMINI_MODEL || process.env.GEMINI_MODEL) };
const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const runs = arg("runs", 2), pauseS = arg("pause", 4);
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

export interface BenchRun {
  id: string; run: number; status: "answered" | "error"; error?: string;
  model?: string; ms?: number; attempts?: number;
  verdict?: string; summary?: string; summaryAccepted?: boolean; summaryProblems?: string[];
  claims?: { kind: string; text: string; implication?: string; accepted: boolean; problems: string[]; citations: { source: string; excerpt: string }[] }[];
  /** Automatic checks only; the answer still has to be read against the expected answer. */
  auto?: { must: boolean; mustNot: boolean; pass: boolean; safetyVerdictShown: boolean };
}
const path = "src/data/ai-benchmark.json";
const store: { recordedOn: string | null; models: string[]; runsPerQuestion: number; results: BenchRun[] } =
  existsSync(path) && !process.argv.includes("--fresh") ? JSON.parse(readFileSync(path, "utf8")) : { recordedOn: null, models: cfg.models, runsPerQuestion: runs, results: [] };

function autoCheck(q: BenchQuestion, shown: string) {
  const must = (q.must ?? []).every((p) => p.test(shown)), mustNot = !(q.mustNot ?? []).some((p) => p.test(shown));
  return { must, mustNot, pass: must && mustNot, safetyVerdictShown: VERDICT.test(shown) };
}

let calls = 0;
for (const q of QUESTIONS) for (let run = 1; run <= runs; run++) {
  if (only.length && !only.includes(q.id)) continue;
  if (store.results.some((r) => r.id === q.id && r.run === run && r.status === "answered")) continue;
  if (pauseS && calls++) await new Promise((r) => setTimeout(r, pauseS * 1000));
  const out = await analyze(cfg, { ...presetScenario(q.preset), question: q.question }, q.ask);
  let rec: BenchRun;
  if ("error" in out) rec = { id: q.id, run, status: "error", error: `${out.status} ${out.error}` };
  else {
    const r = out.report;
    // What a visitor is shown: the summary when it passed the check, and the accepted claims.
    const shown = [r.summary.accepted ? r.summary.text : "", ...r.claims.filter((c) => c.accepted).map((c) => `${c.text} ${c.implication ?? ""}`)].join("\n");
    rec = {
      id: q.id, run, status: "answered", model: out.model, ms: out.ms, attempts: out.attempts, verdict: r.verdict,
      summary: r.summary.text, summaryAccepted: r.summary.accepted, summaryProblems: r.summary.problems,
      claims: r.claims.map((c) => ({ kind: c.kind, text: c.text, implication: c.implication, accepted: c.accepted, problems: c.problems, citations: c.citations.map((x) => ({ source: x.source, excerpt: x.excerpt })) })),
      auto: autoCheck(q, shown),
    };
  }
  store.results = [...store.results.filter((x) => !(x.id === q.id && x.run === run)), rec].sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run);
  store.recordedOn = new Date().toISOString().slice(0, 10);
  writeFileSync(path, JSON.stringify(store, null, 2) + "\n");
  console.log(`${q.id} run ${run}: ${rec.status === "error" ? "ERROR " + rec.error : `${rec.verdict} · auto ${rec.auto!.pass ? "pass" : "FAIL"} · ${rec.claims!.filter((c) => c.accepted).length}/${rec.claims!.length} claims · ${rec.model} · ${(rec.ms! / 1000).toFixed(1)}s`}`);
}
const done = store.results.filter((r) => r.status === "answered");
console.log(`\n${done.length} answers recorded, ${store.results.length - done.length} errors, ${done.filter((r) => r.auto!.pass).length} pass the automatic check.`);
