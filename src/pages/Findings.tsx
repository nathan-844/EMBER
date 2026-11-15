import { useEffect } from "react";
import { FindingChart, FindingTable, IS_TABLE_FORM } from "../components/findings/FindingCharts";
import { RowsPanel } from "../components/findings/RowsPanel";
import { DownloadIcon } from "../components/icons";
import atlasCsvUrl from "../data/atlas/atlas.csv?url";
import rawFindings from "../data/findings.json";
import manifest from "../data/table-manifest.json";
import type { Finding, FindingsFile } from "../lib/findings/types";
import { atlasSourceName } from "../lib/atlas/names";

const FILE = rawFindings as unknown as FindingsFile;
const CITED = new Set(FILE.findings.flatMap((f) => f.rows)).size;
const nameOf = atlasSourceName;
const REPO = "https://github.com/nathan-844/EMBER/tree/main/src/lib/findings";

function FindingCard({ f }: { f: Finding }) {
  return (
    <article className="card finding" id={f.id} aria-labelledby={`${f.id}-title`}>
      <div className="finding-text">
        <p className="finding-meta">
          <span className="finding-id">{f.id}</span>
          {f.investigations.map((i) => <span key={i} className="badge">{nameOf(i)}</span>)}
          <span className="muted">{f.n.toLocaleString("en-US")} tests</span>
        </p>
        <h2 id={`${f.id}-title`}>{f.title}</h2>
        <p className="finding-claim">{f.claim}</p>
        <p className="finding-sure"><strong>How sure:</strong> {f.uncertainty.text} <span className="muted">({f.uncertainty.method})</span></p>
        <p className="finding-not"><strong>Not claimed:</strong> {f.notClaimed}</p>
        <details className="fold fold-inline">
          <summary><span>How this was computed</span><span className="disclose" aria-hidden /></summary>
          <div className="finding-how">
            <p>{f.method}</p>
            <h3>What else differs between these tests</h3>
            <ul>{f.confounders.map((c) => <li key={c}>{c}</li>)}</ul>
            {f.excluded.length > 0 && (
              <>
                <h3>Rows looked at but not used</h3>
                <ul>{f.excluded.map((e) => <li key={e.reason}><strong>{e.count}</strong> {e.reason}</li>)}</ul>
              </>
            )}
          </div>
        </details>
        <RowsPanel ids={f.rows} />
      </div>
      <figure className="finding-figure" aria-label={`${f.id} chart`}>
        <FindingChart f={f} />
        {!IS_TABLE_FORM.has(f.id) && (
          <details className="fold fold-inline">
            <summary><span>Table view</span><span className="disclose" aria-hidden /></summary>
            <FindingTable f={f} />
          </details>
        )}
      </figure>
    </article>
  );
}

/** "#findings/F3" opens the page at that finding (the landing page links each card this way). */
function useScrollToFinding() {
  useEffect(() => {
    const go = () => {
      const id = window.location.hash.split("/")[1];
      if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    // After the app's own scroll-to-top on a route change.
    const t = window.setTimeout(go, 0);
    window.addEventListener("hashchange", go);
    return () => { window.clearTimeout(t); window.removeEventListener("hashchange", go); };
  }, []);
}

export function Findings() {
  useScrollToFinding();
  const tableRows = manifest.tables.reduce((n, t) => n + t.rows, 0);
  return (
    <main className="page findings-page">
      <header className="land-hero findings-hero">
        <p className="eyebrow accent">Measured findings · computed, not written</p>
        <h1>Seven things NASA’s own measurements show. <span>Every number traced to its row.</span></h1>
        <p className="land-lede">
          EMBER reads all {tableRows.toLocaleString("en-US")} rows of {manifest.tables.length} NASA PSI run tables, plus the Saffire IV–VI paper,
          into one Fire Test Atlas. Each finding below is computed from those rows by code. Its sentence is generated from the computed
          numbers, and it lists the rows used, the rows left out, what else differs and what it does not claim. No AI writes any of it.
        </p>
        <dl className="land-stats">
          <div><dt>{FILE.findings.length}</dt><dd>findings, each recomputed and checked against NASA’s raw cells by automated tests</dd></div>
          <div><dt>{CITED.toLocaleString("en-US")}</dt><dd>NASA test rows cited, each one a click from the cells NASA wrote</dd></div>
          <div><dt>0</dt><dd>sentences written by a language model</dd></div>
        </dl>
      </header>

      <div className="findings-list">
        {FILE.findings.map((f) => <FindingCard key={f.id} f={f} />)}
      </div>

      <section className="card land-section findings-foot" aria-labelledby="atlas-h">
        <p className="eyebrow">Use the data yourself</p>
        <h2 id="atlas-h">The Fire Test Atlas</h2>
        <p className="land-text">
          One line per NASA test row, in one schema: fuel class, material, oxygen, pressure, flow, outcome and every measured result, with
          the NASA table, row and SHA-256 behind each line. Values NASA did not record stay blank, and data-quality problems are flagged rather
          than silently fixed.
        </p>
        <div className="land-actions">
          <a className="btn btn-primary" href={atlasCsvUrl} download="ember-fire-test-atlas.csv"><DownloadIcon /> Download the atlas (CSV)</a>
          <a className="btn land-btn" href={REPO} target="_blank" rel="noreferrer">Read the code behind each finding</a>
        </div>
      </section>
    </main>
  );
}
