import { getPsiRecord } from "../data/psi";
import { CONDITION_LABELS, rankInvestigations, type RankedInvestigation } from "./ranking";
import { scenarioLimitations } from "./limitations";
import { oxygenPartialPressure, type Scenario } from "./scenario";

/**
 * One quotable piece of evidence. `origin` says who wrote the text:
 * "nasa"   – text copied from the NASA PSI record or computed from a PSI run table
 * "ember"  – EMBER's own curated summaries, caveats and limitations
 * "user"   – the scenario the user entered
 */
export interface EvidenceSource {
  id: string;
  label: string;
  origin: "nasa" | "ember" | "user";
  text: string;
}

export interface EvidencePackage {
  sources: EvidenceSource[];
  /** Investigation ids in rank order, so the answer can be checked against the ranking. */
  ranked: { id: string; name: string; rank: number; total: number; relevance: string; matched: number; specified: number }[];
}

const UNIT: Record<string, string> = { oxygenPct: "vol %", pressurePsi: "psia", gravityG: "g", airflowMs: "m/s" };

function scenarioText(s: Scenario): string {
  const ppo2 = oxygenPartialPressure(s);
  const v = (x: number | null, u: string) => (x == null ? "unspecified" : `${x} ${u}`);
  return [
    `Environment: ${s.environment}. Safety question: ${s.question}.`,
    `Oxygen: ${v(s.oxygenPct, "vol %")}. Pressure: ${v(s.pressurePsi, "psia")}. Oxygen partial pressure: ${ppo2 == null ? "unspecified" : `${ppo2.toFixed(2)} psia`}.`,
    `Gravity: ${v(s.gravityG, "g")}. Airflow: ${v(s.airflowMs, "m/s")}${s.airflowMs != null ? ` (${+(s.airflowMs * 100).toFixed(2)} cm/s)` : ""}.`,
    `Fuel: ${s.fuel ?? "unspecified"}. Material: ${s.material ?? "unspecified"}. Thickness: ${v(s.thicknessMm, "mm")}. Flow direction: ${s.flowDirection ?? "unspecified"}.`,
  ].join(" ");
}

function profileSources(r: RankedInvestigation): EvidenceSource[] {
  const inv = r.investigation;
  const out: EvidenceSource[] = [];
  out.push({
    id: `${inv.id}:ranking`,
    label: `${inv.name} ranking result`,
    origin: "ember",
    text:
      `${inv.name} (${inv.fullName}) is ranked ${r.tied ? "tied " : ""}${r.rank} with ${r.total} of 100 points: question ${r.questionPoints} (${r.relevance}), conditions ${r.conditionPoints}. ` +
      `${r.matchedCount} of ${r.specifiedCount} specified conditions match. ` +
      r.conditions.map((c) => `${CONDITION_LABELS[c.key]}: ${c.status}`).join("; ") + ".",
  });
  out.push({ id: `${inv.id}:summary`, label: `${inv.name} summary (EMBER)`, origin: "ember", text: `${inv.summary} Platform: ${inv.platform}. Hardware: ${inv.hardware}. Fuel types: ${inv.fuelTypes.join(", ") || "none"}.` });
  for (const c of r.conditions) {
    if (!c.range) continue;
    const range = c.range;
    out.push({
      id: `${inv.id}:${c.key}`,
      label: `${inv.name} ${CONDITION_LABELS[c.key].toLowerCase()} range`,
      origin: range.source === "psi-table" ? "nasa" : "ember",
      text: `${inv.name} ${CONDITION_LABELS[c.key].toLowerCase()} range ${range.min}–${range.max} ${UNIT[c.key]}. Basis: ${range.basis}.`,
    });
  }
  if (inv.testedMaterials?.length || inv.testedFlowDirections?.length) {
    out.push({
      id: `${inv.id}:tested`,
      label: `${inv.name} materials and flow directions`,
      origin: "nasa",
      text: `PSI run table for ${inv.name} lists materials: ${inv.testedMaterials?.join(", ") || "not recorded"}; flow directions: ${inv.testedFlowDirections?.join(", ") || "not recorded"}.`,
    });
  }
  if (inv.caveats.length) out.push({ id: `${inv.id}:caveats`, label: `${inv.name} caveats (EMBER)`, origin: "ember", text: inv.caveats.join(" ") });
  const rec = getPsiRecord(inv.psi.accession);
  if (rec) {
    if (rec.objectives) out.push({ id: `${inv.id}:objectives`, label: `${rec.accession} objectives (NASA PSI)`, origin: "nasa", text: rec.objectives });
    if (rec.publications.length) {
      out.push({ id: `${inv.id}:publications`, label: `${rec.accession} publications (NASA PSI)`, origin: "nasa", text: rec.publications.slice(0, 12).join(" | ") });
    }
  }
  return out;
}

/** The evidence the model may cite. Built on the server from the scenario alone; client-sent evidence is never trusted. */
export function buildEvidencePackage(
  scenario: Scenario,
  maxProfiles = 6,
  /** Extra per-profile sources, e.g. nearest NASA run-table rows (server only). */
  extra: (r: RankedInvestigation) => EvidenceSource[] = () => [],
): EvidencePackage {
  const ranked = rankInvestigations(scenario);
  const top = ranked.slice(0, maxProfiles);
  const limits = scenarioLimitations(scenario, ranked);
  const sources: EvidenceSource[] = [
    { id: "scenario", label: "Your scenario", origin: "user", text: scenarioText(scenario) },
    ...top.flatMap((r) => [...profileSources(r), ...extra(r)]),
    ...limits.map((l) => ({ id: `limitation:${l.id}`, label: "EMBER limitation", origin: "ember" as const, text: l.text })),
  ];
  return {
    sources,
    ranked: top.map((r) => ({
      id: r.investigation.id,
      name: r.investigation.name,
      rank: r.rank,
      total: r.total,
      relevance: r.relevance,
      matched: r.matchedCount,
      specified: r.specifiedCount,
    })),
  };
}
