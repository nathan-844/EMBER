import type { AtlasRow, Quantity } from "../atlas/types";
import { SNAPSHOT } from "../snapshot";

export const MISSION_METHOD = "mission-coverage-v1";
export type Atmosphere = { oxygenPct: number; pressurePsi: number; flowCms: number; gravity: "microgravity" | "partial" | "earth"; diluent: "unspecified" | "nitrogen" | "helium" | "carbon-dioxide" };
export type InventoryItem = { id: string; label: string; material: string; form: string; thicknessMm: number | null; flowDirection: "unspecified" | "opposed" | "concurrent" | "quiescent" };
export type Windows = { oxygenPct: number; pressurePsi: number; flowCms: number; thicknessMm: number };
export type Endpoint = "burning-outcome" | "spread-rate" | "heat-release";
export type Target = { id: string; itemId: string; atmosphere: Atmosphere };
export type Candidate = Target & { cost: number; feasibility: "unknown" | "assumed-feasible" | "infeasible" };
export type MissionSpec = { method: typeof MISSION_METHOD; snapshot: string; inventory: InventoryItem[]; a: Atmosphere; b: Atmosphere; endpoint: Endpoint; windows: Windows; targets: Target[]; candidates: Candidate[]; budget: number; allowUnknownFeasibility: boolean };
export type Tier = "documented" | "partial" | "analogue" | "outside" | "excluded";
export type Assessment = { id: string; tier: Tier; reasons: string[]; distances: Record<keyof Windows, number | null>; missing: string[]; source: AtlasRow["source"]; material: AtlasRow["material"]; thickness: Quantity | null; outcome: AtlasRow["outcome"]; measures: AtlasRow["measures"] };
export const DEFAULT_MISSION: MissionSpec = {
  method: MISSION_METHOD, snapshot: SNAPSHOT.id,
  inventory: [{ id: "panel", label: "Cabin panel", material: "PMMA", form: "slab", thicknessMm: 5, flowDirection: "concurrent" }],
  a: { oxygenPct: 28.8, pressurePsi: 8.01, flowCms: 20, gravity: "microgravity", diluent: "unspecified" },
  b: { oxygenPct: 21, pressurePsi: 14.7, flowCms: 10, gravity: "partial", diluent: "unspecified" },
  endpoint: "burning-outcome", windows: { oxygenPct: 2, pressurePsi: 1, flowCms: 5, thicknessMm: 0.5 },
  targets: [], candidates: [], budget: 3, allowUnknownFeasibility: true,
};
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const choices = (v: unknown, options: string[]) => typeof v === "string" && options.includes(v);
function atmosphereValid(a: Atmosphere) {
  return a && finite(a.oxygenPct) && a.oxygenPct > 0 && a.oxygenPct <= 100 && finite(a.pressurePsi) && a.pressurePsi > 0 && a.pressurePsi <= 100 && finite(a.flowCms) && a.flowCms >= 0 && a.flowCms <= 1000 && choices(a.gravity, ["microgravity", "partial", "earth"]) && choices(a.diluent, ["unspecified", "nitrogen", "helium", "carbon-dioxide"]);
}
export function validateMission(s: MissionSpec): string[] {
  if (!s || s.method !== MISSION_METHOD || s.snapshot !== SNAPSHOT.id) return ["Unknown method or dataset snapshot. Use the original package for older snapshots."];
  const errors: string[] = [];
  if (!atmosphereValid(s.a) || !atmosphereValid(s.b)) errors.push("Atmospheres require oxygen (0, 100] %, pressure (0, 100] psia, flow [0, 1000] cm/s and known categories.");
  if (!choices(s.endpoint, ["burning-outcome", "spread-rate", "heat-release"])) errors.push("Unsupported endpoint.");
  if (!s.windows || !["oxygenPct", "pressurePsi", "flowCms", "thicknessMm"].every(k => finite(s.windows[k as keyof Windows]) && s.windows[k as keyof Windows] > 0)) errors.push("All comparison windows must be finite and positive.");
  if (!Array.isArray(s.inventory) || s.inventory.length < 1 || s.inventory.length > 12) return [...errors, "Provide 1–12 inventory items."];
  const ids = new Set<string>();
  for (const i of s.inventory) {
    if (!i || typeof i.id !== "string" || !i.id.trim() || ids.has(i.id) || typeof i.label !== "string" || typeof i.material !== "string" || !i.material.trim() || typeof i.form !== "string" || !i.form.trim() || !(i.thicknessMm === null || finite(i.thicknessMm) && i.thicknessMm > 0) || !choices(i.flowDirection, ["unspecified", "opposed", "concurrent", "quiescent"])) errors.push("Each item needs a unique ID, material, form, positive thickness (or null), and valid flow direction.");
    if (i) ids.add(i.id);
  }
  for (const key of ["targets", "candidates"] as const) {
    const list = s[key];
    if (!Array.isArray(list) || list.length > 96) { errors.push(`${key}: maximum 96 points.`); continue; }
    const seen = new Set<string>();
    for (const p of list) {
      if (!p || typeof p.id !== "string" || !p.id.trim() || seen.has(p.id) || !ids.has(p.itemId) || !atmosphereValid(p.atmosphere)) errors.push(`${key}: invalid point, duplicate ID or unknown inventory item.`);
      if (p) seen.add(p.id);
      if (key === "candidates" && (!finite((p as Candidate)?.cost) || (p as Candidate).cost <= 0 || !choices((p as Candidate)?.feasibility, ["unknown", "assumed-feasible", "infeasible"]))) errors.push("Candidates require positive costs and explicit feasibility.");
    }
  }
  if (!finite(s.budget) || s.budget < 0 || typeof s.allowUnknownFeasibility !== "boolean") errors.push("Budget must be nonnegative and the unknown-feasibility policy explicit.");
  return [...new Set(errors)];
}

/** Additive recovery only: source cells stay attached; legacy Atlas and findings are unchanged. */
export function thicknessFor(row: AtlasRow): Quantity | null {
  for (const [key, factor] of [["thicknessMm", 1], ["thicknessCm", 10]] as const) {
    const q = row.measures[key];
    if (q && "unit" in q) return { ...q, v: q.v === null ? null : q.v * factor, values: q.values?.map(v => v * factor), unit: "mm", ...(factor !== 1 ? { status: "converted" as const } : {}) };
  }
  if (row.material.thicknessMm != null) return { v: row.material.thicknessMm, unit: "mm", raw: row.material.raw, col: row.material.col, status: "converted" };
  if (row.source.kind === "ntrs" && row.source.ntrsId === "20240002981") {
    const m = row.material.raw.match(/\((\d+(?:\.\d+)?) cm thick\)/);
    if (m) return { v: Number(m[1]) * 10, unit: "mm", raw: row.material.raw, col: row.material.col, status: "converted" };
  }
  return null;
}
function values(q?: Quantity | null): number[] | null {
  if (!q || q.status === "invalid" || q.status === "bound" || q.status === "placeholder") return null;
  const v = q.values?.length ? q.values : q.v == null ? [] : [q.v];
  return v.length && v.every(finite) ? v : null;
}
/** Every reported level/end must fit. No interpolation between listed levels. */
function distance(q: Quantity | null | undefined, target: number, window: number) {
  const v = values(q);
  return v ? Math.max(...v.map(x => Math.abs(x - target))) / window : null;
}
function endpointPresent(r: AtlasRow, endpoint: Endpoint) {
  if (endpoint === "burning-outcome") return r.outcome.value !== "not-recorded";
  const q = r.measures[endpoint === "spread-rate" ? "spreadRateMicrogravity" : "heatReleaseW"];
  return q && "unit" in q && values(q) !== null;
}
export function assessRow(r: AtlasRow, item: InventoryItem, atmosphere: Atmosphere, endpoint: Endpoint, w: Windows): Assessment {
  const reasons: string[] = [], missing: string[] = [];
  const thickness = thicknessFor(r);
  const distances = { oxygenPct: distance(r.o2Pct, atmosphere.oxygenPct, w.oxygenPct), pressurePsi: distance(r.pressurePsi, atmosphere.pressurePsi, w.pressurePsi), flowCms: distance(r.flowCms, atmosphere.flowCms, w.flowCms), thicknessMm: item.thicknessMm === null ? null : distance(thickness, item.thicknessMm, w.thicknessMm) };
  // Start/end atmosphere cells are one run, not a license to ignore the final condition.
  if (r.o2PctEnd) {
    const end = distance(r.o2PctEnd, atmosphere.oxygenPct, w.oxygenPct);
    distances.oxygenPct = end === null || distances.oxygenPct === null ? null : Math.max(end, distances.oxygenPct);
  }
  let excluded = false, analogue = false, outside = false;
  if (r.rowKind !== "test" || r.fuelClass !== "solid") { excluded = true; reasons.push("Not a solid-material test observation."); }
  if (r.material.name !== item.material) { excluded = true; reasons.push("Different or unreported material; composite samples are not their individual constituents."); }
  if (!endpointPresent(r, endpoint)) { excluded = true; reasons.push("Selected endpoint is not recorded as a usable result."); }
  if (r.material.basis !== "stated") { analogue = true; reasons.push("Material identity inferred, not stated in this row."); }
  if (r.material.form === null) missing.push("material form");
  else if (r.material.form !== item.form) { analogue = true; reasons.push(`Form differs: ${r.material.form} vs ${item.form}.`); }
  if (r.gravity !== atmosphere.gravity) { analogue = true; reasons.push(`Gravity analogue: source ${r.gravity}, target ${atmosphere.gravity}; numeric gravity/duration not established.`); }
  if (item.flowDirection !== "unspecified") {
    if (!r.flowDirection?.v) missing.push("flow direction");
    else if (r.flowDirection.v.toLowerCase() !== item.flowDirection) { outside = true; reasons.push(`Flow direction differs: ${r.flowDirection.v}.`); }
  }
  if (atmosphere.diluent !== "unspecified") {
    const key = { nitrogen: "n2", helium: "he", "carbon-dioxide": "co2" }[atmosphere.diluent] as "n2" | "he" | "co2";
    // Fractions must explicitly establish a single diluent, not merely its presence.
    const selected = values(r.diluent?.[key]);
    const others = (["n2", "he", "co2"] as const).filter(k => k !== key).map(k => values(r.diluent?.[k]));
    if (!selected || others.some(v => !v)) missing.push("diluent composition");
    else if (selected.some(v => v <= 0) || others.some(v => v!.some(x => x !== 0))) { outside = true; reasons.push("Recorded gas mixture differs from the selected single-diluent atmosphere."); }
  }
  for (const k of Object.keys(w) as (keyof Windows)[]) {
    if (k === "thicknessMm" && item.thicknessMm === null) continue;
    if (distances[k] === null) missing.push(k);
    else if (distances[k]! > 1) { outside = true; reasons.push(`${k} exceeds the selected ±${w[k]} window (normalized distance ${distances[k]!.toFixed(3)}).`); }
  }
  if (missing.length) reasons.push(`Missing selected conditions: ${missing.join(", ")}. Missing means unavailable here, not never tested.`);
  const tier: Tier = excluded ? "excluded" : outside ? "outside" : analogue ? "analogue" : missing.length ? "partial" : "documented";
  if (tier === "documented") reasons.push("Same named material, form, gravity regime and endpoint; all selected conditions within windows. Formulation equivalence and assembly performance are unverified.");
  return { id: r.id, tier, reasons, distances, missing, source: r.source, material: r.material, thickness, outcome: r.outcome, measures: r.measures };
}
export function summarize(rows: Assessment[]) {
  const counts: Record<Tier, number> = { documented: 0, partial: 0, analogue: 0, outside: 0, excluded: 0 };
  for (const r of rows) counts[r.tier]++;
  return counts;
}
/** Non-dominated distances among documented matches only; missing dimensions never become zero. */
export function pareto(rows: Assessment[], useThickness: boolean): string[] {
  const keys: (keyof Windows)[] = ["oxygenPct", "pressurePsi", "flowCms", ...(useThickness ? ["thicknessMm" as const] : [])];
  const eligible = rows.filter(r => r.tier === "documented" && keys.every(k => r.distances[k] !== null));
  return eligible.filter(a => !eligible.some(b => b.id !== a.id && keys.every(k => b.distances[k]! <= a.distances[k]!) && keys.some(k => b.distances[k]! < a.distances[k]!))).map(r => r.id);
}
function near(a: Atmosphere, b: Atmosphere, w: Windows) {
  return a.gravity === b.gravity && a.diluent === b.diluent && Math.abs(a.oxygenPct - b.oxygenPct) <= w.oxygenPct && Math.abs(a.pressurePsi - b.pressurePsi) <= w.pressurePsi && Math.abs(a.flowCms - b.flowCms) <= w.flowCms;
}
export function planCoverage(rows: AtlasRow[], s: MissionSpec) {
  const existing = s.targets.filter(t => rows.some(r => assessRow(r, s.inventory.find(i => i.id === t.itemId)!, t.atmosphere, s.endpoint, s.windows).tier === "documented")).map(t => t.id);
  const covered = new Set(existing), chosen = new Set<string>();
  const steps: { candidate: Candidate; gained: string[]; marginalGain: number; gainPerCost: number; cumulativeCost: number }[] = [];
  let spent = 0;
  while (true) {
    const options = s.candidates.filter(c => !chosen.has(c.id) && c.cost <= s.budget - spent + 1e-10 && c.feasibility !== "infeasible" && (s.allowUnknownFeasibility || c.feasibility !== "unknown")).map(c => ({ candidate: c, gained: s.targets.filter(t => !covered.has(t.id) && t.itemId === c.itemId && near(c.atmosphere, t.atmosphere, s.windows)).map(t => t.id) })).filter(o => o.gained.length);
    options.sort((a, b) => b.gained.length / b.candidate.cost - a.gained.length / a.candidate.cost || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0));
    const best = options[0]; if (!best) break;
    spent += best.candidate.cost; chosen.add(best.candidate.id); best.gained.forEach(id => covered.add(id));
    steps.push({ ...best, marginalGain: best.gained.length, gainPerCost: best.gained.length / best.candidate.cost, cumulativeCost: spent });
  }
  return { method: "Greedy uncovered target count / assumed cost; ID breaks ties. Rectangular windows, all selected fields together. Not optimal design or expected information gain.", existing, steps, spent, budget: s.budget, remaining: s.targets.filter(t => !covered.has(t.id)).map(t => t.id), proposedCoverage: [...covered].filter(id => !existing.includes(id)), resultsObserved: false, feasibility: "User assumptions only; apparatus, safety, access, formulation and gravity-duration feasibility require review." };
}
export function missionReport(rows: AtlasRow[], s: MissionSpec) {
  const errors = validateMission(s); if (errors.length) throw new Error(errors.join(" "));
  const inventory = s.inventory.map(item => {
    const a = rows.map(r => assessRow(r, item, s.a, s.endpoint, s.windows));
    const b = rows.map(r => assessRow(r, item, s.b, s.endpoint, s.windows));
    const changes = a.map((r, n) => ({ id: r.id, a: r.tier, b: b[n].tier, reasons: b[n].reasons })).filter(r => r.a !== r.b);
    const sensitivity = [0.5, 1, 2].map(scale => {
      const windows = Object.fromEntries(Object.entries(s.windows).map(([k, v]) => [k, v * scale])) as Windows;
      return { scale, windows, a: summarize(rows.map(r => assessRow(r, item, s.a, s.endpoint, windows))), b: summarize(rows.map(r => assessRow(r, item, s.b, s.endpoint, windows))) };
    });
    return { item, a, b, countsA: summarize(a), countsB: summarize(b), paretoA: pareto(a, item.thicknessMm !== null), paretoB: pareto(b, item.thicknessMm !== null), changes, sensitivity,
      questions: [`Does ${item.material} in ${item.form} form at ${item.thicknessMm ?? "unreported"} mm reproduce the chosen endpoint in atmosphere B?`, ...(b.some(r => r.tier === "analogue") ? ["What changes when microgravity evidence is transferred to the target gravity/form? A dedicated test is required."] : []), ...(b.some(r => r.tier === "partial") ? ["Can missing pressure, flow, thickness or gas composition be recovered from the original run records before proposing another test?"] : []), "Are the actual formulation, exposed sides, dimensions, mounting and neighboring materials comparable? This inventory does not model an assembly."] };
  });
  const result = { method: MISSION_METHOD, snapshot: s.snapshot, inventory, planner: planCoverage(rows, s), notes: ["Counts are source observations, not independent experiments.", "Documented means within selected windows, not validated safety or exact formulation equivalence.", "Unspecified diluent/direction and null thickness are unconditioned, not matched. Gravity is a source regime, not measured numeric g.", "Equal oxygen partial pressure is not atmospheric equivalence: total pressure, O2 fraction, diluent and flow remain separate.", "Legacy scenario ranking is unchanged. This is a separate row-level applicability analysis."] };
  // Canonical JSON result: optional source properties are omitted identically in browser and offline runner.
  return JSON.parse(JSON.stringify(result)) as typeof result;
}
