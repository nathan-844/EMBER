import { TABLES } from "../../data/tables";
import manifest from "../../data/table-manifest.json";
import { buildAtlas } from "../atlas/build";
export const RESEARCH_ATLAS = buildAtlas(TABLES, manifest);
