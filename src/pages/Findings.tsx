import { useEffect } from "react";
import { FindingChart, FindingTable, IS_TABLE_FORM } from "../components/findings/FindingCharts";
import { RowsPanel } from "../components/findings/RowsPanel";
import { DownloadIcon } from "../components/icons";
import { Rail } from "../components/Workspace";
import atlasCsvUrl from "../data/atlas/atlas.csv?url";
import rawFindings from "../data/findings.json";
import { COUNTS } from "../lib/snapshot";
import type { Finding, FindingsFile } from "../lib/findings/types";
import { atlasSourceName } from "../lib/atlas/names";

const FILE = rawFindings as unknown as FindingsFile;
const CITED = new Set(FILE.findings.flatMap((f) => f.rows)).size;
const nameOf = atlasSourceName;
const REPO = "https://github.com/nathan-844/EMBER/tree/main/src/lib/findings";

type Num = Record<string, number | string>;
/** The one number each finding turns on, read from its computed numbers so the card cannot drift from the claim. */
const HEADLINE: Record<string, (n: Num) => { value: string; unit: string; sub: string }> = {
  F1: (n) => ({ value: `${n.groupsFallingOxygenMoreFuelLeft}`, unit: `of ${n.groups} groups`, sub: `Median flame went out at ${n.refLowRatio} of the droplet at ${n.refLowO2}% O₂, against ${n.refHighRatio} at ${n.refHighO2}%.` }),
  F2: (n) => ({ value: `${n.wentOut}`, unit: `of ${n.runs} went out`, sub: `At ${n.o2Levels}% O₂ and about 10 psia. In air at 1 atm, ${n.airWentOut} of ${n.airRuns} did.` }),
  F3: (n) => ({ value: `${n.earthFurther}`, unit: `of ${n.samples} samples`, sub: `${n.same} burned the same. None burned further in orbit.` }),
  F4: (n) => ({ value: `${n.ratio}×`, unit: "more CO", sub: `Median per burn: PMMA slab ${n.slabCoMedianPpm} ppm, SIBAL fabric ${n.fabricCoMedianPpm} ppm.` }),
  F5: (n) => ({ value: `${n.coolFlames}`, unit: `of ${n.runs} runs`, sub: `All with ${n.fuel} at ${n.pressureBar} bar and ${n.o2Min}–${n.o2Max}% O₂.` }),
  F6: (n) => ({ value: `${n.psiHighestO2}`, unit: "% O₂", sub: `NASA’s stored solid tests stop here. ${n.inZone} Saffire VI samples go higher; ${n.inZoneBurned === n.inZone ? "both" : n.inZoneBurned} burned.` }),
  F7: (n) => ({ value: `${n.rose}`, unit: `of ${n.burns} burns`, sub: `The median burn added ${n.medianRisePpm} ppm. One in ten added ${n.p90RisePpm} ppm or more.` }),
  F8: (n) => ({ value: `${n.medianRatio}×`, unit: "larger", sub: `Median diameter ${n.medianFreshUm} to ${n.medianAgedUm} µm. It grew in ${n.grew} of ${n.pairs} runs.` }),
};
const TONE: Record<string, string> = { F6: "accent", F8: "dark" };

function FindingTile({ f }: { f: Finding }) {
  const h = HEADLINE[f.id]?.(f.numbers as unknown as Num);
  return (
    <a className={`f-tile${TONE[f.id] ? ` f-tile-${TONE[f.id]}` : ""}`} href={`#findings/${f.id}`}>
      <span className="f-tile-meta"><span>{f.investigations.map(nameOf).join(", ")} · {f.n.toLocaleString("en-US")} {f.unit ?? "tests"}</span><span className="f-tile-id">{f.id}</span></span>
      {h && <span className="big-num">{h.value}<span>{h.unit}</span></span>}
      <strong className="f-tile-title">{f.title}</strong>
      {h && <span className="f-tile-sub">{h.sub}</span>}
      <span className="f-tile-link">Rows and method ↓</span>
    </a>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <article className="card finding" id={f.id} aria-labelledby={`${f.id}-title`}>
      <div className="finding-text">
        <p className="finding-meta">
          <span className="finding-id">{f.id}</span>
          {f.investigations.map((i) => <span key={i} className="badge">{nameOf(i)}</span>)}
          <span className="muted">{f.n.toLocaleString("en-US")} {f.unit ?? "tests"}</span>
        </p>
        <h2 id={`${f.id}-title`}>{f.title}</h2>
        <p className="finding-claim">{f.claim}</p>
        {f.id === "F4" && <p><a className="btn" href="#compare">Explore CO changes and download a reproducible comparison</a></p>}
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
  return (
    <main className="findings-page">
      <Rail>
        <section className="rail-card" aria-labelledby="check-h">
          <p className="rail-eyebrow">Computed by code, not AI</p>
          <h2 className="rail-title" id="check-h">Check it yourself</h2>
          <p className="small">Every finding reruns from a ZIP with Node alone. No server, no network, no AI key.</p>
          <dl className="side-stats">
            <div><dt>{FILE.findings.length}</dt><dd>Findings</dd></div>
            <div><dt>{CITED.toLocaleString("en-US")}</dt><dd>NASA rows cited</dd></div>
          </dl>
          <a className="pill pill-dark" href="#research">Reproduce all {FILE.findings.length}</a>
          <a className="pill pill-soft" href={atlasCsvUrl} download={`ember-fire-test-atlas-${COUNTS.snapshot.id}.csv`}><DownloadIcon /> Atlas (CSV)</a>
          <p className="rail-note">No combustion expert has reviewed these findings.</p>
        </section>
      </Rail>
      <header className="stage findings-hero">
        <p className="eyebrow accent">Measured findings · computed, not written</p>
        <h1>Eight things NASA’s own measurements show. <span>Every number traced to its row.</span></h1>
        <p className="land-lede">
          EMBER reads all {COUNTS.rows.psi.toLocaleString("en-US")} rows of {COUNTS.sources.psiTables} NASA PSI tables, plus the Saffire IV–VI paper,
          into one Fire Test Atlas. Each finding below is computed from those rows by code. Its sentence is generated from the computed
          numbers, and it lists the rows used, the rows left out, what else differs and what it does not claim. No AI writes any of it.
        </p>
        <dl className="land-stats">
          <div><dt>{FILE.findings.length}</dt><dd>findings, each recomputed and checked against NASA’s raw cells by automated tests</dd></div>
          <div><dt>{CITED.toLocaleString("en-US")}</dt><dd>NASA test rows cited, each one a click from the cells NASA wrote</dd></div>
          <div><dt>0</dt><dd>sentences written by a language model</dd></div>
        </dl>
      </header>

      <div className="f-tiles">
        {FILE.findings.map((f) => <FindingTile key={f.id} f={f} />)}
      </div>

      <h2 className="list-head">Each finding in full</h2>
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
          <a className="btn btn-primary" href="#research">Reproduce all eight findings offline</a>
          <a className="btn btn-primary" href={atlasCsvUrl} download={`ember-fire-test-atlas-${COUNTS.snapshot.id}.csv`}><DownloadIcon /> Download the atlas (CSV)</a>
          <a className="btn land-btn" href={REPO} target="_blank" rel="noreferrer">Read the code behind each finding</a>
        </div>
      </section>
    </main>
  );
}
