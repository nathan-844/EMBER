import { CONDITION_LABELS, type RankedInvestigation } from "./ranking";
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
        text: `Selected oxygen is outside the ${o2.range.min}–${o2.range.max}% range recorded for ${lead.investigation.name} (${o2.range.source === "psi-table" ? "from the PSI run table" : "curated approximation"}). Results outside the tested range are extrapolation.`,
      });
    }
  }

  if (scenario.oxygenPct != null && scenario.oxygenPct > 21.5) {
    const anyCover = ranked.some((r) => r.conditions.find((c) => c.key === "oxygenPct")?.status === "match");
    if (!anyCover) {
      out.push({ id: "elevated-o2", text: `No ranked profile has a recorded oxygen range that includes ${scenario.oxygenPct}%. This elevated-oxygen atmosphere is outside every tested envelope.` });
    }
  }

  const unknownPressure = ranked.filter((r) => r.conditions.find((c) => c.key === "pressurePsi")?.status === "unknown").length;
  if (scenario.pressurePsi != null && unknownPressure > 0) {
    out.push({ id: "pressure-unknown", text: `${unknownPressure} ranked profile(s) have no normalized pressure; that is not evidence of pressure independence.` });
  }

  out.push({ id: "joint", text: "Shared hardware and overlapping ranges do not establish that all selected conditions were tested together." });

  if (scenario.material != null) {
    const tested = ranked.filter((r) => r.investigation.testedMaterials?.length);
    const hit = tested.filter((r) => r.investigation.testedMaterials!.includes(scenario.material!));
    if (tested.length && !hit.length) {
      out.push({ id: "material-untested", text: `${scenario.material} does not appear in the PSI run tables of ${tested.map((r) => r.investigation.name).join(", ")}; they tested ${[...new Set(tested.flatMap((r) => r.investigation.testedMaterials!))].join(", ")}.` });
    } else if (hit.length) {
      out.push({ id: "material-tested", text: `${scenario.material} appears in the PSI run tables of ${hit.map((r) => r.investigation.name).join(", ")}. Material identity is recorded but not scored; check thickness and sample geometry in those tables.` });
    }
  }
  if (scenario.flowDirection === "opposed" || scenario.flowDirection === "concurrent") {
    const dir = scenario.flowDirection;
    const tested = ranked.filter((r) => r.investigation.testedFlowDirections?.includes(dir));
    if (tested.length) out.push({ id: "flow-tested", text: `${dir[0].toUpperCase() + dir.slice(1)}-flow spread was run in ${tested.map((r) => r.investigation.name).join(", ")} (PSI run tables).` });
  }

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
  /** Specified conditions the lead profile does not cover (outside or no range). */
  gaps: string[];
  /** True when the lead covers every specified condition. */
  fullCoverage: boolean;
}

const listOr = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

const UNIT: Record<string, string> = { oxygenPct: "%", pressurePsi: " psia", gravityG: " g", airflowMs: " m/s" };

function gapText(c: RankedInvestigation["conditions"][number]): string {
  const label = CONDITION_LABELS[c.key].toLowerCase();
  if (c.status === "unknown") return `${label} (no recorded range)`;
  if (c.range) return `${label} (tested ${c.range.min}–${c.range.max}${UNIT[c.key] ?? ""})`;
  return label;
}

/**
 * A single, conservative headline about the lead profile. It never claims coverage
 * from one matching condition: the title states how many specified conditions match
 * and names the ones that do not, with gravity first because it is the condition
 * most likely to be silently over-transferred.
 */
export function leadInsight(scenario: Scenario, ranked: RankedInvestigation[]): Insight | null {
  const lead = ranked[0];
  if (!lead) return null;
  const inv = lead.investigation;
  const specified = lead.conditions.filter((c) => c.status !== "unspecified");
  const matched = specified.filter((c) => c.status === "match");
  const missing = specified
    .filter((c) => c.status !== "match")
    .sort((a, b) => (a.key === "gravityG" ? -1 : b.key === "gravityG" ? 1 : 0));
  const gaps = missing.map(gapText);
  const fullCoverage = specified.length > 0 && missing.length === 0;
  const tiedWith = ranked.filter((r) => r.rank === 1).length - 1;
  const shared = lead.tied ? ` (tied with ${tiedWith} other profile${tiedWith > 1 ? "s" : ""})` : "";
  const gravityGap = missing.some((c) => c.key === "gravityG");
  const regime = gravityRegime(scenario.gravityG);

  const unspecified = lead.conditions.filter((c) => c.status === "unspecified").map((c) => CONDITION_LABELS[c.key].toLowerCase());
  const title = fullCoverage
    ? specified.length === 1
      ? `${inv.name}${shared} matches the only condition you specified (${CONDITION_LABELS[specified[0].key].toLowerCase()})`
      : `${inv.name} covers all ${specified.length} specified conditions${shared}`
    : matched.length === 0
      ? `No profile matches your specified conditions; ${inv.name} ranks first on the safety question alone`
      : `${inv.name} matches ${matched.length} of ${specified.length} conditions${shared}, not ${listOr(missing.map((c) => CONDITION_LABELS[c.key].toLowerCase()))}`;

  const matchedText = matched.length ? `Matched: ${matched.map((c) => CONDITION_LABELS[c.key].toLowerCase()).join(", ")}. ` : "";
  const gapLine = gaps.length ? `Not covered: ${gaps.join("; ")}. ` : "";
  let physics: string;
  const air = lead.conditions.find((c) => c.key === "airflowMs");
  if (air?.status === "match" && regime === "microgravity") {
    physics = "In microgravity, forced flow replaces buoyancy as the oxygen supply, so flame spread and extinction are flow-sensitive.";
  } else if (gravityGap && regime === "partial") {
    physics = `These are low-gravity results. At ${scenario.gravityG} g buoyancy returns in part, and partial-gravity flammability is not bracketed by microgravity and 1 g results.`;
  } else {
    physics = "The ranking is by recorded test conditions, not by predicted fire behavior.";
  }

  const consideration = gravityGap
    ? "Do not transfer these results to your gravity level without partial-gravity tests; treat them as analogue evidence."
    : fullCoverage
      ? "Check that the conditions were tested together in the PSI run table before relying on joint coverage."
      : "Review the unmatched conditions before using these results for design decisions.";

  const unspecLine = unspecified.length ? `Left unspecified (not checked): ${unspecified.join(", ")}. ` : "";
  return { investigation: inv.name, title, body: `${matchedText}${gapLine}${unspecLine}${physics}`, consideration, gaps, fullCoverage };
}
