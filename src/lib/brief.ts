import { CONDITION_LABELS, type RankedInvestigation } from "./ranking";
import type { Limitation } from "./limitations";
import { ppo2Sentence, ppo2VsEarth, type Scenario } from "./scenario";

const fmt = (v: number | null, unit: string) => (v == null ? "unspecified" : `${v} ${unit}`);

/** Markdown evidence brief. Everything in it is derived from profile fields and PSI run-table ranges. */
export function buildBrief(scenario: Scenario, ranked: RankedInvestigation[], limits: Limitation[], date = new Date()): string {
  const ppo2 = ppo2VsEarth(scenario);
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
    `- O₂ partial pressure: ${ppo2 == null ? "unspecified" : `${ppo2.psi.toFixed(2)} psia (${ppo2.kpa.toFixed(1)} kPa), ${ppo2Sentence(ppo2)}`}`,
    `- Gravity: ${fmt(scenario.gravityG, "g")}`,
    `- Airflow: ${fmt(scenario.airflowMs, "m/s")}`,
    `- Fuel: ${scenario.fuel ?? "unspecified"}; material: ${scenario.material ?? "unspecified"}; thickness: ${fmt(scenario.thicknessMm, "mm")}; flow direction: ${scenario.flowDirection ?? "unspecified"}`,
    "",
    "## Ranked investigations",
    "",
    "Scores: question 25 + conditions 75 (15 per condition in a NASA-table range, 10 in a curated estimate, two thirds of that just outside). With a fuel type set, studies of that fuel are listed before other fuels (analogue evidence); ranks count within each group. Match points select evidence; they are not confidence or probability.",
    "",
    "| Rank | Investigation | Score | Relevance | Conditions |",
    "| --- | --- | --- | --- | --- |",
    ...ranked.map((r) => {
      const conds = r.conditions.map((c) => `${CONDITION_LABELS[c.key]}: ${c.status}`).join("; ");
      return `| ${r.tied ? "T" : ""}${r.rank} | ${r.investigation.name} (${r.investigation.fullName}) | ${r.total}/100 | ${r.relevance}${r.group === "other" ? ", other fuel (analogue)" : ""} | ${conds} |`;
    }),
    "",
    "## What this evidence cannot establish",
    "",
    ...limits.map((l) => `- ${l.text}`),
    "",
    "## Sources",
    "",
    "- NASA Physical Science Informatics (PSI) investigation records:",
    ...ranked.map((r) => `  - ${r.investigation.name}: ${r.investigation.psi.accession ?? "not linked"}${r.investigation.psi.url ? ` — ${r.investigation.psi.url}` : ""}`),
    "- Condition ranges:",
    ...ranked.flatMap((r) =>
      r.conditions
        .filter((c) => c.range)
        .map((c) => `  - ${r.investigation.name} ${CONDITION_LABELS[c.key].toLowerCase()} ${c.range!.min}–${c.range!.max}: ${c.range!.source === "psi-table" ? "" : "curated approximation; "}${c.range!.basis}`),
    ),
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

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Machine-readable export for modellers: one row per ranked investigation and condition,
 * with the range, where it came from (NASA run table + column, or curated) and the PSI link.
 */
export function buildCsv(scenario: Scenario, ranked: RankedInvestigation[]): string {
  const header = [
    "rank", "investigation", "full_name", "psi_accession", "psi_url", "relevance", "score",
    "condition", "scenario_value", "status", "range_min", "range_max", "range_source", "psi_table", "psi_column", "rows_used", "basis",
  ];
  const value = (k: string) => (k === "fuel" ? scenario.fuel : (scenario as unknown as Record<string, unknown>)[k]);
  const rows = ranked.flatMap((r) =>
    r.conditions.map((c) => [
      `${r.tied ? "T" : ""}${r.rank}`, r.investigation.name, r.investigation.fullName, r.investigation.psi.accession, r.investigation.psi.url,
      r.relevance, r.total, c.key, value(c.key), c.status, c.range?.min, c.range?.max,
      c.range ? c.range.source ?? "curated" : c.key === "fuel" ? "curated" : "", c.range?.table, c.range?.column,
      c.range?.rowsUsed != null ? `${c.range.rowsUsed}/${c.range.totalRows}` : "", c.range?.basis ?? (c.key === "fuel" ? r.investigation.fuelTypes.join(" ") : ""),
    ]),
  );
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
