import type { AtlasRow, Quantity } from "../atlas/types";
import { groundExtent } from "../findings/saffire";
import { agePairs } from "../findings/same";
import { median, bootstrapCI, signTestP } from "../findings/stats";

export interface WorkbenchSpec {
  version: "workbench-v1"; snapshot: string;
  template: "saffire" | "flex" | "smoke";
  material: string; fuel: string; diluent: "nitrogen" | "CO2" | "He";
  pressure: [number, number]; diameter: [number, number]; oxygenA: [number, number]; oxygenB: [number, number];
  flight: "all" | "same" | "same-r"; excludeFlagged: boolean;
}
export interface WorkbenchResult {
  status: "ok" | "descriptive" | "blocked"; errors: string[]; unit: string;
  estimate: number | null; interval: [number, number] | null;
  used: { id: string; observationIds: string[]; group: string; value: number; details: string }[];
  excluded: { id: string; reason: string }[];
  counts: Record<string, number>; limitations: string[];
}
export const defaultWorkbench = (snapshot: string, template: WorkbenchSpec["template"] = "saffire"): WorkbenchSpec => ({ version: "workbench-v1", snapshot, template, material: "all", fuel: "Methanol", diluent: "nitrogen", pressure: [12, 16], diameter: [0, 10], oxygenA: [12, 16], oxygenB: [20, 22], flight: "all", excludeFlagged: false });
const number = (q: unknown) => typeof (q as Quantity | undefined)?.v === "number" ? (q as Quantity).v! : null;
const within = (n: number | null, range: [number, number]) => n !== null && n >= range[0] && n <= range[1];
const questionable = (flags: string[] = []) => flags.some((f) => /invalid|implausible|negative|leading-zero|out-of-range|spreadsheet-error|unit-mismatch|censored|placeholder/.test(f));
export function validateWorkbench(s: WorkbenchSpec): string[] {
  if (!s || s.version !== "workbench-v1" || !["saffire", "flex", "smoke"].includes(s.template)) return ["Unsupported comparison specification."];
  const errors: string[] = [];
  for (const key of ["pressure", "diameter", "oxygenA", "oxygenB"] as const) if (!Array.isArray(s[key]) || s[key].length !== 2 || !s[key].every(Number.isFinite) || s[key][0] < 0 || s[key][0] > s[key][1]) errors.push(`Invalid ${key} range.`);
  if (!["nitrogen", "CO2", "He"].includes(s.diluent) || !["all", "same", "same-r"].includes(s.flight) || typeof s.excludeFlagged !== "boolean" || typeof s.material !== "string" || typeof s.fuel !== "string") errors.push("Unsupported filter.");
  if (!errors.length && s.template === "flex" && Math.max(s.oxygenA[0], s.oxygenB[0]) <= Math.min(s.oxygenA[1], s.oxygenB[1])) errors.push("FLEX oxygen cohorts must not overlap; a run cannot appear in both groups.");
  return errors;
}
export function compareWorkbench(rows: AtlasRow[], spec: WorkbenchSpec): WorkbenchResult {
  const r: WorkbenchResult = { status: "blocked", errors: validateWorkbench(spec), unit: "", estimate: null, interval: null, used: [], excluded: [], counts: {}, limitations: ["Exploratory observations, not a safety threshold or a causal effect. Missing required endpoints exclude evidence rather than being imputed.", "Sessions are not independently identified. Uncertainty treats runs/pairs as independent and omits measurement and transfer uncertainty."] };
  if (r.errors.length) return r;
  if (spec.template !== "smoke") {
    const candidates = rows.filter((x) => x.investigation === (spec.template === "saffire" ? "saffire-ii" : "flex") && x.rowKind === "test");
    if (new Set(candidates.map((x) => x.id)).size !== candidates.length) { r.errors.push("Duplicate observation identities: resolve source duplication before comparing."); return r; }
    if (spec.template === "saffire" && new Set(candidates.map((x) => x.measures.sample?.v ?? x.id)).size !== candidates.length) { r.errors.push("Duplicate Saffire sample identities: pair membership is ambiguous."); return r; }
  }
  const drop = (id: string, reason: string) => r.excluded.push({ id, reason });
  if (spec.template === "saffire") {
    r.unit = "ground-further fraction among non-tied pairs";
    r.limitations.push("Ordinal extent: no spread, partial, complete. Pairing is by NASA sample row, not identical ground/orbit setup. Composite endpoints are incompatible and excluded. No millimetre difference is inferred from ordinal categories.");
    for (const row of rows.filter((x) => x.investigation === "saffire-ii" && x.rowKind === "test")) {
      if (spec.material !== "all" && row.material.name !== spec.material) { drop(row.id, "Outside material filter"); continue; }
      if (spec.excludeFlagged && (questionable(row.flags) || row.material.basis !== "stated" || Object.values(row.measures).some((q) => questionable(q.flags)))) { drop(row.id, "Questionable measurement or material not stated"); continue; }
      if (/composite/i.test(row.material.name ?? "")) { drop(row.id, "Composite reports different component endpoints"); continue; }
      const ground = groundExtent(String(row.measures.burnLength1g?.v ?? ""));
      const orbit = row.outcome.value === "no-spread" ? 0 : row.outcome.value === "burned" ? 1 : row.outcome.value === "burned-out" ? 2 : null;
      if (ground === null || orbit === null) { drop(row.id, "Missing compatible ordinal extent pair"); continue; }
      r.used.push({ id: row.id, observationIds: [row.id], group: row.material.name ?? "unknown", value: Math.sign(ground - orbit), details: `ground=${ground}; orbit=${orbit}; ${row.material.raw}` });
    }
    const further = r.used.filter((x) => x.value > 0).length, less = r.used.filter((x) => x.value < 0).length;
    r.counts = { pairs: r.used.length, groundFurther: further, orbitFurther: less, ties: r.used.length - further - less, nonTies: further + less };
    r.estimate = further + less ? further / (further + less) : null;
    if (further + less) r.counts.twoSidedSignTestP = signTestP(further, less);
  } else if (spec.template === "flex") {
    r.unit = "difference in median extinction/initial droplet diameter (A − B)";
    r.limitations.push("Conditional on visible-flame extinction: completed/disrupted burns are excluded. This is not extinction probability. Fuel, pressure band and diluent class are filtered; diluent fraction and initial diameter may still differ.");
    for (const row of rows.filter((x) => x.investigation === "flex" && x.rowKind === "test")) {
      const diluent = (row.diluent?.co2?.v ?? 0) > 0 ? "CO2" : (row.diluent?.he?.v ?? 0) > 0 ? "He" : "nitrogen";
      const d0 = number(row.measures.dropletDiameterMm), de = number(row.measures.extinctionDiameterMm), o2 = number(row.o2Pct);
      let reason = "";
      if (number(row.diluent?.co2) === null || number(row.diluent?.he) === null) reason = "Missing diluent composition; nitrogen-only context cannot be assumed";
      else if (row.material.name !== spec.fuel || diluent !== spec.diluent) reason = "Different fuel or diluent class";
      else if (!within(number(row.pressurePsi), spec.pressure)) reason = "Pressure missing or outside band";
      else if (row.outcome.value !== "extinguished") reason = "Not an extinction endpoint (conditional analysis)";
      else if (d0 === null || d0 <= 0 || de === null || de < 0 || de > d0) reason = "Missing or invalid diameter pair";
      else if (!within(d0, spec.diameter)) reason = "Initial diameter outside window";
      else if (spec.excludeFlagged && (questionable(row.flags) || [row.o2Pct, row.pressurePsi, row.measures.dropletDiameterMm, row.measures.extinctionDiameterMm].some((q) => questionable(q?.flags)))) reason = "Questionable row or required measurement";
      else if (!within(o2, spec.oxygenA) && !within(o2, spec.oxygenB)) reason = "Oxygen missing or outside both cohorts";
      if (reason) { drop(row.id, reason); continue; }
      r.used.push({ id: row.id, observationIds: [row.id], group: within(o2, spec.oxygenA) ? "A" : "B", value: de! / d0!, details: `O2=${o2}%; pressure=${row.pressurePsi?.v} psia; initial=${d0} mm; extinction=${de} mm; CO2=${row.diluent?.co2?.v ?? "unknown"}; He=${row.diluent?.he?.v ?? "unknown"}` });
    }
    const a = r.used.filter((x) => x.group === "A").map((x) => x.value), b = r.used.filter((x) => x.group === "B").map((x) => x.value);
    r.counts = { A: a.length, B: b.length };
    if (!a.length || !b.length) r.errors.push("Both oxygen cohorts require eligible extinction observations.");
    else {
      r.estimate = median(a)! - median(b)!;
      if (new Set(a).size > 1 && new Set(b).size > 1) r.interval = bootstrapCI([a, b], ([x, y]) => median(x)! - median(y)!);
    }
  } else {
    r.unit = "median within-run aged/fresh count-mean diameter ratio";
    r.limitations.push("Whole pairs are resampled. Count-mean diameter is distinct from mass-based size. Heated-material smoke and varying ageing times do not predict cabin smoke or detector placement.");
    const pairs = agePairs(rows);
    for (const e of pairs.excluded) for (const id of e.ids) drop(id, e.reason);
    const book = rows.filter((x) => x.source.kind === "psi" && x.source.table === "PSI-101-1" && x.experiment);
    const agedIds = new Set(book.filter((x) => x.experiment!.role === "aged").map((x) => x.experiment!.id));
    for (const id of new Set(book.map((x) => x.experiment!.id))) if (!agedIds.has(id)) drop(id, "No aged observation; no fresh/aged comparison available");
    for (const p of pairs.pairs) {
      if ((spec.flight !== "all" && p.fresh.investigation !== spec.flight) || (spec.material !== "all" && p.fresh.material.name !== spec.material)) { drop(p.id, "Outside flight/material filter"); continue; }
      if (spec.excludeFlagged && (questionable(p.fresh.flags) || questionable(p.aged.flags))) { drop(p.id, "Questionable observation in pair"); continue; }
      r.used.push({ id: p.id, observationIds: [p.fresh.id, p.aged.id], group: p.fresh.investigation, value: p.d1 / p.d0, details: `fresh=${p.d0} µm at ${p.t0 ?? "unknown"} s; aged=${p.d1} µm at ${p.t1 ?? "unknown"} s; ${p.fresh.material.name}` });
    }
    const values = r.used.map((x) => x.value);
    r.estimate = median(values); r.counts = { pairs: values.length, observations: values.length * 2, grew: values.filter((x) => x > 1).length };
    if (new Set(values).size > 1) r.interval = bootstrapCI([values], ([v]) => median(v));
  }
  if (!r.used.length) r.errors.push("No eligible observations remain.");
  r.status = r.errors.length ? "blocked" : r.estimate === null || (spec.template !== "saffire" && !r.interval) ? "descriptive" : "ok";
  return r;
}
