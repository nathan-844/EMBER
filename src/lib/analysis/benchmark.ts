import { TABLES } from "../../data/tables";
import { PSI_SNAPSHOT } from "../../data/psi";
import { readQuantity, experimentCount } from "../atlas/build";
import { researchAtlas, quantitySemantics } from "../atlas/research";
import { median, signTestP, spearman } from "../findings/stats";
import { computeFindings } from "../findings";
import { analyze } from "./engine";
import { DEFAULT_SPEC, OBSERVATIONS } from "./bass";
import { compareWorkbench, defaultWorkbench } from "./workbench";
import { RESEARCH_ATLAS } from "./research-data";
import { SNAPSHOT } from "../snapshot";

type Probe = { category: string; question: string; key: string; expected: unknown; source: string };
const group = (category: string, source: string, entries: [string, string, unknown][]): Probe[] => entries.map(([key, question, expected]) => ({ category, source, key, question, expected }));
/** Frozen v1 reference suite. Evaluation split is not a blind, externally held-out test. */
export const BENCHMARK_CASES = [
  ...group("extraction", "PSI-25-0, CO cells for named test", [
    ["M1", "What is M1's final CO in ppm?", 60], ["M2", "What is M2's final CO in ppm?", 325], ["M5", "Is M5's final CO an exact scalar?", null],
    ["M18", "What is M18's final CO in ppm?", 335], ["T1", "What is T1's final CO in ppm?", 40], ["T28a", "Is T28a's final CO available?", null],
  ]),
  ...group("unit conversion", "Explicit source-unit factors; synthetic reference cells", [
    ["0.21", "Convert an oxygen mole fraction of 0.21 to percent.", 21], ["smoke-nm", "Convert a count-mean particle diameter of 0.19 micrometres to nanometres.", 190], ["0.34", "Convert an oxygen mole fraction of 0.34 to percent.", 34],
    ["1 cm", "Convert a source-stated 1 cm to mm.", 10], ["0.27 mm", "Preserve source-stated 0.27 mm.", .27], ["037 mm", "Should ambiguous 037 mm become 37 mm?", null],
  ]),
  ...group("paired comparisons", "PSI-99-0 extent columns; PSI-101-1 run identities", [
    ["pairs", "How many comparable Saffire-II pairs remain?", 8], ["groundFurther", "How many Saffire pairs burn further on ground?", 5], ["orbitFurther", "How many burn further in orbit?", 0], ["ties", "How many Saffire pairs tie?", 3], ["smokePairs", "How many eligible fresh/aged smoke pairs exist?", 48], ["smokeObservations", "How many observations belong to those smoke pairs?", 96],
  ]),
  ...group("invalid comparisons", "Workbench eligibility contract v1; synthetic adversarial specifications", [
    ["overlap", "Can a FLEX run appear in overlapping oxygen cohorts?", "blocked"], ["reverse", "Can a reversed pressure interval be analyzed?", "blocked"], ["empty", "Can nonexistent material produce an estimate?", "blocked"], ["missingFuel", "Can an unknown fuel be silently pooled?", "blocked"], ["badTemplate", "Can an unsupported template be analyzed?", "blocked"], ["nan", "Can a nonfinite diameter filter be analyzed?", "blocked"],
  ]),
  ...group("quantity semantics", "Synthetic reference quantities; raw strings retained", [
    ["range", "Does a range remain a range after JSON serialization?", "range"], ["list", "Does a discrete set remain a set/list?", "list"], ["trajectory", "Does an ordered start/end trajectory remain ordered?", "trajectory"], ["bound", "Is >500 a lower bound, rather than a scalar?", "lower-bound"], ["unknown", "Does missing quantity remain unknown?", "unknown"], ["offscale", "Does an unknown off-scale threshold remain unknown?", "censored-unknown-bound"],
  ]),
  ...group("source licenses", "Pinned PSI record metadata, license.id (null means unknown)", [
    ["PSI-10", "Is PSI-10 licensed CC0 in the stored metadata?", null], ["PSI-25", "What license is stored for BASS-II?", "CC0-1.0"], ["PSI-69", "What license is stored for FLEX?", "CC0-1.0"], ["PSI-99", "What license is stored for Saffire-II?", "CC0-1.0"], ["PSI-101", "What license is stored for SAME-R?", "CC0-1.0"], ["PSI-102", "What license is stored for SAME?", "CC0-1.0"],
  ]),
  ...group("published denominators", "Frozen M0 findings baseline; n is interpreted using each finding's unit", [
    ["F1", "How many observations support F1?", 154], ["F2", "How many observations support F2's two groups?", 46], ["F3", "How many paired samples support F3?", 8], ["F4", "How many numeric observations support all F4 groups?", 118], ["F7", "How many numeric observations support F7?", 118], ["F8", "How many parent runs support F8?", 48],
  ]),
  ...group("source reconciliation", "BASS M1 report crosswalk and named quality policies", [
    ["rawA", "What is the raw PMMA slab median CO change?", 335], ["rawB", "What is the raw SIBAL median CO change?", 20], ["reviewedB", "What is SIBAL's median after unresolved material exclusion?", 21], ["strict", "What is the median difference after negative-CO exclusion?", 302], ["censor", "Does M5 retain its censored status?", true], ["unresolved", "Is T23's material equivalence resolved?", "unresolved"],
  ]),
  ...group("statistical references", "Hand-calculated synthetic examples, not NASA measurements", [
    ["odd", "What is median(1, 5, 9)?", 5], ["even", "What is median(1, 3, 7, 9)?", 5], ["empty", "What is the median of no observations?", null], ["sign", "What is the two-sided sign probability for 5 versus 0?", .0625], ["rank", "What is Spearman's correlation for reversed ranks?", -1], ["constant", "Is rank correlation defined for a constant variable?", null],
  ]),
  ...group("identity and unknowns", "M0 source-kind manifest and research-v2 identity contract", [
    ["rows", "How many source observations/records are stored?", 2168], ["tests", "How many are classified as test observations?", 1912], ["supplement", "How many are supplemental observations?", 109], ["experiments", "What is the legacy distinct-run count (not independent sessions)?", 1854], ["session", "Are unreviewed sessions invented?", null], ["gravity", "Is unreported numeric gravity silently replaced by zero?", null],
  ]),
].map((p, i) => ({ ...p, id: `M2-${String(i + 1).padStart(2, "0")}`, split: i % 2 ? "evaluation" : "development" }));

export function runBenchmark() {
  const findings = computeFindings(RESEARCH_ATLAS).findings;
  const paired = compareWorkbench(RESEARCH_ATLAS.rows, defaultWorkbench("benchmark"));
  const smoke = compareWorkbench(RESEARCH_ATLAS.rows, defaultWorkbench("benchmark", "smoke"));
  const v2 = researchAtlas(RESEARCH_ATLAS, TABLES);
  const evaluate = (p: Probe): unknown => {
    const k = p.key;
    switch (p.category) {
      case "extraction": return OBSERVATIONS.find((r) => r.test === k)?.coEnd;
      case "unit conversion": return k === "smoke-nm" ? readQuantity({ col: "count-mean diameter", from: "µm", unit: "nm", factor: 1000 }, "0.19")?.v : k.includes("mm") || k.includes("cm") ? readQuantity({ col: "reference", from: "mm", unit: "mm" }, k)?.v : readQuantity({ col: "reference", from: "fraction", unit: "%", factor: 100 }, k)?.v;
      case "paired comparisons": return k === "smokePairs" ? smoke.counts.pairs : k === "smokeObservations" ? smoke.counts.observations : paired.counts[k];
      case "invalid comparisons": {
        const s = defaultWorkbench("benchmark", "flex");
        if (k === "overlap") s.oxygenB = s.oxygenA;
        if (k === "reverse") s.pressure = [20, 10];
        if (k === "empty") { s.template = "saffire"; s.material = "nonexistent"; }
        if (k === "missingFuel") s.fuel = "unknown";
        if (k === "badTemplate") s.template = "unsupported" as typeof s.template;
        if (k === "nan") s.diameter = [NaN, 10];
        return compareWorkbench(RESEARCH_ATLAS.rows, s).status;
      }
      case "quantity semantics": {
        const q = k === "unknown" ? undefined : k === "bound" || k === "offscale" ? { col: "reference", raw: k === "bound" ? ">500" : "OR", v: null, unit: "ppm", flags: ["censored"] } : { col: "reference", raw: "1 2", v: null, unit: "%", values: [1, 2], shape: k as "range" | "list" | "trajectory" };
        return JSON.parse(JSON.stringify(quantitySemantics(q))).kind;
      }
      case "source licenses": return PSI_SNAPSHOT.records.find((r) => r.accession === k)?.license?.id ?? null;
      case "published denominators": return findings.find((f) => f.id === k)?.n;
      case "source reconciliation": {
        if (k === "censor") return OBSERVATIONS.find((r) => r.test === "M5")?.censored;
        if (k === "unresolved") return OBSERVATIONS.find((r) => r.test === "T23")?.review.status;
        const r = analyze(OBSERVATIONS, { ...DEFAULT_SPEC, sourceMode: k.startsWith("raw") ? "raw" : "reviewed", excludeQuestionable: k === "strict" });
        return k === "strict" ? r.difference : k === "rawA" ? r.a.median : r.b.median;
      }
      case "statistical references": return k === "odd" ? median([1, 5, 9]) : k === "even" ? median([1, 3, 7, 9]) : k === "empty" ? median([]) : k === "sign" ? signTestP(5, 0) : k === "rank" ? spearman([1, 2, 3], [3, 2, 1]) : spearman([1, 1, 1], [1, 2, 3]);
      case "identity and unknowns": return k === "rows" ? RESEARCH_ATLAS.rows.length : k === "tests" ? RESEARCH_ATLAS.counts.byKind.test : k === "supplement" ? RESEARCH_ATLAS.counts.byKind.supplement : k === "experiments" ? experimentCount(RESEARCH_ATLAS.rows) : k === "session" ? v2.rows[0].sessionId : v2.rows[0].gravity.g;
    }
    throw new Error("Unknown benchmark probe");
  };
  const results = BENCHMARK_CASES.map((p) => {
    const start = performance.now();
    try { const actual = evaluate(p); return { ...p, actual, passed: JSON.stringify(actual) === JSON.stringify(p.expected), latencyMs: performance.now() - start, error: null }; }
    catch (e) { return { ...p, actual: null, passed: false, latencyMs: performance.now() - start, error: String(e) }; }
  });
  return { version: "m2-benchmark-v1", snapshot: SNAPSHOT, generatedAt: new Date().toISOString(), scope: "Deterministic structured-question baseline; not natural-language AI accuracy or citation entailment. Evaluation cases are frozen but not independently held out.", model: null, liveAI: "not run", recordedAI: "not scored", retrievalBaseline: "not run", results, passed: results.filter((r) => r.passed).length, total: results.length };
}
