// Builds the small table the Credibility page shows from the raw benchmark answers
// (src/data/ai-benchmark.json) and the grades given by reading each answer
// (src/data/ai-benchmark-grades.json). Usage: npx tsx scripts/benchmark-ai-summary.ts
import { readFileSync, writeFileSync } from "node:fs";
import { QUESTIONS } from "../src/lib/ai-benchmark/questions";

type Grade = "correct" | "partly" | "wrong";
const raw = JSON.parse(readFileSync("src/data/ai-benchmark.json", "utf8")) as { recordedOn: string; models: string[]; results: { id: string; run: number; status: string; error?: string; model?: string; ms?: number; summary?: string; summaryAccepted?: boolean; summaryProblems?: string[]; claims?: { accepted: boolean }[]; auto?: { pass: boolean; safetyVerdictShown: boolean } }[] };
const grades = JSON.parse(readFileSync("src/data/ai-benchmark-grades.json", "utf8")) as { gradedBy: string; gradedOn: string; method: string; rerunAfterCheckerFix?: string[]; rerunNote?: string; overrides: Record<string, { grade: Grade; note: string; checkerWronglyRejected?: boolean }> };

const answers = raw.results.map((r) => {
  const q = QUESTIONS.find((x) => x.id === r.id)!;
  const key = `${r.id}#${r.run}`, o = grades.overrides[key];
  if (r.status !== "answered") return { key, id: r.id, run: r.run, kind: q.kind, ask: q.ask, expected: q.expected, grade: "wrong" as Grade, note: `No answer: ${r.error}`, summary: "", summaryShown: false, checkerWronglyRejected: false, claims: 0, accepted: 0, ms: 0, model: "" };
  return {
    key, id: r.id, run: r.run, kind: q.kind, ask: q.ask, expected: q.expected,
    grade: o?.grade ?? (r.auto!.pass ? "correct" : "wrong") as Grade,
    note: o?.note ?? "",
    summary: r.summary!, summaryShown: !!r.summaryAccepted,
    checkerWronglyRejected: !!o?.checkerWronglyRejected,
    claims: r.claims!.length, accepted: r.claims!.filter((c) => c.accepted).length,
    ms: r.ms!, model: r.model!,
  };
});
const n = (f: (a: (typeof answers)[number]) => boolean) => answers.filter(f).length;
const times = answers.filter((a) => a.ms).map((a) => a.ms).sort((a, b) => a - b);
const kinds = ["finding", "source", "premise", "decline"] as const;
const summary = {
  recordedOn: raw.recordedOn, gradedOn: grades.gradedOn, gradedBy: grades.gradedBy, method: grades.method,
  models: [...new Set(answers.map((a) => a.model).filter(Boolean))],
  questions: QUESTIONS.length, answers: answers.length,
  correct: n((a) => a.grade === "correct"), partly: n((a) => a.grade === "partly"), wrong: n((a) => a.grade === "wrong"),
  byKind: Object.fromEntries(kinds.map((k) => [k, { answers: n((a) => a.kind === k), correct: n((a) => a.kind === k && a.grade === "correct"), partly: n((a) => a.kind === k && a.grade === "partly"), wrong: n((a) => a.kind === k && a.grade === "wrong") }])),
  // A verdict counts only when an answer asserts one; the pattern also fires on refusals ("cannot determine if it is safe"), which were read and are not verdicts.
  safetyVerdictsShown: answers.filter((a) => raw.results.find((r) => r.id === a.id && r.run === a.run)?.auto?.safetyVerdictShown && a.grade === "wrong").length,
  summariesHidden: n((a) => !a.summaryShown && a.summary !== ""),
  rerunAfterCheckerFix: grades.rerunAfterCheckerFix ?? [], rerunNote: grades.rerunNote ?? "",
  // Both runs of a question graded the same.
  consistentQuestions: QUESTIONS.filter((q) => { const g = answers.filter((a) => a.id === q.id).map((a) => a.grade); return g.length > 1 && g.every((x) => x === g[0]); }).length,
  claims: answers.reduce((s, a) => s + a.claims, 0), claimsAccepted: answers.reduce((s, a) => s + a.accepted, 0),
  medianSeconds: times.length ? +(times[Math.floor(times.length / 2)] / 1000).toFixed(1) : null,
  slowestSeconds: times.length ? +(times[times.length - 1] / 1000).toFixed(1) : null,
  // Everything that was not simply right, for the page to list.
  notRight: answers.filter((a) => a.grade !== "correct").map(({ key, kind, ask, expected, grade, note, summary }) => ({ key, kind, ask, expected, grade, note, summary })),
};
writeFileSync("src/data/ai-benchmark-summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(`${summary.answers} answers: ${summary.correct} correct, ${summary.partly} partly, ${summary.wrong} wrong. Safety verdicts shown: ${summary.safetyVerdictsShown}. Summaries hidden by the checker: ${summary.summariesHidden}.`);
