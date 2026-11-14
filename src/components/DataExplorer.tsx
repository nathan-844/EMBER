import type { RankedInvestigation } from "../lib/ranking";
import type { Scenario } from "../lib/scenario";
import { GapMap } from "./GapMap";
import { TableExplorer } from "./TableExplorer";

/** Loaded on demand (it pulls in every stored NASA table). */
export default function DataExplorer({ scenario, ranked }: { scenario: Scenario; ranked: RankedInvestigation[] }) {
  return (
    <>
      <GapMap scenario={scenario} />
      <TableExplorer ranked={ranked} />
    </>
  );
}
