import { AREA_QUESTION, EQUIPMENT_LINKS, UPCOMING, type EquipmentArea, type EquipmentLink, type UpcomingStudy } from "../data/applications";
import { INVESTIGATIONS } from "../data/investigations";
import type { RankedInvestigation } from "./ranking";
import { gravityRegime, type Scenario } from "./scenario";

export interface EquipmentGroup {
  area: EquipmentArea;
  /** True when this area serves the scenario's safety question. */
  forQuestion: boolean;
  links: (EquipmentLink & { ranked: string[] })[];
}

const AREAS: EquipmentArea[] = ["detection", "suppression", "ventilation", "materials"];

/**
 * Equipment links grouped by area. Areas that serve the scenario's safety question come first;
 * within an area, links whose investigations are in the current ranking come first.
 */
export function equipmentGroups(scenario: Scenario, ranked: RankedInvestigation[]): EquipmentGroup[] {
  const rankedIds = new Set(ranked.map((r) => r.investigation.id));
  return AREAS.map((area) => ({
    area,
    forQuestion: AREA_QUESTION[area] === scenario.question,
    links: EQUIPMENT_LINKS.filter((l) => l.area === area)
      .map((l) => ({ ...l, ranked: l.investigations.filter((id) => rankedIds.has(id)) }))
      .sort((a, b) => Number(b.ranked.length > 0) - Number(a.ranked.length > 0)),
  })).sort((a, b) => Number(b.forQuestion) - Number(a.forQuestion));
}

/** Highest oxygen in any NASA run table for a solid-material investigation. */
export function solidOxygenMax(): number | null {
  const v = INVESTIGATIONS.filter((i) => i.fuelTypes.includes("solid") && i.conditions.oxygenPct?.source === "psi-table").map((i) => i.conditions.oxygenPct!.max);
  return v.length ? Math.max(...v) : null;
}

/** Upcoming studies, each marked with whether it would close a gap in this scenario, and why. */
export function upcomingFor(scenario: Scenario): (UpcomingStudy & { relevant: boolean; why: string })[] {
  const partial = gravityRegime(scenario.gravityG) === "partial";
  const ceiling = solidOxygenMax();
  const highO2 = scenario.fuel === "solid" && scenario.oxygenPct != null && ceiling != null && scenario.oxygenPct > ceiling;
  return UPCOMING.map((u) => {
    if (u.closes === "partial-gravity") {
      return { ...u, relevant: partial, why: partial ? `Your scenario is at ${scenario.gravityG} g; PSI has no partial-gravity data yet.` : "Your scenario is not at partial gravity." };
    }
    return {
      ...u,
      relevant: highO2,
      why: highO2 ? `Your ${scenario.oxygenPct}% O₂ is above the highest solid-material run in PSI (${ceiling}%).` : "Your scenario is within the oxygen range of existing solid-material runs, or not a solid fuel.",
    };
  }).sort((a, b) => Number(b.relevant) - Number(a.relevant));
}
