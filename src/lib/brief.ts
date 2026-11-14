import { CONDITION_LABELS, type RankedInvestigation } from "./ranking";
import type { Limitation } from "./limitations";
import { oxygenPartialPressure, type Scenario } from "./scenario";

const fmt = (v: number | null, unit: string) => (v == null ? "unspecified" : `${v} ${unit}`);

/** Markdown evidence brief. Everything in it is derived from curated profile fields. */
export function buildBrief(scenario: Scenario, ranked: RankedInvestigation[], limits: Limitation[], date = new Date()): string {
  const ppo2 = oxygenPartialPressure(scenario);
  const lines = [
    "# EMBER evidence brief",
    "",
    `Generated ${date.toISOString().slice(0, 10)} · research prototype · not a safety certification`,
    "",
    "## Scenario",
    "",
    `- Environment: ${scenario.environment}`,
    `- Safety question: ${scenario.question}`,
    `- Oxygen: ${fmt(scenario.oxygenPct, "vol %")}`,
    `- Pressure: ${fmt(scenario.pressurePsi, "psia")}`,
    `- O₂ partial pressure: ${ppo2 == null ? "unspecified" : `${ppo2.toFixed(2)} psia`}`,
    `- Gravity: ${fmt(scenario.gravityG, "g")}`,
    `- Airflow: ${fmt(scenario.airflowMs, "m/s")}`,
    `- Fuel: ${scenario.fuel ?? "unspecified"}; material: ${scenario.material ?? "unspecified"}; thickness: ${fmt(scenario.thicknessMm, "mm")}; flow direction: ${scenario.flowDirection ?? "unspecified"}`,
    "",
    "## Ranked investigations",
    "",
    "Scores: question 25 + conditions 75 (15 per condition). Match points select evidence; they are not confidence or probability.",
    "",
    "| Rank | Investigation | Score | Relevance | Conditions |",
    "| --- | --- | --- | --- | --- |",
    ...ranked.map((r) => {
      const conds = r.conditions.map((c) => `${CONDITION_LABELS[c.key]}: ${c.status}`).join("; ");
      return `| ${r.tied ? "T" : ""}${r.rank} | ${r.investigation.name} (${r.investigation.fullName}) | ${r.total}/100 | ${r.relevance} | ${conds} |`;
    }),
    "",
    "## What this evidence cannot establish",
    "",
    ...limits.map((l) => `- ${l.text}`),
    "",
    "## Sources",
    "",
    "- Profiles curated from the 2026 NASA Space Apps \"Flame in Freefall\" challenge description and public NASA mission summaries.",
    "- Verify each investigation against its NASA Physical Science Informatics record: https://psi.nasa.gov",
    "",
  ];
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
