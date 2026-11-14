import type { Scenario } from "../lib/scenario";
import { GapMap } from "./GapMap";

/** Loaded on demand (it pulls in every stored NASA table). */
export default function DataExplorer({ scenario }: { scenario: Scenario }) {
  return <GapMap scenario={scenario} />;
}
