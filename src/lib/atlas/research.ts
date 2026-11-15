import type { Atlas, AtlasRow, Quantity } from "./types";
import type { TableIn } from "./build";

export const RESEARCH_SCHEMA = "atlas-research-v2";
/** Additive migration: original measurements remain immutable and reproduce v1 findings. */
export function quantitySemantics(q: Quantity | undefined) {
  if (!q) return { kind: "unknown", value: null, uncertainty: null };
  const bound = /^\s*([<>])=?\s*(\d+(?:\.\d+)?)/.exec(q.raw);
  if (bound || q.status === "bound" || q.flags?.includes("censored")) return { kind: bound ? bound[1] === ">" ? "lower-bound" : "upper-bound" : "censored-unknown-bound", value: null, rawBound: bound ? Number(bound[2]) : null, boundUnits: "as written in source cell; not converted", raw: q.raw, unit: q.unit, uncertainty: null };
  return { kind: q.shape ?? (q.v === null ? "unknown" : "scalar"), value: q.v, values: q.values ?? null, raw: q.raw, unit: q.unit, approximate: q.approx ?? false, status: q.status ?? "reported", uncertainty: null };
}
function identity(r: AtlasRow, tables: Record<string, TableIn>) {
  if (r.source.kind === "ntrs") return { key: `NTRS-${r.source.ntrsId}:${r.source.sample}`, basis: "publication sample label" };
  const source = r.source;
  if (r.experiment) return { key: `${source.table}:${r.experiment.id}:${r.experiment.role}`, basis: r.experiment.basis };
  const t = tables[source.table], cells = t?.rows.find((x) => x.sourceRow === source.sourceRow)?.cells;
  const keyCol = t?.header.findIndex((h) => /^(?:FLEX )?(test\s*#|test number|sample number|test id|test no\.?)$/i.test(h.trim()));
  const label = keyCol !== undefined && keyCol >= 0 ? cells?.[keyCol]?.trim() : undefined;
  return label ? { key: `${r.source.table}:label:${label}`, basis: "source test/sample label; uniqueness checked within table" } : { key: null, basis: "no reviewed stable source key; snapshot row locator only" };
}
export function researchAtlas(atlas: Atlas, tables: Record<string, TableIn>) {
  const keys = atlas.rows.map((r) => identity(r, tables));
  const frequencies = new Map<string, number>();
  for (const k of keys) if (k.key) frequencies.set(k.key, (frequencies.get(k.key) ?? 0) + 1);
  return {
    schema: RESEARCH_SCHEMA, sourceAtlasVersion: atlas.version,
    method: "Additive identity/quantity/context view. Unknowns are explicit; no measurements or v1 finding definitions changed.",
    rows: atlas.rows.map((r, i) => ({
      observationId: r.id,
      stableSourceKey: keys[i].key && frequencies.get(keys[i].key!) === 1 ? keys[i].key : null,
      identityBasis: keys[i].basis,
      experimentId: r.experiment?.id ?? null,
      experimentBasis: r.experiment?.basis ?? "unreviewed; an observation is not proof of an independent experiment",
      sessionId: null, campaignId: r.investigation,
      source: r.source, extractionRuleVersion: "atlas-v1+research-v2",
      gravity: { regime: r.rowKind === "aside" ? "unknown" : r.gravity, g: null, basis: r.rowKind === "aside" ? "not applicable" : "investigation context, not a measured numeric acceleration", durationSeconds: null },
      apparatus: { investigation: r.investigation, perRunSpecification: null },
      material: r.material,
      conditions: { oxygen: quantitySemantics(r.o2Pct), pressure: quantitySemantics(r.pressurePsi), flow: quantitySemantics(r.flowCms), flowDirection: r.flowDirection ?? null, burnerOxygen: quantitySemantics(r.burnerO2Pct), ignitionProtocol: null },
      endpoint: { definition: r.outcome.rule, outcome: r.outcome.value, raw: r.outcome.cell ?? null, duration: quantitySemantics(r.measures.burnTimeS as Quantity | undefined) },
      measures: Object.fromEntries(Object.entries(r.measures).map(([k, q]) => [k, "unit" in q ? quantitySemantics(q) : q])),
      relationships: [
        ...(r.experiment ? [{ kind: r.experiment.role === "aged" ? "aged-observation-of" : r.rowKind === "supplement" ? "supplements-run" : "observation-of", target: r.experiment.id, basis: r.experiment.basis, match: r.experiment.match ?? null }] : []),
        ...(r.investigation === "saffire-ii" && r.rowKind === "test" ? [{ kind: "paired-ground-orbit-endpoints", target: r.id, basis: "NASA 1-g and microgravity burn-length columns share a sample row; setup equivalence not established", match: null }] : []),
      ],
    })),
  };
}
