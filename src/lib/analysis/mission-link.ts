import { DEFAULT_MISSION, type MissionSpec } from "./mission";
import { gravityRegime, type Scenario } from "../scenario";
export function missionLink(s: Scenario): string {
  if (s.oxygenPct === null || s.pressurePsi === null || s.airflowMs === null || s.gravityG === null) return "#mission";
  const spec: MissionSpec = structuredClone(DEFAULT_MISSION);
  spec.b = { oxygenPct: s.oxygenPct, pressurePsi: s.pressurePsi, flowCms: s.airflowMs * 100, gravity: gravityRegime(s.gravityG) as MissionSpec["b"]["gravity"], diluent: "unspecified" };
  if (s.material) {
    spec.inventory[0] = { id: "scenario-material", label: "Scenario material — confirm form", material: s.material, form: "unspecified", thicknessMm: s.thicknessMm, flowDirection: s.flowDirection ?? "unspecified" };
  }
  return `#mission?spec=${encodeURIComponent(JSON.stringify(spec))}`;
}
