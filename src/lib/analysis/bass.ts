import raw from "../../data/tables/PSI-25-0.json";
import { SNAPSHOT } from "../snapshot";
import { METHOD, type AnalysisSpec, type Observation } from "./engine";
import { REFERENCES, REVIEW_VERSION } from "./review";

/** Exact scalar only: never coerce blanks, bounds, ranges or 'none' to a number. */
export function scalar(raw: string): number | null {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) && Number.isFinite(Number(raw)) ? Number(raw) : null;
}
export function makeObservations(table: typeof raw): Observation[] {
  return table.rows.filter(({ cells }) => /^M\d+$/.test(cells[1]) || (/^T/.test(cells[1]) && /sibal/i.test(cells[5]))).map(({ sourceRow, cells: c }) => {
    const test = c[1], ref = REFERENCES[test];
    const actual = [scalar(c[11]), scalar(c[12]), scalar(c[15]), c[16].trim() === ">500" ? ">500" : scalar(c[16])];
    const matched = !!ref && JSON.stringify(ref.cells) === JSON.stringify(actual);
    const coStart = scalar(c[15]), coEnd = scalar(c[16]);
    return {
      id: `PSI-25-0:r${sourceRow}`, test, sourceRow, group: test.startsWith("M") ? "PMMA slab" : "SIBAL fabric", material: c[5],
      coStart, coEnd, o2Start: scalar(c[11]), o2End: scalar(c[12]), coStartRaw: c[15], coEndRaw: c[16],
      censored: /[<>]|\b(?:OR|over)\b/i.test(c[15] + " " + c[16]),
      questionable: (coStart !== null && coStart < 0) || (coEnd !== null && coEnd < 0) ? ["Negative CO reading"] : [],
      flowRaw: c[8], dateRaw: c[2], sample: c[4],
      review: { matched, page: ref?.page ?? 0, status: test === "T23" || !matched ? "unresolved" : "agrees", note: test === "T23" ? "Gas cells agree; PSI says Sibal, report says SI. Material equivalence unresolved." : matched ? "Four gas cells agree with report; source plausibility remains separate." : "Gas cells do not match the pinned reference; review required." },
    };
  });
}
export const OBSERVATIONS = makeObservations(raw);
export const RAW_TABLE = raw;
export const DEFAULT_SPEC: AnalysisSpec = {
  schemaVersion: 1, method: METHOD, dataset: SNAPSHOT.id, reviewVersion: REVIEW_VERSION,
  question: "How do observed CO changes differ between BASS-II PMMA slab and SIBAL fabric tests?",
  outcome: "final-minus-initial-co-ppm", a: "PMMA slab", b: "SIBAL fabric", oxygen: [0, 100],
  sourceMode: "reviewed", excludeQuestionable: false, seed: 20261115, replicates: 2000,
};
export function assertSnapshot(spec: AnalysisSpec) {
  if (spec.dataset !== DEFAULT_SPEC.dataset || spec.reviewVersion !== REVIEW_VERSION) throw new Error("This analysis uses a different dataset or review version. Open its original reproduction package; it cannot be silently rerun on the current data.");
}
