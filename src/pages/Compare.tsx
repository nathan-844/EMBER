import { useEffect, useMemo, useState } from "react";
import engineCode from "virtual:analysis-engine";
import { analyze, sensitivity, validateSpec, GROUPS, LIMITATIONS, type AnalysisSpec, type AnalysisResult, type Group } from "../lib/analysis/engine";
import { assertSnapshot, DEFAULT_SPEC, OBSERVATIONS } from "../lib/analysis/bass";
import { SOURCE_MANIFEST } from "../lib/analysis/review";
import { packageFiles, zipFiles } from "../lib/analysis/export";
import "./compare.css";

const number = (n: number | null) => n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const span = (r: [number, number] | null) => r ? `${number(r[0])} to ${number(r[1])}` : "—";
export function readSharedSpec(hash: string): { spec: AnalysisSpec; error: string } {
  try {
    const encoded = new URLSearchParams(hash.split("?")[1] ?? "").get("spec");
    if (!encoded) return { spec: DEFAULT_SPEC, error: "" };
    const spec = JSON.parse(encoded) as AnalysisSpec;
    const errors = validateSpec(spec);
    if (errors.length) throw new Error(errors.join(" "));
    assertSnapshot(spec);
    return { spec, error: "" };
  } catch (e) { return { spec: DEFAULT_SPEC, error: `Shared analysis could not be loaded. ${e instanceof Error ? e.message : "Invalid specification."}` }; }
}
function Distribution({ result, spec }: { result: AnalysisResult; spec: AnalysisSpec }) {
  if (!result.used.length) return null;
  const lo = Math.min(0, ...result.used.map((r) => r.delta)), hi = Math.max(1, ...result.used.map((r) => r.delta));
  const x = (n: number) => 130 + (n - lo) / (hi - lo) * 510;
  return <figure className="compare-distribution">
    <svg viewBox="0 0 680 170" role="img" aria-label="Individual numeric CO changes by cohort. Orange bars mark medians; exact values are in the observation ledger.">
      {[0, 1].map((i) => <g key={i}>
        <text x="0" y={45 + 60 * i}>{i === 0 ? "A · " + spec.a : "B · " + spec.b}</text>
        <line x1="130" x2="640" y1={40 + 60 * i} y2={40 + 60 * i} stroke="currentColor" opacity=".2" />
      </g>)}
      {result.used.map((r, i) => <circle key={r.id} cx={x(r.delta)} cy={(r.cohort === "A" ? 40 : 100) + ((i % 5) - 2) * 4} r="3.5" fill="currentColor" opacity=".7"><title>{r.id}: {number(r.delta)} ppm</title></circle>)}
      {[result.a.median, result.b.median].map((m, i) => m !== null && <line key={i} x1={x(m)} x2={x(m)} y1={24 + 60 * i} y2={56 + 60 * i} stroke="#ee814e" strokeWidth="4" />)}
      <text x="130" y="142">{number(lo)}</text><text x="640" y="142" textAnchor="end">{number(hi)} ppm</text>
    </svg>
    <figcaption>Each dot is one numeric observation; orange bars show medians. Off-scale readings remain in the exclusion ledger.</figcaption>
  </figure>;
}
export default function Compare() {
  const [initial] = useState(() => readSharedSpec(window.location.hash));
  const [spec, setSpec] = useState(initial.spec);
  const [loadError, setLoadError] = useState(initial.error);
  const [history, setHistory] = useState<AnalysisSpec[]>([initial.spec]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onHash = () => {
      if (!window.location.hash.startsWith("#compare")) return;
      const next = readSharedSpec(window.location.hash);
      setSpec(next.spec); setLoadError(next.error); setHistory([next.spec]); setNotice("");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const result = useMemo(() => analyze(OBSERVATIONS, spec), [spec]);
  const policies = useMemo(() => sensitivity(OBSERVATIONS, spec), [spec]);
  function update(patch: Partial<AnalysisSpec>) {
    const next = { ...spec, ...patch };
    setSpec(next); setHistory((h) => [...h, next]); setNotice("");
    // Remove an old shared spec from the address bar as soon as controls change.
    window.history.replaceState(null, "", "#compare");
  }
  async function download() {
    setBusy(true); setNotice("");
    try {
      const files = await packageFiles(spec, engineCode, history);
      const blob = new Blob([new Uint8Array(zipFiles(files))], { type: "application/zip" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `ember-bass-analysis-${spec.dataset}.zip`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Package downloaded. Unzip it and run: node reproduce.mjs");
    } catch (e) { setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }
  async function share() {
    const url = new URL(window.location.href);
    url.hash = "compare?" + new URLSearchParams({ spec: JSON.stringify(spec) }).toString();
    window.history.replaceState(null, "", url);
    try { await navigator.clipboard.writeText(url.href); setNotice("Exact analysis link copied. The link pins the data and review versions."); }
    catch { setNotice("The exact analysis link is in your address bar; copy it to share."); }
  }
  if (loadError) return <main className="page compare-page"><section className="card compare-section" role="alert"><h1>Analysis link needs attention</h1><p>{loadError}</p><button className="btn btn-primary" onClick={() => { setLoadError(""); update(DEFAULT_SPEC); }}>Start a new comparison</button></section></main>;
  return <main className="page compare-page">
    <header className="land-hero findings-hero">
      <p className="eyebrow accent">Compare · BASS-II · exploratory analysis</p>
      <h1>Ask the data. <span>Take the calculation with you.</span></h1>
      <p className="land-lede">Compare measured changes in glovebox carbon monoxide for PMMA slabs and SIBAL fabric. Change the oxygen window or review policy, inspect every exclusion, and reproduce the result offline.</p>
      <p className="muted">Data snapshot {spec.dataset} · {spec.reviewVersion} · final CO − initial CO, in ppm</p>
    </header>
    <section className="card compare-section" aria-labelledby="controls-title">
      <h2 id="controls-title">1. Define the comparison</h2>
      <div className="compare-controls">
        <label>Cohort A<select value={spec.a} onChange={(e) => update({ a: e.target.value as Group })}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label>Cohort B<select value={spec.b} onChange={(e) => update({ b: e.target.value as Group })}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label>Minimum starting O₂ (vol%)<input type="number" min="0" max="100" step="0.1" value={Number.isNaN(spec.oxygen[0]) ? "" : spec.oxygen[0]} onChange={(e) => update({ oxygen: [e.target.valueAsNumber, spec.oxygen[1]] })} /></label>
        <label>Maximum starting O₂ (vol%)<input type="number" min="0" max="100" step="0.1" value={Number.isNaN(spec.oxygen[1]) ? "" : spec.oxygen[1]} onChange={(e) => update({ oxygen: [spec.oxygen[0], e.target.valueAsNumber] })} /></label>
        <label>Source policy<select value={spec.sourceMode} onChange={(e) => update({ sourceMode: e.target.value as AnalysisSpec["sourceMode"] })}><option value="reviewed">Source-reconciled pairs</option><option value="raw">Raw numeric pairs</option></select></label>
        <label className="compare-check"><input type="checkbox" checked={spec.excludeQuestionable} onChange={(e) => update({ excludeQuestionable: e.target.checked })} />Exclude negative CO readings</label>
      </div>
      <p className="muted">Both policies retain only exact CO pairs and exclude implausible final oxygen. Reconciled mode also excludes unresolved source matches. This slice uses stated materials; an inferred-material toggle would not change it.</p>
      <button className="btn" onClick={() => update(DEFAULT_SPEC)}>Reset comparison</button>
    </section>
    <section className="card compare-section" aria-labelledby="result-title">
      <h2 id="result-title">2. Inspect the result</h2>
      <div aria-live="polite">
        {result.messages.map((m) => <p className="compare-warning" key={m}>{m}</p>)}
        <p><strong>{result.a.n} A + {result.b.n} B numeric observations used</strong> / {result.candidates} candidates · {result.excluded.length} excluded · {result.censored} censored in the candidate slice. Independent session count: unknown.</p>
        {result.difference !== null && <p className="compare-estimate">{number(result.difference)} <span>ppm median difference (A − B)</span></p>}
        {result.interval && <p>Exploratory 95% bootstrap interval: <strong>{span(result.interval)} ppm</strong>. {result.successfulReplicates} / {spec.replicates} replicates; seed {spec.seed}. Assumes independent observations; session dependence may make this too narrow.</p>}
        <p className="compare-warning">This is an observed concentration change under different test conditions. It does not establish that one material is intrinsically more toxic or predict a cabin fire.</p>
      </div>
      <div className="compare-table-wrap"><table><caption>Sample support and condition imbalance</caption><thead><tr><th>Quantity</th><th>A · {spec.a}</th><th>B · {spec.b}</th></tr></thead><tbody>
        <tr><th>Numeric observations</th><td>{result.a.n}</td><td>{result.b.n}</td></tr>
        <tr><th>Median CO change (ppm)</th><td>{number(result.a.median)}</td><td>{number(result.b.median)}</td></tr>
        <tr><th>CO change range (ppm)</th><td>{span(result.a.range)}</td><td>{span(result.b.range)}</td></tr>
        <tr><th>Starting O₂ range (vol%)</th><td>{span(result.a.startingOxygen)}</td><td>{span(result.b.startingOxygen)}</td></tr>
        <tr><th>Starting CO range (ppm)</th><td>{span(result.a.startingCo)}</td><td>{span(result.b.startingCo)}</td></tr>
      </tbody></table></div>
      <p>Common starting-oxygen range: {span(result.oxygenOverlap)} vol%. Overlap alone does not match samples, burn duration, geometry or airflow. Raw material dimensions and air-display strings are available in the ledger.</p>
      <Distribution result={result} spec={spec} />
    </section>
    <section className="card compare-section" aria-labelledby="sensitivity-title">
      <h2 id="sensitivity-title">3. Challenge the conclusion</h2>
      <p>Each row recomputes the same comparison under a named policy. The common-oxygen policy narrows both cohorts to the overlap of the raw eligible ranges. A disappearing estimate means insufficient evidence.</p>
      <div className="compare-table-wrap"><table><caption>Data-quality sensitivity · difference in ppm</caption><thead><tr><th>Policy</th><th>A / B used</th><th>Excluded</th><th>A − B median</th><th>95% interval</th><th>Direction</th></tr></thead><tbody>{policies.map(({ label, result: r }) => <tr key={label}><th>{label}</th><td>{r.a.n} / {r.b.n}</td><td>{r.excluded.length}</td><td>{number(r.difference)}</td><td>{span(r.interval)}</td><td>{r.difference === null ? "Insufficient" : r.difference > 0 ? "A > B" : r.difference < 0 ? "A < B" : "Equal"}</td></tr>)}</tbody></table></div>
      <details className="compare-details"><summary>Assumptions and uncertainty limits</summary><ul>{LIMITATIONS.map((s) => <li key={s}>{s}</li>)}</ul></details>
    </section>
    <section className="card compare-section" aria-labelledby="sources-title">
      <h2 id="sources-title">4. Audit the source trail</h2>
      <p><strong>{OBSERVATIONS.filter((o) => o.review.matched).length} / {OBSERVATIONS.length} candidate rows have matching gas-cell crosswalks</strong> (four cells per row). This is a Codex check against rendered NASA report tables, with no independent human or scientific sign-off. It does not validate the whole BASS-II dataset.</p>
      <p><a href={SOURCE_MANIFEST.summary.url} target="_blank" rel="noreferrer">NASA BASS-II summary report</a> · Tables A.4 and A.6, printed pp. 108–109 and 112–113. <a href={SOURCE_MANIFEST.psi.url} target="_blank" rel="noreferrer">PSI-25 dataset</a> · <a href={`https://doi.org/${SOURCE_MANIFEST.psi.doi}`} target="_blank" rel="noreferrer">Dataset DOI</a>.</p>
      <p><a href={SOURCE_MANIFEST.sensors.url + "#page=4"} target="_blank" rel="noreferrer">Published sensor context</a>: {SOURCE_MANIFEST.sensors.context}</p>
      <ul>{SOURCE_MANIFEST.unresolved.map((s) => <li key={s}>{s}</li>)}</ul>
      <details className="compare-details"><summary>Observation and exclusion ledger · all {OBSERVATIONS.length} candidates</summary>
        <div className="compare-table-wrap"><table><caption>Immutable PSI cells, report match and current eligibility</caption><thead><tr><th>Test / source row</th><th>Material / geometry</th><th>Initial → final CO (ppm)</th><th>Initial → final O₂ (vol%)</th><th>Raw air display</th><th>Report review</th><th>Current use</th></tr></thead><tbody>{OBSERVATIONS.map((r) => {
          const excluded = result.excluded.find((e) => e.id === r.id), used = result.used.find((u) => u.id === r.id);
          return <tr key={r.id}><th>{r.test}<br /><small>{r.id}</small></th><td>{r.material}</td><td>{r.coStartRaw || "missing"} → {r.coEndRaw || "missing"}</td><td>{number(r.o2Start)} → {number(r.o2End)}</td><td>{r.flowRaw || "missing"}</td><td><a href={SOURCE_MANIFEST.summary.url + `#page=${r.review.page}`} target="_blank" rel="noreferrer">PDF p. {r.review.page}</a><br />{r.review.note}</td><td>{used ? `${used.cohort}: ${number(used.delta)} ppm` : excluded?.reasons.join("; ") ?? "Analysis blocked"}</td></tr>;
        })}</tbody></table></div>
      </details>
    </section>
    <section className="card compare-section" aria-labelledby="export-title">
      <h2 id="export-title">5. Reproduce it anywhere</h2>
      <p>Download the exact specification, raw cells, included/excluded rows, source crosswalk, sensitivity results and a standalone Node runner with SHA-256 integrity checks. No server, API key or package install needed.</p>
      <div className="land-actions"><button className="btn btn-primary" disabled={busy || result.status === "blocked"} onClick={download}>{busy ? "Preparing package…" : "Download analysis (.zip)"}</button><button className="btn" disabled={result.status === "blocked"} onClick={share}>Copy analysis link</button></div>
      <p>Unzip and run <code>node reproduce.mjs</code> with Node.js 22+. The runner reconstructs the observations from raw cells and checks the complete unrounded result.</p>
      <p role="status">{notice}</p>
      <p className="muted">{history.length} control states recorded this visit and included in the package. The shared link contains the current state only. Related published result: <a href="#findings/F4">Finding F4</a>.</p>
    </section>
  </main>;
}
