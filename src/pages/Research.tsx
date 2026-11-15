import { useEffect, useMemo, useState } from "react";
import engine from "virtual:research-engine";
import { compareWorkbench, defaultWorkbench, validateWorkbench, type WorkbenchSpec } from "../lib/analysis/workbench";
import { RESEARCH_ATLAS, researchPackage } from "../lib/analysis/research-export";
import { zipFiles } from "../lib/analysis/export";
import { SNAPSHOT } from "../lib/snapshot";
import "./compare.css";
import { ResearchBenchmark } from "../components/ResearchBenchmark";

const names = { saffire: "Saffire-II · paired ground/orbit extent", flex: "FLEX · extinction diameter", smoke: "SAME / SAME-R · paired smoke ageing" };
const fmt = (n: number | null) => n === null ? "Not estimable" : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
function initial() {
  try {
    const raw = new URLSearchParams(window.location.hash.split("?")[1]).get("spec");
    if (!raw) return { spec: defaultWorkbench(SNAPSHOT.id), error: "" };
    const s = JSON.parse(raw) as WorkbenchSpec;
    if (validateWorkbench(s).length || s.snapshot !== SNAPSHOT.id) throw new Error("Invalid specification or stale snapshot. Use its original package.");
    return { spec: s, error: "" };
  } catch (e) { return { spec: defaultWorkbench(SNAPSHOT.id), error: String(e) }; }
}
export default function Research() {
  const [loaded] = useState(initial);
  const [linkError, setLinkError] = useState(loaded.error);
  const [spec, setSpec] = useState<WorkbenchSpec>(loaded.spec);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const restore = () => { if (window.location.hash.startsWith("#research?")) { const next = initial(); setSpec(next.spec); setLinkError(next.error); setNotice(""); } };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  const result = useMemo(() => compareWorkbench(RESEARCH_ATLAS.rows, spec), [spec]);
  const sensitivity = useMemo(() => [false, true].map((excludeFlagged) => ({ excludeFlagged, result: compareWorkbench(RESEARCH_ATLAS.rows, { ...spec, excludeFlagged }) })), [spec]);
  const update = (patch: Partial<WorkbenchSpec>) => { setSpec({ ...spec, ...patch }); setNotice(""); window.history.replaceState(null, "", "#research"); };
  const materials = [...new Set(RESEARCH_ATLAS.rows.filter((r) => spec.template === "saffire" ? r.investigation === "saffire-ii" : ["same", "same-r"].includes(r.investigation)).map((r) => r.material.name).filter((v): v is string => !!v))].sort();
  const range = (key: "pressure" | "diameter" | "oxygenA" | "oxygenB", label: string) => <fieldset><legend>{label}</legend>{[0, 1].map((i) => <label key={i}>{i ? "Maximum" : "Minimum"}<input aria-label={`${label} ${i ? "maximum" : "minimum"}`} type="number" step="any" value={Number.isNaN(spec[key][i]) ? "" : spec[key][i]} onChange={(e) => { const v = [...spec[key]] as [number, number]; v[i] = e.target.valueAsNumber; update({ [key]: v }); }} /></label>)}</fieldset>;
  async function download(all: boolean) {
    setBusy(true); setNotice("");
    try {
      const files = await researchPackage(engine, all ? null : spec);
      const url = URL.createObjectURL(new Blob([new Uint8Array(zipFiles(files))], { type: "application/zip" }));
      const a = document.createElement("a"); a.href = url; a.download = `ember-${all ? "eight-findings" : spec.template}-${SNAPSHOT.id}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Downloaded. Extract the ZIP, then run node reproduce.mjs with Node.js 22+.");
    } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  }
  async function share() {
    const url = new URL(window.location.href); url.hash = "research?" + new URLSearchParams({ spec: JSON.stringify(spec) }); window.history.replaceState(null, "", url);
    try { await navigator.clipboard.writeText(url.href); setNotice("Analysis link copied."); } catch { setNotice("Copy the current address to share this specification."); }
  }
  if (linkError) return <main className="page"><h1>Analysis link cannot be restored</h1><p>{linkError}</p><button className="btn" onClick={() => { setLinkError(""); update(defaultWorkbench(SNAPSHOT.id)); }}>Start a new analysis</button></main>;
  return <main className="page compare-page">
    <header className="land-hero"><p className="eyebrow accent">Research workbench · snapshot {SNAPSHOT.id}</p><h1>Compare experiments. <span>Keep the evidence intact.</span></h1><p className="land-lede">Paired outcomes, conditional extinction measurements and smoke ageing. Each calculation retains source rows, exclusions and limitations.</p><p><a href="#compare">BASS-II CO comparison</a> · <a href="#research-benchmark">Benchmark and known failures</a></p></header>
    <section className="card compare-section"><h2>Choose an analysis</h2><div className="compare-controls">
      <label>Template<select value={spec.template} onChange={(e) => update(defaultWorkbench(SNAPSHOT.id, e.target.value as WorkbenchSpec["template"]))}>{Object.entries(names).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {spec.template !== "flex" && <label>Material<select value={spec.material} onChange={(e) => update({ material: e.target.value })}><option value="all">All materials</option>{materials.map((m) => <option key={m}>{m}</option>)}</select></label>}
      {spec.template === "smoke" && <label>Flight<select value={spec.flight} onChange={(e) => update({ flight: e.target.value as WorkbenchSpec["flight"] })}><option value="all">Both flights</option><option value="same">SAME</option><option value="same-r">SAME-R</option></select></label>}
      {spec.template === "flex" && <><label>Fuel<select value={spec.fuel} onChange={(e) => update({ fuel: e.target.value })}>{[...new Set(RESEARCH_ATLAS.rows.filter((r) => r.investigation === "flex").map((r) => r.material.name))].map((f) => f && <option key={f}>{f}</option>)}</select></label><label>Diluent class<select value={spec.diluent} onChange={(e) => update({ diluent: e.target.value as WorkbenchSpec["diluent"] })}><option value="nitrogen">Nitrogen only</option><option>CO2</option><option>He</option></select></label>{range("oxygenA", "Cohort A oxygen (vol%)")}{range("oxygenB", "Cohort B oxygen (vol%)")}{range("pressure", "Pressure (psia)")}{range("diameter", "Initial diameter (mm)")}</>}
      <label className="compare-check"><input type="checkbox" checked={spec.excludeFlagged} onChange={(e) => update({ excludeFlagged: e.target.checked })} />Exclude questionable measurements</label>
    </div></section>
    <section className="card compare-section" aria-live="polite"><h2>Result and sample support</h2>{result.errors.map((e) => <p className="compare-warning" key={e}>{e}</p>)}<p className="compare-estimate">{fmt(result.estimate)}</p><p>{result.unit}</p>{result.interval && <p>Exploratory 95% bootstrap interval: {result.interval.map(fmt).join(" to ")}. 2,000 seeded resamples of observations (FLEX) or whole pairs (smoke).</p>}<p>{Object.entries(result.counts).map(([k, v]) => `${k}: ${fmt(v)}`).join(" · ")} · excluded: {result.excluded.length}</p><ul>{result.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
      <div className="compare-table-wrap"><table><caption>Quality-policy sensitivity</caption><thead><tr><th>Policy</th><th>Used</th><th>Excluded</th><th>Estimate</th><th>95% bootstrap interval</th></tr></thead><tbody>{sensitivity.map(({ excludeFlagged, result: r }) => <tr key={String(excludeFlagged)}><td>{excludeFlagged ? "Questionable measurements excluded" : "All eligible endpoints"}</td><td>{r.used.length}</td><td>{r.excluded.length}</td><td>{fmt(r.estimate)}</td><td>{r.interval?.map(fmt).join(" to ") ?? "Not estimated"}</td></tr>)}</tbody></table></div>
      <details className="compare-details"><summary>Included observations and paired endpoints</summary><div className="compare-table-wrap"><table><thead><tr><th>Identity</th><th>Source observations</th><th>Value</th><th>Conditions / endpoints</th></tr></thead><tbody>{result.used.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.observationIds.join(", ")}</td><td>{fmt(r.value)}</td><td>{r.details}</td></tr>)}</tbody></table></div></details>
      <details className="compare-details"><summary>Exclusions ({result.excluded.length})</summary><ul>{result.excluded.map((r, i) => <li key={`${r.id}-${i}`}>{r.id}: {r.reason}</li>)}</ul></details>
    </section>
    <section className="card compare-section"><h2>Reproduce the calculation</h2><p>The package rebuilds the Atlas and all eight findings from stored source cells, then verifies this comparison and the additive research schema. No app server or AI key required.</p><div className="land-actions"><button className="btn btn-primary" disabled={busy || result.status === "blocked"} onClick={() => download(false)}>Download this comparison</button><button className="btn" disabled={busy} onClick={() => download(true)}>Download all eight findings</button><button className="btn" disabled={result.status === "blocked"} onClick={share}>Copy analysis link</button></div><p role="status">{notice}</p></section>
    <section className="card compare-section"><h2>Atlas research schema v2</h2><p>The export includes {RESEARCH_ATLAS.rows.length} observations with quantity semantics, source identities and paired-observation relationships. Unknown sessions, numeric gravity and measurement uncertainty remain unknown.</p><p>The migration is additive: published finding definitions remain reproducible. Source licenses, workbook sheet/row identity, cached-formula handling and upstream hashes travel with each export. Unknown licenses are never relabelled CC0.</p></section>
    <ResearchBenchmark />
  </main>;
}
