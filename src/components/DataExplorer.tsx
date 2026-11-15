import type { RankedInvestigation } from "../lib/ranking";
import type { Scenario } from "../lib/scenario";
import { GapMap } from "./GapMap";
import { TableExplorer } from "./TableExplorer";

/** Loaded on demand (it pulls in every stored NASA table). The dashboard opens each part from its own tile. */
export function GapMapPanel({ scenario }: { scenario: Scenario }) {
  return <GapMap scenario={scenario} />;
}

export function TablesPanel({ ranked }: { ranked: RankedInvestigation[] }) {
  return <TableExplorer ranked={ranked} />;
}
