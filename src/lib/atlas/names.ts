import { INVESTIGATIONS } from "../../data/investigations";

/** Atlas sources that are not investigation profiles. */
const EXTRA: Record<string, string> = {
  "saffire-iv-vi": "Saffire IV–VI (NTRS)",
  "cool-flame-counterflow": "Cool-flame counterflow analysis (PSI-142)",
};
const NAME = new Map(INVESTIGATIONS.map((i) => [i.id, i.name]));

/** Display name for an atlas row's investigation id. */
export const atlasSourceName = (id: string) => EXTRA[id] ?? NAME.get(id) ?? id;
