import { useEffect, useMemo, useState } from "react";
import engine from "virtual:mission-engine";
import { getInvestigation } from "../data/investigations";
import { RESEARCH_ATLAS } from "../lib/analysis/research-data";
import { DEFAULT_MISSION, missionReport, validateMission, type MissionSpec, type Atmosphere, type InventoryItem, type Assessment, type Target, type Candidate, type Windows } from "../lib/analysis/mission";
import { missionPackage } from "../lib/analysis/mission-export";
import { zipFiles } from "../lib/analysis/export";
import type { Quantity } from "../lib/atlas/types";
import { gravityRegime, PRESETS } from "../lib/scenario";
import { SNAPSHOT } from "../lib/snapshot";
import "./compare.css";
import "./mission.css";

const rows = RESEARCH_ATLAS.rows;
const byId = new Map(rows.map((r) => [r.id, r]));

// What NASA's stored tables actually hold: every named solid material and the forms it was tested in.
const solidTests = rows.filter((r) => r.rowKind === "test" && r.fuelClass === "solid" && r.material.name);
const count = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const MATERIALS = count(solidTests.map((r) => r.material.name!));
const ALL_FORMS = count(solidTests.flatMap((r) => (r.material.form ? [r.material.form] : []))).map(([f]) => f);
const formsOf = (material: string) => count(solidTests.filter((r) => r.material.name === material).flatMap((r) => (r.material.form ? [r.material.form] : [])));
const testsOf = (material: string) => MATERIALS.find(([m]) => m === material)?.[1] ?? 0;

// Atmospheres to start from: the scenario lab's presets, plus the conditions of one Saffire VI flight sample.
const saffire = byId.get("NTRS-20240002981:VI-4");
const ATMOSPHERES: { id: string; label: string; value: Atmosphere }[] = [
  ...PRESETS.filter((p) => p.values.oxygenPct !== null && p.values.pressurePsi !== null).map((p) => ({
    id: p.id, label: p.label,
    value: { oxygenPct: p.values.oxygenPct!, pressurePsi: p.values.pressurePsi!, flowCms: Math.round((p.values.airflowMs ?? 0) * 1000) / 10, gravity: gravityRegime(p.values.gravityG) as Atmosphere["gravity"], diluent: "unspecified" as const },
  })),
  ...(saffire?.o2Pct?.v != null && saffire.pressurePsi?.v != null && saffire.flowCms?.v != null
    ? [{ id: "saffire-vi", label: "Saffire VI flight test (sample 4)", value: { oxygenPct: saffire.o2Pct.v, pressurePsi: saffire.pressurePsi.v, flowCms: saffire.flowCms.v, gravity: "microgravity" as const, diluent: "unspecified" as const } }]
    : []),
];
const atmosphere = (id: string) => structuredClone(ATMOSPHERES.find((a) => a.id === id)!.value);
const presetOf = (a: Atmosphere) => ATMOSPHERES.find((p) => (Object.keys(p.value) as (keyof Atmosphere)[]).every((k) => p.value[k] === a[k]))?.id ?? "custom";

/** The page opens on a move from the ISS to a lunar habitat, asking only that a test was run. */
const START: MissionSpec = {
  ...structuredClone(DEFAULT_MISSION),
  endpoint: "any-test",
  inventory: [{ id: "panel", label: "Cabin panel", material: "PMMA", form: "slab", thicknessMm: null, flowDirection: "unspecified" }],
  a: atmosphere("iss"), b: atmosphere("lunar-exploration"),
};

// The engine sorts each test into five tiers. The page splits "partial" in two, because a test that
// matches on the oxygen NASA recorded is worth more than one whose table records no condition at all.
const GROUPS = [
  { id: "full", label: "Full match", hint: "Same material, form and gravity. Every condition you set is recorded and inside its window." },
  { id: "recorded", label: "Matches what NASA recorded", hint: "Same material, form and gravity. The conditions NASA's table records are inside your windows, but at least one you set is not recorded." },
  { id: "unknown", label: "Conditions not recorded", hint: "Same material, form and gravity, but the table records none of oxygen, pressure or flow for this test." },
  { id: "related", label: "Related only", hint: "The form or gravity differs from yours, or the material is inferred from context rather than stated." },
  { id: "outside", label: "Outside your windows", hint: "A recorded condition is further from yours than the window allows, or the flow direction or gas mixture differs." },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];
type Counts = Record<GroupId, number>;
function groupOf(a: Assessment): GroupId | null {
  if (a.tier === "excluded") return null;
  if (a.tier === "documented") return "full";
  if (a.tier === "analogue") return "related";
  if (a.tier === "outside") return "outside";
  return (["oxygenPct", "pressurePsi", "flowCms"] as const).some((k) => a.distances[k] !== null) ? "recorded" : "unknown";
}
function countGroups(list: Assessment[]): Counts {
  const c: Counts = { full: 0, recorded: 0, unknown: 0, related: 0, outside: 0 };
  for (const a of list) { const g = groupOf(a); if (g) c[g]++; }
  return c;
}
const usable = (g: GroupId | null) => g === "full" || g === "recorded";
const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

const OUTCOMES: Record<string, string> = {
  "not-recorded": "Result not recorded in this table", "no-ignition": "Did not ignite", flash: "Flashed only", "no-spread": "Ignited but did not spread",
  extinguished: "Went out on its own", "burned-out": "Burned until the sample was used up", terminated: "Stopped by the crew or software", disrupted: "Droplet disrupted", burned: "Burned",
};
const quantity = (q: Quantity | undefined | null, unit: string, missing: string) => {
  if (!q) return missing;
  const v = q.values?.length ? q.values : q.v === null ? [] : [q.v];
  return v.length ? `${v.map((x) => Number(x.toFixed(2))).join(" / ")}${unit}` : missing;
};
/** The engine's reasons name its own fields; say them in words. */
const plain = (reason: string) => reason
  .replace(/\boxygenPct\b/g, "oxygen").replace(/\bpressurePsi\b/g, "pressure").replace(/\bflowCms\b/g, "air flow").replace(/\bthicknessMm\b/g, "thickness")
  .replace(/ \(normalized distance ([\d.]+)\)/, (_, d) => `: ${Number(d).toFixed(1)} times the window away`);
const describeAtmosphere = (a: Atmosphere) => `${a.oxygenPct}% O₂ · ${a.pressurePsi} psia · ${a.flowCms} cm/s · ${a.gravity === "partial" ? "partial gravity" : a.gravity === "earth" ? "Earth gravity" : "microgravity"}`;
const describeItem = (i: InventoryItem) => `${i.material || "No material"} · ${i.form || "no form"} · ${i.thicknessMm === null ? "any thickness" : `${i.thicknessMm} mm`}${i.flowDirection === "unspecified" ? "" : ` · ${i.flowDirection} flow`}`;

function initial(): { spec: MissionSpec; warning: string } {
  try {
    const raw = new URLSearchParams(window.location.hash.split("?")[1]).get("spec");
    if (raw) { const parsed = JSON.parse(raw); const errors = validateMission(parsed); if (errors.length) throw new Error(errors.join(" ")); return { spec: parsed, warning: "" }; }
  } catch (e) { return { spec: structuredClone(START), warning: `Saved link not applied; showing defaults. ${String(e)}` }; }
  return { spec: structuredClone(START), warning: "" };
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <label>{label}<input type="number" step="any" min={0} value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} /></label>;
}

function AtmosphereFields({ name, value, onChange }: { name: "A" | "B"; value: Atmosphere; onChange: (a: Atmosphere) => void }) {
  const set = <K extends keyof Atmosphere>(k: K, v: Atmosphere[K]) => onChange({ ...value, [k]: v });
  const preset = presetOf(value);
  return (
    <fieldset className={`mission-atmosphere mission-atmosphere-${name.toLowerCase()}`}>
      <legend><span className="mission-tag">{name}</span> Atmosphere {name}</legend>
      <label className="mission-preset">Start from
        <select value={preset} onChange={(e) => { if (e.target.value !== "custom") onChange(atmosphere(e.target.value)); }}>
          {ATMOSPHERES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value="custom" disabled={preset !== "custom"}>Custom values</option>
        </select>
      </label>
      <div className="mission-fields">
        <NumberField label="Oxygen · %" value={value.oxygenPct} onChange={(v) => set("oxygenPct", v)} />
        <NumberField label="Pressure · psia" value={value.pressurePsi} onChange={(v) => set("pressurePsi", v)} />
        <NumberField label="Air flow · cm/s" value={value.flowCms} onChange={(v) => set("flowCms", v)} />
        <label>Gravity<select value={value.gravity} onChange={(e) => set("gravity", e.target.value as Atmosphere["gravity"])}><option value="microgravity">Microgravity</option><option value="partial">Partial (Moon, Mars)</option><option value="earth">Earth</option></select></label>
        <label>Rest of the gas<select value={value.diluent} onChange={(e) => set("diluent", e.target.value as Atmosphere["diluent"])}><option value="unspecified">Any (not checked)</option><option value="nitrogen">Nitrogen only</option><option value="helium">Helium only</option><option value="carbon-dioxide">Carbon dioxide only</option></select></label>
      </div>
      <p className="small muted">Oxygen partial pressure {(value.oxygenPct / 100 * value.pressurePsi * 6.894757).toFixed(1)} kPa (Earth sea level: 21.2). Equal partial pressure does not make two atmospheres equivalent.</p>
    </fieldset>
  );
}

function MaterialRow({ item, n, onChange, onRemove }: { item: InventoryItem; n: number; onChange: (patch: Partial<InventoryItem>) => void; onRemove?: () => void }) {
  const known = MATERIALS.some(([m]) => m === item.material);
  const [other, setOther] = useState(!known);
  const forms = formsOf(item.material);
  const formKnown = forms.some(([f]) => f === item.form);
  const otherForms = ALL_FORMS.filter((f) => !forms.some(([x]) => x === f));
  const pickMaterial = (material: string) => {
    const next = formsOf(material);
    onChange({ material, form: next.some(([f]) => f === item.form) ? item.form : next[0]?.[0] ?? item.form });
  };
  return (
    <fieldset className="mission-item">
      <legend className="sr-only">Material {n + 1}</legend>
      <label>Part of the habitat<input value={item.label} onChange={(e) => onChange({ label: e.target.value })} /></label>
      <label>Material
        <select value={other ? "__other" : item.material} onChange={(e) => { if (e.target.value === "__other") { setOther(true); onChange({ material: "" }); } else { setOther(false); pickMaterial(e.target.value); } }}>
          {MATERIALS.map(([m, c]) => <option key={m} value={m}>{m} · {plural(c, "test")}</option>)}
          <option value="__other">Another material…</option>
        </select>
        {other && <input aria-label={`Material ${n + 1} name`} placeholder="Name it as your design does" value={item.material} onChange={(e) => onChange({ material: e.target.value })} />}
      </label>
      <label>Form
        <select value={item.form} onChange={(e) => onChange({ form: e.target.value })}>
          {forms.length > 0 && <optgroup label="Tested by NASA in this form">{forms.map(([f, c]) => <option key={f} value={f}>{f} · {plural(c, "test")}</option>)}</optgroup>}
          <optgroup label={forms.length ? "Not tested in this form" : "Form"}>
            {!formKnown && !otherForms.includes(item.form) && <option value={item.form}>{item.form || "Not set"}</option>}
            {otherForms.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
      </label>
      <label>Thickness · mm<input type="number" min="0" step="any" placeholder="Any" value={item.thicknessMm ?? ""} onChange={(e) => onChange({ thicknessMm: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      <label>Air flow direction<select value={item.flowDirection} onChange={(e) => onChange({ flowDirection: e.target.value as InventoryItem["flowDirection"] })}><option value="unspecified">Any</option><option value="concurrent">Concurrent (with the flame)</option><option value="opposed">Opposed (against the flame)</option><option value="quiescent">Still air</option></select></label>
      {onRemove && <button className="btn mission-remove" onClick={onRemove} aria-label={`Remove ${item.label || `material ${n + 1}`}`}>Remove</button>}
    </fieldset>
  );
}

function TierBar({ counts }: { counts: Counts }) {
  const total = GROUPS.reduce((n, g) => n + counts[g.id], 0);
  if (!total) return null;
  return (
    <>
      <div className="mission-bar" role="img" aria-label={GROUPS.map((g) => `${counts[g.id]} ${g.label.toLowerCase()}`).join(", ")}>
        {GROUPS.filter((g) => counts[g.id]).map((g) => <span key={g.id} className={`seg-${g.id}`} style={{ flexGrow: counts[g.id] }} />)}
      </div>
      <ul className="mission-legend">
        {GROUPS.map((g) => <li key={g.id} className={counts[g.id] ? undefined : "zero"}><span className={`mission-dot seg-${g.id}`} aria-hidden="true" /><strong>{counts[g.id]}</strong> {g.label}</li>)}
      </ul>
    </>
  );
}

function TestCard({ a }: { a: Assessment }) {
  const r = byId.get(a.id)!;
  const g = groupOf(a);
  const label = GROUPS.find((x) => x.id === g)?.label ?? "Not this material or result";
  return (
    <details className="mission-test">
      <summary>
        <span className={`mission-dot seg-${g ?? "outside"}`} aria-hidden="true" />
        <span className="mission-test-name">{getInvestigation(r.investigation)?.name ?? r.investigation} <code>{a.id}</code></span>
        <span className="mission-test-conditions">{quantity(r.o2Pct, "% O₂", "oxygen not recorded")} · {quantity(r.pressurePsi, " psia", "pressure not recorded")} · {quantity(r.flowCms, " cm/s", "flow not recorded")}</span>
        <span className="badge">{label}</span>
      </summary>
      <dl className="mission-facts">
        <div><dt>Sample as NASA wrote it</dt><dd>{a.material.raw || "Not stated"}</dd></div>
        <div><dt>Form and thickness</dt><dd>{a.material.form ?? "form not stated"} · {a.thickness ? quantity(a.thickness, " mm", "thickness not recorded") : "thickness not recorded"}{r.flowDirection?.v ? ` · ${r.flowDirection.v} flow` : ""}</dd></div>
        <div><dt>What happened</dt><dd>{OUTCOMES[a.outcome.value] ?? a.outcome.value}</dd></div>
        <div><dt>Why it is sorted here</dt><dd>{a.reasons.map(plain).join(" ")}</dd></div>
        <div><dt>Source</dt><dd>{a.source.kind === "ntrs" ? <a href={`https://ntrs.nasa.gov/citations/${a.source.ntrsId}`} target="_blank" rel="noreferrer">NASA NTRS {a.source.ntrsId} · {a.source.tables} · {a.source.sample}</a> : <>{a.source.accession} · table {a.source.table} · row {a.source.sourceRow} · <a href="#data">open the Data page</a></>}</dd></div>
      </dl>
      <details className="mission-raw"><summary>Every recorded value for this test</summary><pre className="mission-json">{JSON.stringify(a, null, 2)}</pre></details>
    </details>
  );
}

/** Tests ordered best first: by group, then by how far the furthest recorded condition is from the target. */
function ranked(list: Assessment[]) {
  const order = GROUPS.map((g) => g.id as string);
  // A test with no recorded condition cannot be called close, so it sorts after those that have one.
  const far = (a: Assessment) => { const d = Object.values(a.distances).filter((x): x is number => x !== null); return d.length ? Math.max(...d) : Infinity; };
  return list.filter((a) => groupOf(a)).sort((x, y) => order.indexOf(groupOf(x)!) - order.indexOf(groupOf(y)!) || far(x) - far(y) || x.id.localeCompare(y.id));
}

function AtmosphereResult({ name, value, list }: { name: "A" | "B"; value: Atmosphere; list: Assessment[] }) {
  const c = countGroups(list);
  const total = GROUPS.reduce((n, g) => n + c[g.id], 0);
  // "Closest" needs something to measure: full matches, tests matching on recorded conditions, and related tests that record at least one.
  const measured = (a: Assessment) => Object.values(a.distances).some((d) => d !== null);
  const top = ranked(list).filter((a) => usable(groupOf(a)) || (groupOf(a) === "related" && measured(a))).slice(0, 3);
  const sentence = !total ? "NASA's stored tables hold no test of this material."
    : c.full ? `${plural(c.full, "test")} of this material ${c.full === 1 ? "was" : "were"} run inside every window you set${c.recorded ? `, and ${c.recorded} more match on the conditions NASA recorded` : ""}.`
    : c.recorded ? `No test records every condition you set. ${plural(c.recorded, "test")} ${c.recorded === 1 ? "matches" : "match"} on the conditions NASA did record.`
    : c.unknown ? `Nothing can be matched: ${plural(c.unknown, "test")} of this material and form ${c.unknown === 1 ? "records" : "record"} none of oxygen, pressure or flow.`
    : c.related ? `No test of this material, form and gravity is near these conditions. ${plural(c.related, "related test")} ${c.related === 1 ? "differs" : "differ"} in form or gravity.`
    : "Every test of this material is outside your windows.";
  return (
    <div className={`mission-side mission-side-${name.toLowerCase()}`}>
      <p className="mission-side-head"><span className="mission-tag">{name}</span>{ATMOSPHERES.find((p) => p.id === presetOf(value))?.label ?? "Custom atmosphere"}</p>
      <p className="small muted">{describeAtmosphere(value)}</p>
      {c.full > 0 || c.recorded === 0
        ? <p className="mission-headline"><strong>{c.full}</strong> full {c.full === 1 ? "match" : "matches"}{c.recorded > 0 && <span> · {c.recorded} more on recorded conditions</span>}</p>
        : <p className="mission-headline"><strong>{c.recorded}</strong> {c.recorded === 1 ? "matches" : "match"} on recorded conditions<span> · no full match</span></p>}
      <p>{sentence}</p>
      {value.gravity !== "microgravity" && total > 0 && <p className="mission-note">Every test in NASA's stored tables was run in microgravity, so for {value.gravity === "partial" ? "partial" : "Earth"} gravity the best any of them can be is related evidence.</p>}
      <TierBar counts={c} />
      {top.length > 0 && <><h4>Closest tests</h4>{top.map((a) => <TestCard key={a.id} a={a} />)}</>}
    </div>
  );
}

function AllTests({ a, b }: { a: Assessment[]; b: Assessment[] }) {
  const [side, setSide] = useState<"A" | "B">("A"), [group, setGroup] = useState<GroupId | "all">("all"), [limit, setLimit] = useState(10);
  const list = ranked(side === "A" ? a : b);
  const counts = countGroups(list);
  const shown = list.filter((x) => group === "all" || groupOf(x) === group);
  return (
    <>
      <div className="mission-filter">
        <div className="segmented small-seg" role="group" aria-label="Atmosphere">
          {(["A", "B"] as const).map((s) => <button key={s} aria-pressed={side === s} onClick={() => { setSide(s); setLimit(10); }}>Atmosphere {s}</button>)}
        </div>
        <div className="mission-chips" role="group" aria-label="Group">
          <button className={`chip ${group === "all" ? "on" : ""}`} aria-pressed={group === "all"} onClick={() => { setGroup("all"); setLimit(10); }}>All {list.length}</button>
          {GROUPS.filter((g) => counts[g.id]).map((g) => <button key={g.id} className={`chip ${group === g.id ? "on" : ""}`} aria-pressed={group === g.id} onClick={() => { setGroup(g.id); setLimit(10); }}>{g.label} {counts[g.id]}</button>)}
        </div>
      </div>
      {shown.slice(0, limit).map((x) => <TestCard key={x.id} a={x} />)}
      {shown.length > limit && <button className="btn" onClick={() => setLimit(limit + 20)}>Show 20 more of {shown.length - limit}</button>}
    </>
  );
}

export default function Mission() {
  const [loaded, setLoaded] = useState(initial), [spec, setSpec] = useState(loaded.spec), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [oxygenLevels, setOxygenLevels] = useState("21, 26.5, 34"), [pressureLevels, setPressureLevels] = useState("8.2, 10.2, 14.7"), [flowLevels, setFlowLevels] = useState("5, 20");
  const [candidateDraft, setCandidateDraft] = useState(""), [targetDraft, setTargetDraft] = useState(""), [importDraft, setImportDraft] = useState("");
  // A shared link opened while this page is already showing changes only the hash, so read it again.
  // A link that cannot be applied leaves the mission on screen as it is and says so.
  useEffect(() => {
    const restore = () => {
      if (!window.location.hash.startsWith("#mission?")) return;
      const next = initial();
      if (next.warning) setLoaded((l) => ({ ...l, warning: next.warning.replace("showing defaults", "keeping the mission already on screen") }));
      else { setLoaded(next); setSpec(next.spec); setCandidateDraft(""); setTargetDraft(""); setImportDraft(""); }
      setStatus("");
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  const errors = validateMission(spec);
  const report = useMemo(() => (validateMission(spec).length ? null : missionReport(rows, spec)), [spec]);
  const set = <K extends keyof MissionSpec>(k: K, v: MissionSpec[K]) => { setSpec((s) => ({ ...s, [k]: v })); setStatus(""); };
  const itemChange = (n: number, patch: Partial<InventoryItem>) => set("inventory", spec.inventory.map((i, j) => (j === n ? { ...i, ...patch } : i)));
  function apply(next: MissionSpec, message: string) { const issues = validateMission(next); if (issues.length) throw new Error(issues.join(" ")); setSpec(next); setStatus(message); }
  function addMaterial() {
    let n = 1; while (spec.inventory.some((i) => i.id === `item-${n}`)) n++;
    const unused = MATERIALS.find(([m]) => !spec.inventory.some((i) => i.material === m))?.[0] ?? MATERIALS[0][0];
    set("inventory", [...spec.inventory, { id: `item-${n}`, label: `Material ${spec.inventory.length + 1}`, material: unused, form: formsOf(unused)[0]?.[0] ?? "slab", thicknessMm: null, flowDirection: "unspecified" }]);
  }
  function generate() {
    try {
      const parse = (s: string) => { const parts = s.split(",").map((x) => x.trim()); if (parts.some((x) => !x || !Number.isFinite(Number(x)))) throw new Error("Use comma-separated numbers for every list."); return [...new Set(parts.map(Number))]; };
      const os = parse(oxygenLevels), ps = parse(pressureLevels), fs = parse(flowLevels);
      if (os.length * ps.length * fs.length * spec.inventory.length > 96) throw new Error("That is more than 96 combinations. Use fewer levels or fewer materials.");
      const targets: Target[] = [];
      for (const item of spec.inventory) for (const oxygenPct of os) for (const pressurePsi of ps) for (const flowCms of fs) targets.push({ id: `target-${targets.length + 1}`, itemId: item.id, atmosphere: { ...spec.b, oxygenPct, pressurePsi, flowCms } });
      const candidates: Candidate[] = targets.map((t, n) => ({ ...t, id: `proposal-${String(n + 1).padStart(3, "0")}`, cost: 1, feasibility: "unknown" }));
      apply({ ...spec, targets, candidates }, `Listed ${targets.length} combinations and one candidate test for each. Each test is assumed to cost 1; whether it can be run is unknown.`);
      setCandidateDraft(JSON.stringify(candidates, null, 2)); setTargetDraft(JSON.stringify(targets, null, 2));
    } catch (e) { setStatus(String(e)); }
  }
  async function download() {
    setBusy(true); setStatus("Building the package…");
    try {
      const bytes = zipFiles(await missionPackage(engine, spec));
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
      const a = document.createElement("a"); a.href = url; a.download = `ember-mission-${SNAPSHOT.id}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Package downloaded: source cells, every decision, the proposed tests and an offline runner.");
    } catch (e) { setStatus(String(e)); } finally { setBusy(false); }
  }
  const itemLabel = (id: string) => spec.inventory.find((i) => i.id === id)?.label || id;
  const planned = spec.targets.length > 0;

  return (
    <main className="page compare-page mission-page">
      <header className="land-hero">
        <p className="eyebrow accent">Mission evidence · snapshot {SNAPSHOT.id}</p>
        <h1>Change the air. <span>See which NASA tests still apply.</span></h1>
        <p className="mission-lede">Pick a material and two atmospheres. EMBER sorts every NASA solid-fuel test by how closely it matches each one, shows what is lost in the move from A to B, and lists the tests that would fill the gap.</p>
      </header>
      {loaded.warning && <p role="alert" className="compare-warning">{loaded.warning}</p>}

      <section className="card mission-setup" aria-labelledby="mission-setup-title">
        <h2 id="mission-setup-title">1. Your mission</h2>
        <div className="mission-atmospheres">
          <AtmosphereFields name="A" value={spec.a} onChange={(a) => set("a", a)} />
          <AtmosphereFields name="B" value={spec.b} onChange={(b) => set("b", b)} />
        </div>
        <h3>Materials</h3>
        <p className="small muted">The list holds every solid material named in NASA's stored tables, with the number of tests. A material's name does not guarantee the same formulation as yours.</p>
        {spec.inventory.map((item, n) => (
          <MaterialRow key={item.id} item={item} n={n} onChange={(patch) => itemChange(n, patch)}
            onRemove={spec.inventory.length > 1 ? () => setSpec((s) => ({ ...s, inventory: s.inventory.filter((i) => i.id !== item.id), targets: s.targets.filter((t) => t.itemId !== item.id), candidates: s.candidates.filter((c) => c.itemId !== item.id) })) : undefined} />
        ))}
        <button className="btn" disabled={spec.inventory.length >= 12} onClick={addMaterial}>Add a material</button>
        <details className="compare-details">
          <summary>Matching rules: what counts as close enough</summary>
          <div className="compare-controls">
            <label>A test counts if it
              <select value={spec.endpoint} onChange={(e) => set("endpoint", e.target.value as MissionSpec["endpoint"])}>
                <option value="any-test">was run on the material (any result)</option>
                <option value="burning-outcome">records whether the sample burned</option>
                <option value="spread-rate">records a flame spread rate</option>
                <option value="heat-release">records heat release</option>
              </select>
            </label>
            {(Object.entries({ oxygenPct: "Oxygen within ± points", pressurePsi: "Pressure within ± psia", flowCms: "Air flow within ± cm/s", thicknessMm: "Thickness within ± mm" }) as [keyof Windows, string][]).map(([k, label]) => <NumberField key={k} label={label} value={spec.windows[k]} onChange={(v) => set("windows", { ...spec.windows, [k]: v })} />)}
          </div>
          <p className="small muted">These windows are your choice, not a validated measure of similarity. A test that lists a range or several levels must fit entirely. A value NASA's table does not record is never treated as zero or as a match.</p>
        </details>
      </section>
      {errors.length > 0 && <div role="alert" className="compare-warning">{errors.join(" ")}</div>}

      {report && <h2 className="mission-section-title">2. What NASA has tested</h2>}
      {report?.inventory.map((result) => {
        const inTables = testsOf(result.item.material);
        const inForm = formsOf(result.item.material).find(([f]) => f === result.item.form)?.[1] ?? 0;
        const groupsA = result.a.map(groupOf), groupsB = result.b.map(groupOf);
        const matchA = groupsA.filter(usable).length, kept = groupsA.filter((g, n) => usable(g) && usable(groupsB[n])).length, gained = groupsB.filter((g, n) => usable(g) && !usable(groupsA[n])).length;
        return (
          <section className="card mission-result" key={result.item.id} aria-label={`${result.item.label || result.item.id}: evidence`}>
            <header className="mission-result-head">
              <h3>{result.item.label || result.item.id}</h3>
              <p className="muted">{describeItem(result.item)}</p>
            </header>
            {inTables === 0 ? (
              <p className="compare-warning">NASA's stored tables hold no solid-fuel test of “{result.item.material || "this material"}”. That is a gap in the stored data, not a sign that it was never tested, and not a statement about how it burns.</p>
            ) : (
              <>
                <p>NASA's stored tables hold <strong>{plural(inTables, "test")}</strong> of {result.item.material}{inForm ? <>, <strong>{inForm}</strong> of them as {result.item.form}</> : <>, none of them as {result.item.form || "this form"}</>}.</p>
                <div className="mission-compare">
                  <AtmosphereResult name="A" value={spec.a} list={result.a} />
                  <div className="mission-arrow" aria-hidden="true">→</div>
                  <AtmosphereResult name="B" value={spec.b} list={result.b} />
                </div>
                <p className="mission-move"><strong>From A to B:</strong> {matchA ? <>{plural(matchA, "test")} {matchA === 1 ? "matches" : "match"} A fully or on what NASA recorded. <strong>{kept}</strong> of them still {kept === 1 ? "does" : "do"} for B.</> : <>no test matches A, so nothing carries over.</>}{gained > 0 && <> {plural(gained, "test")} {gained === 1 ? "matches" : "match"} B but not A.</>} <span className="muted">Counts are test rows, not independent experiments. How much evidence exists says nothing about whether the material is safe.</span></p>
                <details className="compare-details"><summary>Every test of this material, and why it is sorted where it is</summary><AllTests a={result.a} b={result.b} /></details>
                <details className="compare-details">
                  <summary>If your windows were half or twice as wide</summary>
                  <div className="compare-table-wrap"><table><thead><tr><th>Window size</th><th>A: full / partly recorded / related</th><th>B: full / partly recorded / related</th></tr></thead><tbody>{result.sensitivity.map((s) => <tr key={s.scale}><th>{s.scale === 1 ? "As set" : s.scale < 1 ? "Half as wide" : "Twice as wide"}</th><td>{s.a.documented} / {s.a.partial} / {s.a.analogue}</td><td>{s.b.documented} / {s.b.partial} / {s.b.analogue}</td></tr>)}</tbody></table></div>
                  <p className="small muted">Material, form and gravity stay fixed; only the four windows change. Full matches that no other full match beats on every condition: A {result.paretoA.join(", ") || "none"}; B {result.paretoB.join(", ") || "none"}.</p>
                </details>
                <details className="compare-details"><summary>Questions to settle before relying on this</summary><ul>{result.questions.map((q) => <li key={q}>{q}</li>)}</ul></details>
              </>
            )}
          </section>
        );
      })}
      {report && (
        <details className="mission-key">
          <summary>What the five groups mean</summary>
          <dl>{GROUPS.map((g) => <div key={g.id}><dt><span className={`mission-dot seg-${g.id}`} aria-hidden="true" />{g.label}</dt><dd>{g.hint}</dd></div>)}</dl>
        </details>
      )}

      <section className="card mission-plan" aria-labelledby="mission-plan-title">
        <h2 id="mission-plan-title">3. Which new tests would fill the gap?</h2>
        <p>List the oxygen, pressure and flow levels your mission might use. EMBER checks each combination against NASA's tests, then picks new tests in order of how many uncovered combinations each one would cover. It proposes tests; it does not predict what they would show.</p>
        <div className="compare-controls">
          <label>Oxygen levels · %<input value={oxygenLevels} onChange={(e) => setOxygenLevels(e.target.value)} /></label>
          <label>Pressure levels · psia<input value={pressureLevels} onChange={(e) => setPressureLevels(e.target.value)} /></label>
          <label>Air flow levels · cm/s<input value={flowLevels} onChange={(e) => setFlowLevels(e.target.value)} /></label>
          <NumberField label="How many tests can you run?" value={spec.budget} onChange={(v) => set("budget", v)} />
        </div>
        <button className="btn btn-primary" onClick={generate}>{planned ? "List the combinations again" : "List the combinations and propose tests"}</button>
        {!planned && <p className="small muted">Uses every material above with atmosphere B's gravity and gas mixture.</p>}
        {planned && report && (
          <>
            <div className="mission-tiles">
              <div><p className="big">{spec.targets.length}</p><p className="small muted">combinations to cover</p></div>
              <div><p className="big">{report.planner.existing.length}</p><p className="small muted">already have a full match in NASA's tests</p></div>
              <div><p className="big">{report.planner.proposedCoverage.length}</p><p className="small muted">would be covered by {plural(report.planner.steps.length, "proposed test")}</p></div>
              <div><p className="big">{report.planner.remaining.length}</p><p className="small muted">still uncovered within the budget</p></div>
            </div>
            {report.planner.steps.length > 0 ? (
              <div className="compare-table-wrap"><table>
                <caption>Proposed tests, in order. None has been run; no result is predicted.</caption>
                <thead><tr><th>#</th><th>Material</th><th>Conditions</th><th>New combinations covered</th><th>Cost so far</th><th>Can it be run?</th></tr></thead>
                <tbody>{report.planner.steps.map((s, n) => (
                  <tr key={s.candidate.id}>
                    <th>{n + 1}</th>
                    <td>{itemLabel(s.candidate.itemId)}</td>
                    <td>{describeAtmosphere(s.candidate.atmosphere)}</td>
                    <td>{s.marginalGain}</td>
                    <td>{s.cumulativeCost} of {report.planner.budget}</td>
                    <td>{s.candidate.feasibility === "unknown" ? "Not assessed" : s.candidate.feasibility === "assumed-feasible" ? "Assumed yes" : "No"}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="compare-warning">No test was proposed: either every combination is already covered, or no candidate fits the budget.</p>}
            <p className="small muted">Each test covers the combinations inside your matching windows. Tests are picked greedily by combinations covered per unit of cost, which is not an optimal experimental design. {report.planner.feasibility}</p>
            <label className="compare-check mission-check"><input type="checkbox" checked={spec.allowUnknownFeasibility} onChange={(e) => set("allowUnknownFeasibility", e.target.checked)} />Include tests whose feasibility has not been assessed</label>
            <details className="compare-details">
              <summary>Edit the combinations and candidate tests by hand (JSON)</summary>
              <p className="small muted">Set a cost above zero and a feasibility of unknown, assumed-feasible or infeasible for each candidate. At most 96 of each. Changing A or B does not rebuild this list.</p>
              <button className="btn" onClick={() => { setCandidateDraft(JSON.stringify(spec.candidates, null, 2)); setTargetDraft(JSON.stringify(spec.targets, null, 2)); }}>Load the current lists</button>
              <label className="mission-editor">Combinations to cover<textarea value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} spellCheck={false} /></label>
              <label className="mission-editor">Candidate tests<textarea value={candidateDraft} onChange={(e) => setCandidateDraft(e.target.value)} spellCheck={false} /></label>
              <button className="btn" onClick={() => { try { apply({ ...spec, targets: JSON.parse(targetDraft), candidates: JSON.parse(candidateDraft) }, "Planner lists applied."); } catch (e) { setStatus(String(e)); } }}>Apply these lists</button>
              <p className="small muted">Already covered: {report.planner.existing.join(", ") || "none"}. Still uncovered: {report.planner.remaining.join(", ") || "none"}.</p>
            </details>
          </>
        )}
      </section>

      <section className="card mission-save" aria-labelledby="mission-save-title">
        <h2 id="mission-save-title">4. Keep and reproduce it</h2>
        <p>The ZIP holds both atmospheres, the materials, every test's sorting and reason, the source cells and a runner. Extract it and run <code>node reproduce.mjs</code> with Node 22: it recomputes everything on this page without EMBER, a network or an AI key.</p>
        <div className="mission-actions">
          <button className="btn btn-primary" disabled={!report || busy} onClick={download}>{busy ? "Preparing the package…" : "Download the mission ZIP"}</button>
          <button className="btn" disabled={!report} onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#mission?spec=${encodeURIComponent(JSON.stringify(spec))}`); setStatus("Link copied. It holds your materials, atmospheres and matching rules."); } catch { setStatus("The clipboard is not available. Use the settings below or the ZIP instead."); } }}>Copy a link to this mission</button>
        </div>
        <details className="compare-details">
          <summary>Paste or inspect the mission settings (JSON)</summary>
          <button className="btn" onClick={() => setImportDraft(JSON.stringify(spec, null, 2))}>Show the current settings</button>
          <label className="mission-editor">Mission settings<textarea value={importDraft} onChange={(e) => setImportDraft(e.target.value)} spellCheck={false} /></label>
          <button className="btn" onClick={() => { try { apply(JSON.parse(importDraft), "Mission restored."); } catch (e) { setStatus(String(e)); } }}>Use these settings</button>
        </details>
        <details className="compare-details"><summary>Limits of this page</summary><ul>{report?.notes.map((note) => <li key={note}>{note}</li>)}<li>No combustion or fire-safety expert has reviewed these groupings.</li></ul></details>
      </section>
      <p className="mission-status" role="status" aria-live="polite">{status}</p>
    </main>
  );
}
