import type { Scenario } from "../lib/scenario";
import { GapMap } from "./GapMap";

/** Loaded on demand: the gap map reads every stored NASA run table. */
export default function GapPreview({ scenario }: { scenario: Scenario }) {
  return <GapMap scenario={scenario} compact />;
}
