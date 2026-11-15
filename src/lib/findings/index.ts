// The measured findings, computed from the Fire Test Atlas by code. scripts/build-findings.ts writes
// them to src/data/findings.json, which the app reads (it never loads the full atlas).
import type { Atlas } from "../atlas/types";
import { f4CarbonMonoxide, f7CarbonMonoxideEveryBurn } from "./bass";
import { f5CoolFlames } from "./cfig";
import { f1ExtinctionVsOxygen, f2FlexNearExplorationAir } from "./flex";
import { f3EarthVsOrbit } from "./saffire";
import { f6SolidsAtHighOxygen } from "./solids";
import type { FindingsFile } from "./types";

export const FINDINGS_VERSION = "findings-v1";

export const COMPUTE = [f1ExtinctionVsOxygen, f2FlexNearExplorationAir, f3EarthVsOrbit, f4CarbonMonoxide, f5CoolFlames, f6SolidsAtHighOxygen, f7CarbonMonoxideEveryBurn];

export function computeFindings(atlas: Atlas): FindingsFile {
  return {
    version: FINDINGS_VERSION,
    atlasVersion: atlas.version,
    method:
      "Each finding is computed by code from Fire Test Atlas rows; its claim is generated from the computed numbers, and it lists the rows used, the rows left out and why, what else differs between the tests, and what it does not establish. No language model writes or edits a finding.",
    findings: COMPUTE.map((f) => f(atlas.rows)),
  };
}
