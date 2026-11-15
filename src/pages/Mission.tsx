import { useMemo, useState } from "react";
import engine from "virtual:mission-engine";
import { RESEARCH_ATLAS } from "../lib/analysis/research-data";
import { DEFAULT_MISSION, missionReport, validateMission, type MissionSpec, type Atmosphere, type InventoryItem, type Assessment, type Target, type Candidate, type Windows } from "../lib/analysis/mission";
import { missionPackage } from "../lib/analysis/mission-export";
import { zipFiles } from "../lib/analysis/export";
import { SNAPSHOT } from "../lib/snapshot";
import "./compare.css";
import "./mission.css";

const rows = RESEARCH_ATLAS.rows;
const materials = [...new Set(rows.filter(r => r.fuelClass === "solid" && r.material.name).map(r => r.material.name!))].sort();
const forms = [...new Set(rows.filter(r => r.fuelClass === "solid" && r.material.form).map(r => r.material.form!))].sort();
const tiers = { documented: "Documented match", partial: "Missing conditions", analogue: "Analogue", outside: "Outside windows / direction", excluded: "Excluded material / endpoint" };
function initial(): { spec: MissionSpec; warning: string } {
  try {
    const raw = new URLSearchParams(window.location.hash.split("?")[1]).get("spec");
    if (raw) { const parsed = JSON.parse(raw); const errors = validateMission(parsed); if (errors.length) throw new Error(errors.join(" ")); return { spec: parsed, warning: "" }; }
  } catch (e) { return { spec: structuredClone(DEFAULT_MISSION), warning: `Saved link not applied; showing defaults. ${String(e)}` }; }
  return { spec: structuredClone(DEFAULT_MISSION), warning: "" };
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <label>{label}<input type="number" step="any" min={0} value={Number.isNaN(value) ? "" : value} onChange={e => onChange(e.target.value === "" ? NaN : Number(e.target.value))} /></label>;
}
function AtmosphereFields({ name, value, onChange }: { name: string; value: Atmosphere; onChange: (a: Atmosphere) => void }) {
  const set = <K extends keyof Atmosphere>(k: K, v: Atmosphere[K]) => onChange({ ...value, [k]: v });
  return <fieldset className="mission-atmosphere"><legend>Atmosphere {name}</legend><div className="compare-controls">
    <NumberField label={`${name} oxygen · %`} value={value.oxygenPct} onChange={v => set("oxygenPct", v)} />
    <NumberField label={`${name} total pressure · psia`} value={value.pressurePsi} onChange={v => set("pressurePsi", v)} />
    <NumberField label={`${name} flow · cm/s`} value={value.flowCms} onChange={v => set("flowCms", v)} />
    <label>{name} gravity regime<select value={value.gravity} onChange={e => set("gravity", e.target.value as Atmosphere["gravity"])}><option value="microgravity">Microgravity</option><option value="partial">Partial gravity</option><option value="earth">Earth gravity</option></select></label>
    <label>{name} diluent<select value={value.diluent} onChange={e => set("diluent", e.target.value as Atmosphere["diluent"])}><option value="unspecified">Unspecified — not conditioned</option><option value="nitrogen">Nitrogen only</option><option value="helium">Helium only</option><option value="carbon-dioxide">Carbon dioxide only</option></select></label>
  </div><p>Oxygen partial pressure: <strong>{(value.oxygenPct / 100 * value.pressurePsi * 6.894757).toFixed(2)} kPa</strong>. Equal partial pressure does not make atmospheres equivalent.</p></fieldset>;
}
function Evidence({ data, pareto }: { data: Assessment[]; pareto: string[] }) {
  const [filter, setFilter] = useState("relevant"), [limit, setLimit] = useState(15);
  const selected = data.filter(r => filter === "all" || (filter === "relevant" ? !["excluded", "outside"].includes(r.tier) : r.tier === filter));
  return <><div className="compare-controls"><label>Evidence group<select value={filter} onChange={e => { setFilter(e.target.value); setLimit(15); }}><option value="relevant">Matches, partial evidence and analogues</option>{Object.entries(tiers).map(([key, label]) => <option value={key} key={key}>{label}</option>)}<option value="all">All rows with exclusion reasons</option></select></label></div>
    <p>{selected.length} observations in this view. {pareto.length} non-dominated documented matches (Pareto set).</p>
    {selected.slice(0, limit).map(r => <details className="compare-details" key={r.id}><summary>{r.id} · {tiers[r.tier]}{pareto.includes(r.id) ? " · Pareto" : ""}</summary>
      <p>{r.reasons.join(" ")}</p><p>Source material: {r.material.raw || "Unreported"}. Form: {r.material.form ?? "unknown"}. Thickness: {r.thickness ? `${r.thickness.v ?? r.thickness.values?.join(" / ") ?? "unknown"} mm (raw: ${r.thickness.raw})` : "unknown"}.</p>
      <p>Observed outcome: {r.outcome.value}; {r.outcome.rule}</p><p>Normalized distances (1 = window edge): {Object.entries(r.distances).map(([k, v]) => `${k}: ${v === null ? "missing / unselected" : v.toFixed(3)}`).join(" · ")}</p>
      <p>{r.source.kind === "ntrs" ? <a href={`https://ntrs.nasa.gov/citations/${r.source.ntrsId}`} target="_blank" rel="noreferrer">NASA NTRS · {r.source.tables} · {r.source.sample}</a> : <span>{r.source.accession} · {r.source.table} · source row {r.source.sourceRow} · <a href="#data">Source tables</a></span>}</p>
      <details><summary>Recorded measurements and provenance</summary><pre className="mission-json">{JSON.stringify(r, null, 2)}</pre></details>
    </details>)}{selected.length > limit && <button className="btn" onClick={() => setLimit(limit + 30)}>Show 30 more observations</button>}
  </>;
}
export default function Mission() {
  const [loaded] = useState(initial), [spec, setSpec] = useState(loaded.spec), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const [oxygenLevels, setOxygenLevels] = useState("21, 26.5, 30"), [pressureLevels, setPressureLevels] = useState("8.2, 10.2, 14.7"), [flowLevels, setFlowLevels] = useState("10, 20");
  const [candidateDraft, setCandidateDraft] = useState(""), [targetDraft, setTargetDraft] = useState(""), [importDraft, setImportDraft] = useState("");
  const errors = validateMission(spec);
  const report = useMemo(() => validateMission(spec).length ? null : missionReport(rows, spec), [spec]);
  const set = <K extends keyof MissionSpec>(k: K, v: MissionSpec[K]) => { setSpec(s => ({ ...s, [k]: v })); setStatus(""); };
  const itemChange = (n: number, patch: Partial<InventoryItem>) => set("inventory", spec.inventory.map((i, j) => j === n ? { ...i, ...patch } : i));
  function apply(next: MissionSpec, message: string) { const issues = validateMission(next); if (issues.length) throw new Error(issues.join(" ")); setSpec(next); setStatus(message); }
  function generate() {
    try {
      const parse = (s: string) => { const parts = s.split(",").map(x => x.trim()); if (parts.some(x => !x || !Number.isFinite(Number(x)))) throw new Error("Use comma-separated finite numbers for every target axis."); return [...new Set(parts.map(Number))]; };
      const os = parse(oxygenLevels), ps = parse(pressureLevels), fs = parse(flowLevels);
      if (os.length * ps.length * fs.length * spec.inventory.length > 96) throw new Error("Target grid exceeds 96 combinations. Reduce levels or inventory items.");
      const targets: Target[] = [];
      for (const item of spec.inventory) for (const oxygenPct of os) for (const pressurePsi of ps) for (const flowCms of fs) targets.push({ id: `target-${targets.length + 1}`, itemId: item.id, atmosphere: { ...spec.b, oxygenPct, pressurePsi, flowCms } });
      const candidates: Candidate[] = targets.map((t, n) => ({ ...t, id: `proposal-${String(n + 1).padStart(3, "0")}`, cost: 1, feasibility: "unknown" }));
      apply({ ...spec, targets, candidates }, `Created ${targets.length} targets and hypothetical candidates. Costs assumed 1; feasibility unknown.`);
      setCandidateDraft(JSON.stringify(candidates, null, 2)); setTargetDraft(JSON.stringify(targets, null, 2));
    } catch (e) { setStatus(String(e)); }
  }
  async function download() {
    setBusy(true); setStatus("Building reproducible package…");
    try {
      const bytes = zipFiles(await missionPackage(engine, spec));
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
      const a = document.createElement("a"); a.href = url; a.download = `ember-mission-${SNAPSHOT.id}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Package downloaded with source cells, decisions, proposed tests and an offline runner.");
    } catch (e) { setStatus(String(e)); } finally { setBusy(false); }
  }
  return <main className="page compare-page mission-page"><header className="page-heading"><p className="eyebrow">MISSION DECISIONS · {SNAPSHOT.id}</p><h1>What evidence follows your mission?</h1><p>Compare atmospheres, inspect material-specific gaps and propose tests for missing target combinations.</p><p><a href="#lab">Scenario lab</a> · <a href="#research">Research workbench</a></p></header>
    {loaded.warning && <p role="alert" className="compare-warning">{loaded.warning}</p>}
    <section className="panel compare-section"><h2>1. Material inventory</h2><p>Named material and form are categorical gates. Inferred identities and different forms remain analogues. Formulation, mounting, exposed sides and assembly behavior require further review.</p>
      <datalist id="mission-materials">{materials.map(m => <option value={m} key={m} />)}</datalist><datalist id="mission-forms">{forms.map(m => <option value={m} key={m} />)}</datalist>
      {spec.inventory.map((item, n) => <fieldset className="mission-atmosphere" key={item.id}><legend>Item {n + 1} · {item.id}</legend><div className="compare-controls">
        <label>Item {n + 1} label<input value={item.label} onChange={e => itemChange(n, { label: e.target.value })} /></label><label>Item {n + 1} material<input list="mission-materials" value={item.material} onChange={e => itemChange(n, { material: e.target.value })} /></label><label>Item {n + 1} form<input list="mission-forms" value={item.form} onChange={e => itemChange(n, { form: e.target.value })} /></label>
        <label>Item {n + 1} thickness · mm<input type="number" min="0" step="any" placeholder="Unspecified — not conditioned" value={item.thicknessMm ?? ""} onChange={e => itemChange(n, { thicknessMm: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        <label>Item {n + 1} flow direction<select value={item.flowDirection} onChange={e => itemChange(n, { flowDirection: e.target.value as InventoryItem["flowDirection"] })}><option value="unspecified">Unspecified — not conditioned</option><option value="concurrent">Concurrent</option><option value="opposed">Opposed</option><option value="quiescent">Quiescent</option></select></label>
      </div>{spec.inventory.length > 1 && <button className="btn" onClick={() => setSpec(s => ({ ...s, inventory: s.inventory.filter(i => i.id !== item.id), targets: s.targets.filter(t => t.itemId !== item.id), candidates: s.candidates.filter(c => c.itemId !== item.id) }))}>Remove item and its planner points</button>}</fieldset>)}
      <button className="btn" disabled={spec.inventory.length >= 12} onClick={() => { let n = 1; while (spec.inventory.some(i => i.id === `item-${n}`)) n++; set("inventory", [...spec.inventory, { id: `item-${n}`, label: "Habitat textile", material: "Nomex", form: "fabric", thicknessMm: null, flowDirection: "unspecified" }]); }}>Add material</button>
    </section>
    <section className="panel compare-section"><h2>2. Compare A and B</h2><AtmosphereFields name="A" value={spec.a} onChange={a => set("a", a)} /><AtmosphereFields name="B" value={spec.b} onChange={b => set("b", b)} />
      <div className="compare-controls"><label>Required observed endpoint<select value={spec.endpoint} onChange={e => set("endpoint", e.target.value as MissionSpec["endpoint"])}><option value="burning-outcome">Recorded burning outcome</option><option value="spread-rate">Measured microgravity spread rate</option><option value="heat-release">Measured heat release</option></select></label>
        {(Object.entries({ oxygenPct: "Oxygen window · ± percentage points", pressurePsi: "Pressure window · ± psia", flowCms: "Flow window · ± cm/s", thicknessMm: "Thickness window · ± mm" }) as [keyof Windows, string][]).map(([k, label]) => <NumberField key={k} label={label} value={spec.windows[k]} onChange={v => set("windows", { ...spec.windows, [k]: v })} />)}</div>
      <p>Windows are user assumptions, not validated similarity thresholds. Every reported range endpoint or discrete level must fit. Missing values never become zero. Unselected fields are not verified. Legacy investigation ranking is unchanged.</p>
    </section>
    {errors.length > 0 && <div role="alert" className="compare-warning">{errors.join(" ")}</div>}
    {report?.inventory.map(result => <section className="panel compare-section" key={result.item.id}><h2>{result.item.label || result.item.id} · evidence changes</h2>
      <div className="compare-table-wrap"><table><caption>Observation counts for the same snapshot and rules</caption><thead><tr><th>Evidence group</th><th>Atmosphere A</th><th>Atmosphere B</th></tr></thead><tbody>{Object.entries(tiers).map(([key, label]) => <tr key={key}><th>{label}</th><td>{result.countsA[key as keyof typeof result.countsA]}</td><td>{result.countsB[key as keyof typeof result.countsB]}</td></tr>)}</tbody></table></div>
      <p className="compare-warning">{result.countsB.documented ? `${result.countsB.documented} B observations meet selected conditions.` : "No documented match for B under the selected constraints."} Evidence availability is not a safety verdict. Counts are observations, not independent experiments.</p>
      <details className="compare-details"><summary>A → B transitions · {result.changes.length} rows change category</summary><p>Documented evidence persists for {result.a.filter((r, n) => r.tier === "documented" && result.b[n].tier === "documented").length} observations.</p><div className="mission-scroll"><table><thead><tr><th>Row</th><th>A → B</th><th>Why B differs</th></tr></thead><tbody>{result.changes.map(c => <tr key={c.id}><th>{c.id}</th><td>{tiers[c.a]} → {tiers[c.b]}</td><td>{c.reasons.join(" ")}</td></tr>)}</tbody></table></div></details>
      <details className="compare-details"><summary>Window sensitivity and non-dominated tradeoffs</summary><p>All windows scale together; categorical gates stay fixed. Pareto compares oxygen, pressure, flow and selected thickness distances independently, among documented matches only. Ties remain; missing distances are never zero.</p><table><thead><tr><th>Scale</th><th>A documented / partial / analogue</th><th>B documented / partial / analogue</th></tr></thead><tbody>{result.sensitivity.map(s => <tr key={s.scale}><th>{s.scale}×</th><td>{s.a.documented} / {s.a.partial} / {s.a.analogue}</td><td>{s.b.documented} / {s.b.partial} / {s.b.analogue}</td></tr>)}</tbody></table><p>Pareto A: {result.paretoA.join(", ") || "none"}. Pareto B: {result.paretoB.join(", ") || "none"}.</p></details>
      <details className="compare-details"><summary>Inspect A observations and reasons</summary><Evidence data={result.a} pareto={result.paretoA} /></details><details className="compare-details"><summary>Inspect B observations and reasons</summary><Evidence data={result.b} pareto={result.paretoB} /></details>
      <h3>Questions for the next review</h3><ul>{result.questions.map(q => <li key={q}>{q}</li>)}</ul>
    </section>)}
    <section className="panel compare-section"><h2>3. Plan tests for missing evidence</h2><p>Build a target region using all inventory items and B’s gravity/diluent. Each candidate assumes the selected material, form, thickness, direction and endpoint. Proposed coverage is conditional; no outcome is predicted or observed.</p><div className="compare-controls">
      <label>Target oxygen levels · %<input value={oxygenLevels} onChange={e => setOxygenLevels(e.target.value)} /></label><label>Target pressure levels · psia<input value={pressureLevels} onChange={e => setPressureLevels(e.target.value)} /></label><label>Target flow levels · cm/s<input value={flowLevels} onChange={e => setFlowLevels(e.target.value)} /></label><NumberField label="Budget · assumed cost units" value={spec.budget} onChange={v => set("budget", v)} />
      <label className="compare-check"><input type="checkbox" checked={spec.allowUnknownFeasibility} onChange={e => set("allowUnknownFeasibility", e.target.checked)} />Allow candidates with unknown feasibility (conditional proposals)</label></div>
      <button className="btn" onClick={generate}>Generate target grid and candidates</button><p>{spec.targets.length} targets · {spec.candidates.length} candidates. Generated candidates cost 1 assumed unit each. Changing A/B does not regenerate the grid; regenerate explicitly. Inventory edits apply to existing points.</p>
      <details className="compare-details"><summary>Edit target points and candidate assumptions</summary><button className="btn" onClick={() => { setCandidateDraft(JSON.stringify(spec.candidates, null, 2)); setTargetDraft(JSON.stringify(spec.targets, null, 2)); }}>Load current planner into editors</button>
        <label className="mission-editor">Target points (JSON)<textarea value={targetDraft} onChange={e => setTargetDraft(e.target.value)} spellCheck={false} /></label><label className="mission-editor">Candidate tests (JSON)<textarea value={candidateDraft} onChange={e => setCandidateDraft(e.target.value)} spellCheck={false} /></label><p>Feasibility: unknown, assumed-feasible or infeasible. Positive costs; maximum 96 targets and candidates each. IDs break coverage/cost ties.</p>
        <button className="btn" onClick={() => { try { apply({ ...spec, targets: JSON.parse(targetDraft), candidates: JSON.parse(candidateDraft) }, "Planner assumptions applied."); } catch (e) { setStatus(String(e)); } }}>Apply planner edits</button></details>
      {report && <><p>{report.planner.existing.length} targets have documented evidence; {report.planner.proposedCoverage.length} additional targets could be addressed; {report.planner.remaining.length} remain uncovered. Assumed cost: {report.planner.spent} / {report.planner.budget}.</p><p>{report.planner.method}</p>
        <div className="compare-table-wrap"><table><caption>Hypothetical tests — no measured results</caption><thead><tr><th>Step / candidate</th><th>Conditions</th><th>Marginal targets</th><th>Cost / cumulative</th><th>Feasibility</th></tr></thead><tbody>{report.planner.steps.map((s, n) => <tr key={s.candidate.id}><th>{n + 1}. {s.candidate.id}<br />{s.candidate.itemId}</th><td>{s.candidate.atmosphere.oxygenPct}% O₂ · {s.candidate.atmosphere.pressurePsi} psia · {s.candidate.atmosphere.flowCms} cm/s<br />{s.candidate.atmosphere.gravity} · {s.candidate.atmosphere.diluent}</td><td>{s.marginalGain}<details><summary>Target IDs</summary>{s.gained.join(", ")}</details></td><td>{s.candidate.cost} / {s.cumulativeCost}</td><td>{s.candidate.feasibility}</td></tr>)}</tbody></table></div><p className="compare-warning">{report.planner.feasibility}</p>
        <details className="compare-details"><summary>Uncovered targets and existing coverage</summary><p>Existing: {report.planner.existing.join(", ") || "none"}</p><p>Uncovered: {report.planner.remaining.join(", ") || "none"}</p><pre className="mission-json">{JSON.stringify(spec.targets, null, 2)}</pre></details></>}
    </section>
    <section className="panel compare-section"><h2>4. Save and reproduce</h2><p>Export both atmospheres, inventory, all row decisions, source cells, sensitivity and planner assumptions with an offline Node.js runner. This reproduces calculations, not independent PDF extraction.</p>
      <div className="mission-actions"><button className="btn" disabled={!report || busy} onClick={download}>{busy ? "Preparing package…" : "Download mission reproduction ZIP"}</button><button className="btn" disabled={!report} onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#mission?spec=${encodeURIComponent(JSON.stringify(spec))}`); setStatus("Mission link copied. It contains your inventory and assumptions."); } catch { setStatus("Clipboard unavailable. Use the specification or package instead."); } }}>Copy mission link</button></div>
      <details className="compare-details"><summary>Import or inspect mission specification</summary><button className="btn" onClick={() => setImportDraft(JSON.stringify(spec, null, 2))}>Load current specification</button><label className="mission-editor">Mission specification (JSON)<textarea value={importDraft} onChange={e => setImportDraft(e.target.value)} spellCheck={false} /></label><button className="btn" onClick={() => { try { apply(JSON.parse(importDraft), "Mission restored."); } catch (e) { setStatus(String(e)); } }}>Import specification</button></details><ul>{report?.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </section><p className="mission-status" role="status" aria-live="polite">{status}</p>
  </main>;
}
