/** Pure, dependency-free calculation shared by the browser and exported Node runner. */
export const METHOD = "bass-co-median-difference-v1";
export const GROUPS = ["PMMA slab", "SIBAL fabric"] as const;
export type Group = typeof GROUPS[number];
export interface Observation {
  id: string; test: string; group: Group; sourceRow: number; material: string;
  coStart: number | null; coEnd: number | null; o2Start: number | null; o2End: number | null;
  coStartRaw: string; coEndRaw: string; censored: boolean; questionable: string[];
  flowRaw: string; dateRaw: string; sample: string;
  review: { matched: boolean; page: number; status: "agrees" | "unresolved"; note: string };
}
export interface AnalysisSpec {
  schemaVersion: 1; method: typeof METHOD; dataset: string; reviewVersion: string;
  question: string; outcome: "final-minus-initial-co-ppm";
  a: Group; b: Group; oxygen: [number, number];
  sourceMode: "raw" | "reviewed"; excludeQuestionable: boolean;
  seed: number; replicates: number;
}
export interface Summary {
  n: number; median: number | null; range: [number, number] | null;
  startingOxygen: [number, number] | null; startingCo: [number, number] | null;
}
export interface AnalysisResult {
  status: "ok" | "descriptive-only" | "blocked"; messages: string[];
  candidates: number; used: { id: string; cohort: "A" | "B"; delta: number }[];
  excluded: { id: string; reasons: string[] }[]; censored: number;
  a: Summary; b: Summary; difference: number | null;
  interval: [number, number] | null; successfulReplicates: number;
  oxygenOverlap: [number, number] | null;
  independentGroups: null;
}
export const LIMITATIONS = [
  "Observed glovebox CO change per recorded test, not an emission factor, material toxicity ranking, cabin-fire prediction or causal material effect.",
  "Sample dimensions, airflow, burn duration and starting oxygen differ. Air was not always refreshed between tests; starting CO can differ substantially.",
  "The 95% percentile bootstrap resamples observations independently. Session independence is unverified; the interval can be too narrow and excludes calibration, extraction and transfer uncertainty.",
  "Censored and missing CO readings are excluded from numeric estimates and remain in the exclusion ledger. Estimates describe numeric observations only, not all tests.",
  "The source crosswalk was checked by Codex against rendered NASA tables; it has not had independent human or scientific review. Agreement is not proof that a source value is correct.",
  "Filtering is exploratory. This template does not match samples or control all confounders. No confidence score or significance claim is assigned.",
];
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}
function range(values: number[]): [number, number] | null {
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}
function quantile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p, lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
function random(seed: number) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function validateSpec(spec: AnalysisSpec): string[] {
  if (!spec || typeof spec !== "object") return ["Missing analysis specification."];
  const errors: string[] = [];
  if (spec.schemaVersion !== 1 || spec.method !== METHOD || spec.outcome !== "final-minus-initial-co-ppm") errors.push("Unsupported analysis schema, method or outcome.");
  if (!GROUPS.includes(spec.a) || !GROUPS.includes(spec.b) || spec.a === spec.b) errors.push("Choose two different supported material groups.");
  if (!Array.isArray(spec.oxygen) || spec.oxygen.length !== 2 || !spec.oxygen.every(Number.isFinite) || spec.oxygen[0] < 0 || spec.oxygen[1] > 100 || spec.oxygen[0] > spec.oxygen[1]) errors.push("Enter an ordered starting-oxygen window between 0 and 100 vol%.");
  if (!["raw", "reviewed"].includes(spec.sourceMode) || typeof spec.excludeQuestionable !== "boolean") errors.push("Unsupported quality policy.");
  if (!Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 4294967295 || !Number.isInteger(spec.replicates) || spec.replicates < 100 || spec.replicates > 10000) errors.push("Invalid bootstrap seed or replicate count (100–10000).");
  return errors;
}
export function analyze(rows: Observation[], spec: AnalysisSpec): AnalysisResult {
  const empty = (): Summary => ({ n: 0, median: null, range: null, startingOxygen: null, startingCo: null });
  const result: AnalysisResult = { status: "blocked", messages: validateSpec(spec), candidates: rows.length, used: [], excluded: [], censored: 0, a: empty(), b: empty(), difference: null, interval: null, successfulReplicates: 0, oxygenOverlap: null, independentGroups: null };
  if (result.messages.length) return result;
  const selected: { A: Observation[]; B: Observation[] } = { A: [], B: [] };
  for (const row of rows) {
    const reasons: string[] = [];
    if (row.group !== spec.a && row.group !== spec.b) reasons.push("Outside selected materials");
    if (row.o2Start === null || row.o2Start < spec.oxygen[0] || row.o2Start > spec.oxygen[1]) reasons.push("Outside starting-oxygen window or oxygen missing");
    if (row.censored) { reasons.push("CO is censored; never substituted with its bound"); result.censored++; }
    if (row.coStart === null || row.coEnd === null) reasons.push("No exact numeric CO pair");
    if (row.o2End !== null && (row.o2End < 5 || row.o2End > 30)) reasons.push("Implausible final oxygen; gas readings not trusted");
    if (spec.sourceMode === "reviewed" && (!row.review.matched || row.review.status !== "agrees")) reasons.push("Source review is unmatched or unresolved");
    if (spec.excludeQuestionable && row.questionable.length) reasons.push(...row.questionable);
    if (reasons.length) result.excluded.push({ id: row.id, reasons });
    else {
      const cohort = row.group === spec.a ? "A" : "B";
      selected[cohort].push(row);
      result.used.push({ id: row.id, cohort, delta: row.coEnd! - row.coStart! });
    }
  }
  const summary = (group: Observation[]): Summary => {
    const delta = group.map((r) => r.coEnd! - r.coStart!);
    return { n: group.length, median: median(delta), range: range(delta), startingOxygen: range(group.flatMap((r) => r.o2Start === null ? [] : [r.o2Start])), startingCo: range(group.map((r) => r.coStart!)) };
  };
  result.a = summary(selected.A); result.b = summary(selected.B);
  if (!result.a.n || !result.b.n) { result.messages.push("No eligible numeric observations in one or both cohorts. Widen the window or change the quality policy."); return result; }
  result.difference = result.a.median! - result.b.median!;
  const ar = result.a.startingOxygen!, br = result.b.startingOxygen!;
  const overlap: [number, number] = [Math.max(ar[0], br[0]), Math.min(ar[1], br[1])];
  result.oxygenOverlap = overlap[0] <= overlap[1] ? overlap : null;
  result.status = "descriptive-only";
  if (!result.oxygenOverlap) result.messages.push("The cohorts have no overlapping starting oxygen. Descriptive medians only; uncertainty comparison withheld.");
  // Two distinct values per cohort is an explicit safeguard against a degenerate bootstrap,
  // not a claim that n=2 makes inference adequate.
  const a = result.used.filter((r) => r.cohort === "A").map((r) => r.delta);
  const b = result.used.filter((r) => r.cohort === "B").map((r) => r.delta);
  if (new Set(a).size < 2 || new Set(b).size < 2) result.messages.push("At least two distinct CO changes per cohort are required for a non-degenerate bootstrap. Medians remain descriptive.");
  if (result.messages.length) return result;
  const rng = random(spec.seed), diffs: number[] = [];
  const sampleMedian = (v: number[]) => median(v.map(() => v[Math.floor(rng() * v.length)]))!;
  for (let i = 0; i < spec.replicates; i++) diffs.push(sampleMedian(a) - sampleMedian(b));
  diffs.sort((x, y) => x - y);
  result.interval = [quantile(diffs, .025), quantile(diffs, .975)];
  result.successfulReplicates = diffs.length;
  result.status = "ok";
  return result;
}
export function sensitivity(rows: Observation[], spec: AnalysisSpec) {
  const overlap = analyze(rows, { ...spec, sourceMode: "raw", excludeQuestionable: false }).oxygenOverlap;
  const policies: { label: string; spec: AnalysisSpec }[] = [
    { label: "Raw numeric pairs", spec: { ...spec, sourceMode: "raw", excludeQuestionable: false } },
    { label: "Source-reconciled pairs", spec: { ...spec, sourceMode: "reviewed", excludeQuestionable: false } },
    { label: "Reconciled, no negative CO", spec: { ...spec, sourceMode: "reviewed", excludeQuestionable: true } },
    ...(overlap ? [{ label: "Reconciled, common oxygen range", spec: { ...spec, sourceMode: "reviewed" as const, oxygen: overlap } }] : []),
  ];
  return policies.map(({ label, spec: policy }) => ({ label, spec: policy, result: analyze(rows, policy) }));
}
