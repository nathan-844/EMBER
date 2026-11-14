import { describe, expect, it } from "vitest";
import recorded from "../src/data/recorded-analyses.json";
import { checkAnswer, type ModelAnswer } from "../src/lib/grounding";
import { presetScenario, PRESETS } from "../src/lib/scenario";
import { scenarioKey } from "../src/lib/recorded";
import { serverPackage } from "./analyze";

const entries = Object.entries((recorded as unknown as { entries: Record<string, any> }).entries);
const byKey = new Map(
  PRESETS.flatMap((p) => (["prevention", "detection", "suppression"] as const).map((q) => {
    const s = { ...presetScenario(p.id), question: q };
    return [scenarioKey(s), s] as const;
  })),
);

describe("recorded analyses against today's evidence", () => {
  it.each(entries.map(([k, v]) => [JSON.parse(k).slice(0, 2).join("/"), k, v]))("%s still passes the grounding check", (_label, key, entry) => {
    const scenario = byKey.get(key as string)!;
    const pkg = serverPackage(scenario);
    // Rebuild the model's answer from the stored report and check it again from scratch.
    const answer: ModelAnswer = {
      summary: { text: entry.report.summary.text, sources: pkg.sources.map((s) => s.id) },
      claims: entry.report.claims.filter((c: any) => c.accepted).map((c: any) => ({ kind: c.kind, text: c.text, implication: c.implication, citations: c.citations.map((x: any) => ({ source: x.source, excerpt: x.excerpt })) })),
      openQuestions: entry.report.openQuestions,
    };
    const again = checkAnswer(answer, pkg);
    const failed = again.claims.filter((c) => !c.accepted).map((c) => `${c.text.slice(0, 60)} → ${c.problems.join(" ")}`);
    expect(failed).toEqual([]);
    // Stored origin labels must match today's labels (e.g. EMBER-computed vs NASA text).
    const stored = entry.report.claims.filter((c: any) => c.accepted).flatMap((c: any) => c.citations.map((x: any) => `${x.source}=${x.origin}`));
    const now = again.claims.flatMap((c) => c.citations.map((x) => `${x.source}=${x.origin}`));
    expect(stored).toEqual(now);
    expect(again.summary.accepted).toBe(true);
  });
});
