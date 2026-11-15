// The identity of the data behind anything EMBER shows or exports (src/data/counts.json).
import raw from "../data/counts.json";
import type { Counts } from "./counts";

export const COUNTS = raw as unknown as Counts;
export const SNAPSHOT = COUNTS.snapshot;

/** One line naming the data snapshot, for briefs and exports. */
export const snapshotLine = () =>
  `EMBER data snapshot ${SNAPSHOT.id} (atlas ${SNAPSHOT.atlasVersion}, findings ${SNAPSHOT.findingsVersion}; NASA PSI tables synced ${SNAPSHOT.tablesSyncedOn}, PSI records fetched ${SNAPSHOT.psiFetchedOn})`;
