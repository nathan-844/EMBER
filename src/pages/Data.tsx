// Data page: the Fire Test Atlas (every NASA test row, filterable, with NASA's raw cells) and the
// audit of NASA's tables. The compact atlas loads on demand.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DownloadIcon, ExternalIcon } from "../components/icons";
import atlasCsvUrl from "../data/atlas/atlas.csv?url";
import rawAudit from "../data/atlas/audit.json";
import type { AuditFile, AuditIssue, AuditKind } from "../lib/atlas/audit";
import type { CompactRow } from "../lib/atlas/compact";
import { displayValue } from "../lib/atlas/display";
import { FLAG_TEXT } from "../lib/atlas/specs";
import { atlasSourceName } from "../lib/atlas/names";
import { COUNTS } from "../lib/snapshot";

const AUDIT = rawAudit as unknown as AuditFile;
const invName = atlasSourceName;
const OUTCOME_WORDS: Record<string, string> = {
  extinguished: "went out", "burned-out": "burned away", disrupted: "broke apart", burned: "burned", "no-spread": "no flame spread",
  "no-ignition": "did not ignite", flash: "flash only", terminated: "fuel flow stopped", "not-recorded": "not recorded",
};
const KIND_WORDS: Record<AuditKind, string> = { error: "Likely error", gap: "Missing", note: "Quirk" };
const KIND_CLASS: Record<AuditKind, string> = { error: "badge-bad", gap: "badge-warn", note: "" };
const PAGE = 40;

function Atlas() {
  const [rows, setRows] = useState<CompactRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [fuel, setFuel] = useState("all");
  const [inv, setInv] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [testsOnly, setTestsOnly] = useState(true);
  const [flagged, setFlagged] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    import("../data/atlas/atlas-rows.json").then((m) => setRows(m.default as unknown as CompactRow[])).catch(() => setFailed(true));
  }, []);
  // The table makes the page taller once it loads; keep a linked section (#data/audit) in view.
  useEffect(() => {
    const id = window.location.hash.split("/")[1];
    if (rows && id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [rows]);
  useEffect(() => setPage(0), [fuel, inv, outcome, testsOnly, flagged, q]);

  const invs = useMemo(() => [...new Set((rows ?? []).map((r) => r.investigation))].sort((a, b) => invName(a).localeCompare(invName(b))), [rows]);
  const outcomes = useMemo(() => [...new Set((rows ?? []).map((r) => r.outcome))].sort(), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!testsOnly || r.kind === "test") && (fuel === "all" || r.fuel === fuel) && (inv === "all" || r.investigation === inv) &&
        (outcome === "all" || r.outcome === outcome) && (!flagged || r.flags.length > 0) &&
        (!needle || `${r.material} ${r.source} ${r.cells.map((c) => c[1]).join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [rows, fuel, inv, outcome, testsOnly, flagged, q]);

  if (failed) return <p className="warn-text">The atlas could not be loaded. You can still download the CSV above.</p>;
  if (!rows) return <p className="muted small">Loading the atlas…</p>;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const slice = shown.slice(page * PAGE, page * PAGE + PAGE);
  const num = (v: number | null, span?: [number, number]) => displayValue(v, span) ?? <span className="muted">—</span>;

  return (
    <>
      <div className="atlas-filters" role="group" aria-label="Filter the atlas">
        <label>Fuel
          <select value={fuel} onChange={(e) => setFuel(e.target.value)}>
            <option value="all">All fuels</option><option value="solid">Solid</option><option value="liquid">Liquid</option><option value="gas">Gas</option>
          </select>
        </label>
        <label>Investigation
          <select value={inv} onChange={(e) => setInv(e.target.value)}>
            <option value="all">All investigations</option>
            {invs.map((i) => <option key={i} value={i}>{invName(i)}</option>)}
          </select>
        </label>
        <label>Outcome
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="all">Any outcome</option>
            {outcomes.map((o) => <option key={o} value={o}>{OUTCOME_WORDS[o] ?? o}</option>)}
          </select>
        </label>
        <label className="grow">Search
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Material, table or any NASA cell" />
        </label>
        <label className="check"><input type="checkbox" checked={testsOnly} onChange={(e) => setTestsOnly(e.target.checked)} /> Tests only</label>
        <label className="check"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> Flagged only</label>
      </div>
      <p className="small muted" aria-live="polite">
        {shown.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} records. Select a row to see NASA’s cells exactly as written.
      </p>
      <CountsNote />
      <div className="table-scroll atlas-scroll" tabIndex={0} aria-label="Fire Test Atlas">
        <table className="run-table atlas-table">
          <thead>
            <tr><th scope="col">Source</th><th scope="col">Investigation</th><th scope="col">Fuel</th><th scope="col">Material</th><th scope="col">O₂ %</th><th scope="col">psia</th><th scope="col">Flow cm/s</th><th scope="col">Outcome</th><th scope="col">Flags</th></tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <AtlasRowView key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} num={num} />
            ))}
            {slice.length === 0 && <tr><td colSpan={9} className="muted">No record matches these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="atlas-pager">
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small muted">Page {page + 1} of {pages}</span>
          <button className="btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}

/** What the records are, so a row count is never read as a count of experiments. */
function CountsNote() {
  const k = COUNTS.rows.byKind, e = COUNTS.experiments;
  const n = (v: number) => v.toLocaleString("en-US");
  const reviewed = Object.entries(e.reviewed).map(([id, r]) => `${invName(id)}: ${r.experiments} runs in ${r.testRows} test rows`).join("; ");
  return (
    <details className="fold fold-inline counts-note">
      <summary><span>What these {n(COUNTS.rows.total)} records are</span><span className="disclose" aria-hidden /></summary>
      <ul className="small">
        <li><strong>{n(k.test)} test rows</strong>: one observation of one run each. They cover <strong>{n(e.total)} distinct experiments</strong>: where EMBER has reviewed run identities, a run measured twice counts once ({reviewed}). The other {n(e.unreviewedTestRows)} test rows are taken as one experiment each, which has not been reviewed.</li>
        <li><strong>{n(k.supplement)} supplement rows</strong>: measurements NASA lists in a second file for tests already counted (SAME-R particle sizes). Observations, never extra tests.</li>
        <li><strong>{n(k.session)} session rows</strong> summarise several runs, <strong>{n(k.matrix)} matrix rows</strong> list the levels a study tested, and <strong>{n(k.aside)} asides</strong> are footnotes, cleaning runs or blank lines.</li>
        <li>{n(COUNTS.rows.psi)} rows come from {COUNTS.sources.psiTables} NASA PSI tables and {COUNTS.rows.ntrs} from the Saffire IV–VI paper on NTRS.</li>
      </ul>
      <p className="small muted">Data snapshot <code>{COUNTS.snapshot.id}</code> (SHA-256 <code>{COUNTS.snapshot.sha256}</code>). The atlas download carries this id in its file name.</p>
    </details>
  );
}

function AtlasRowView({ r, open, onToggle, num }: { r: CompactRow; open: boolean; onToggle: () => void; num: (v: number | null, span?: [number, number]) => ReactNode }) {
  return (
    <>
      <tr className={open ? "is-open" : undefined}>
        <td><button className="row-btn" aria-expanded={open} onClick={onToggle}>{r.source.replace(/^NASA /, "")}</button></td>
        <td>{invName(r.investigation)}</td>
        <td>{r.fuel ?? <span className="muted">—</span>}</td>
        <td>{r.kind === "test" ? r.material : <span className="muted">{r.kind}</span>}</td>
        <td>{num(r.o2, r.o2Span)}</td><td>{num(r.psi, r.psiSpan)}</td><td>{num(r.flowCms, r.flowSpan)}</td>
        <td>{OUTCOME_WORDS[r.outcome] ?? r.outcome}</td>
        <td>{r.flags.length > 0 ? <span className="badge badge-warn">{r.flags.length}</span> : ""}</td>
      </tr>
      {open && (
        <tr className="atlas-detail">
          <td colSpan={9}>
            <p className="cited-head"><a href={r.url} target="_blank" rel="noreferrer">{r.source} <ExternalIcon /></a>{r.kindReason && <span className="muted">Not a test: {r.kindReason}</span>}</p>
            <dl className="cited-cells">{r.cells.filter(([, v]) => v).map(([c, v]) => <div key={c}><dt>{c}</dt><dd>{v}</dd></div>)}</dl>
            {r.flags.length > 0 && <ul className="atlas-flags">{r.flags.map((f) => <li key={f}><strong>{f}</strong> {FLAG_TEXT[f]}</li>)}</ul>}
          </td>
        </tr>
      )}
    </>
  );
}

function Issue({ i }: { i: AuditIssue }) {
  return (
    <li className="audit-issue">
      <p className="audit-head">
        <span className="finding-id">{i.id}</span>
        <span className={`badge ${KIND_CLASS[i.kind]}`}>{KIND_WORDS[i.kind]}</span>
        <strong>{i.title}</strong>
        <span className="muted">{i.table} · {i.count} {i.count === 1 ? i.unit.replace(/s$/, "") : i.unit}</span>
      </p>
      <p className="audit-detail">{i.detail}</p>
      <dl className="cited-cells">
        {i.examples.map((e, n) => <div key={n}><dt>{e.where}{e.column ? ` · ${e.column}` : ""}</dt><dd>{e.raw}</dd></div>)}
      </dl>
      <p className="audit-handling"><strong>What EMBER does:</strong> {i.handling}</p>
    </li>
  );
}

function Audit() {
  const [kind, setKind] = useState<AuditKind | "all">("all");
  const shown = AUDIT.issues.filter((i) => kind === "all" || i.kind === kind);
  const t = AUDIT.totals;
  return (
    <>
      <div className="chips" role="group" aria-label="Filter issues">
        {([["all", `All ${t.issues}`], ["error", `Likely errors ${t.error}`], ["gap", `Missing ${t.gap}`], ["note", `Quirks ${t.note}`]] as const).map(([k, label]) => (
          <button key={k} className={`chip${kind === k ? " on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>
      <ol className="audit-list">{shown.map((i) => <Issue key={i.id} i={i} />)}</ol>
    </>
  );
}

export function Data() {
  useEffect(() => {
    const go = () => {
      const id = window.location.hash.split("/")[1];
      if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    const timer = window.setTimeout(go, 0);
    window.addEventListener("hashchange", go);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", go); };
  }, []);
  const t = AUDIT.totals;
  return (
    <main className="page data-page">
      <header className="land-hero findings-hero">
        <p className="eyebrow accent">The data · open and checked</p>
        <h1>Every NASA fire test in one table. <span>And every problem we found in the files.</span></h1>
        <p className="land-lede">
          The Fire Test Atlas puts every row of NASA’s {t.tablesChecked} PSI combustion tables, plus the Saffire IV–VI paper, into one schema.
          Reading every cell turned up {t.issues} data-quality issues in {t.tablesAffected} of the {t.tablesChecked} tables. Nothing in NASA’s files is
          changed: each issue is listed with the cells as written and what EMBER does about it.
        </p>
        <div className="land-actions">
          <a className="btn btn-primary land-cta" href={atlasCsvUrl} download={`ember-fire-test-atlas-${COUNTS.snapshot.id}.csv`}><DownloadIcon /> Download the atlas (CSV)</a>
          <a className="btn land-btn" href="#data/audit">See the {t.issues} issues</a>
        </div>
      </header>

      <section className="card land-section" id="atlas" aria-labelledby="atlas-h2">
        <p className="eyebrow">Fire Test Atlas</p>
        <h2 id="atlas-h2">Browse every test</h2>
        <Atlas />
      </section>

      <section className="card land-section" id="audit" aria-labelledby="audit-h2">
        <p className="eyebrow">Data audit</p>
        <h2 id="audit-h2">{t.issues} issues in NASA’s tables: {t.error} likely errors, {t.gap} missing values, {t.note} quirks</h2>
        <p className="land-text">{AUDIT.method}</p>
        <Audit />
      </section>
    </main>
  );
}
