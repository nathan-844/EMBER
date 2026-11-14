import type { RankedInvestigation } from "./ranking";
import { gravityRegime, type Scenario } from "./scenario";

export interface Limitation {
  id: string;
  text: string;
}

/**
 * Plain-language statements of what the ranked evidence cannot establish for
 * this scenario. Order matters: the most safety-relevant caveats come first.
 */
export function scenarioLimitations(scenario: Scenario, ranked: RankedInvestigation[]): Limitation[] {
  const out: Limitation[] = [];
  const regime = gravityRegime(scenario.gravityG);

  if (regime === "partial") {
    out.push({
      id: "partial-gravity",
      text:
        "No partial-gravity measurements are in the ranked PSI profiles. Transferring microgravity results to lunar or Martian gravity is not automatically conservative: some materials may burn at lower oxygen concentrations in partial gravity than in either microgravity or 1 g.",
    });
  } else if (regime === "earth") {
    out.push({ id: "earth-gravity", text: "PSI results are low-gravity data; buoyant 1 g flames behave differently and are better covered by ground test standards." });
  }

  const lead = ranked[0];
  if (lead) {
    const o2 = lead.conditions.find((c) => c.key === "oxygenPct");
    if (o2?.status === "outside" && o2.range) {
      out.push({
        id: "lead-o2-outside",
        text: `Selected oxygen is outside the ${o2.range.min}–${o2.range.max}% range curated for ${lead.investigation.name}. These are approximate ambient values, not confirmed commanded targets; verify against the PSI run records before comparing.`,
      });
    }
  }

  if (scenario.oxygenPct != null && scenario.oxygenPct > 21.5) {
    const anyCover = ranked.some((r) => r.conditions.find((c) => c.key === "oxygenPct")?.status === "match");
    if (!anyCover) {
      out.push({ id: "elevated-o2", text: `No ranked profile has a curated oxygen range that includes ${scenario.oxygenPct}%. Elevated-oxygen exploration atmospheres are largely outside the curated envelopes.` });
    }
  }

  const unknownPressure = ranked.filter((r) => r.conditions.find((c) => c.key === "pressurePsi")?.status === "unknown").length;
  if (scenario.pressurePsi != null && unknownPressure > 0) {
    out.push({ id: "pressure-unknown", text: `${unknownPressure} ranked profile(s) have no normalized pressure; that is not evidence of pressure independence.` });
  }

  out.push({ id: "joint", text: "Shared hardware and overlapping ranges do not establish that all selected conditions were tested together." });

  if (scenario.material == null) out.push({ id: "material", text: "Material identity is unspecified. Fabric, Nomex, Ultem and PMMA results should not be treated as interchangeable." });
  if (scenario.thicknessMm == null) out.push({ id: "thickness", text: "Sample thickness is unspecified; thickness can materially change flame spread and extinction." });
  if (scenario.flowDirection == null) out.push({ id: "flow-dir", text: "Flow direction is unspecified. Opposed, concurrent and still-air results are not automatically transferable." });

  if (ranked.some((r) => r.investigation.id === "acme-cfi-g")) {
    out.push({ id: "cfi-g", text: "CFI-G's oxygen-enriched burner oxidizer is not a cabin atmosphere. Electric-field effects are not lunar-gravity measurements." });
  }

  return out;
}

export interface Insight {
  title: string;
  body: string;
  consideration: string;
  investigation: string;
}

/** A single, conservative headline drawn only from the lead profile's curated fields. */
export function leadInsight(scenario: Scenario, ranked: RankedInvestigation[]): Insight | null {
  const lead = ranked[0];
  if (!lead) return null;
  const inv = lead.investigation;
  const air = lead.conditions.find((c) => c.key === "airflowMs");

  if (air?.status === "match" && air.range && scenario.airflowMs != null) {
    return {
      investigation: inv.name,
      title: `${inv.name} covers your airflow range`,
      body: `The selected ${(scenario.airflowMs * 100).toFixed(0)} cm/s airflow lies within the ${air.range.min * 100}–${air.range.max * 100} cm/s range curated for ${inv.name}. In microgravity, forced flow replaces buoyancy as the oxygen supply, so flame spread and extinction are flow-sensitive.`,
      consideration: "Treat ventilation changes as a fire scenario to test. Confirm exact flow speeds in the PSI run records.",
    };
  }
  return {
    investigation: inv.name,
    title: `${inv.name} is the closest match, at ${lead.matchedCount} of ${lead.specifiedCount} specified conditions`,
    body: `${inv.summary} It is ranked first by curated metadata, not by predicted fire behavior.`,
    consideration: "Review the unmatched conditions before using these results for design decisions.",
  };
}
