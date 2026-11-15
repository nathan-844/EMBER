import { useEffect, useMemo, useState } from "react";
import { getTable, summarizeTable, tablesFor, buildRowsCsv, type ColumnSummary } from "../lib/explorer";
import { cleanHeader, isNoValue } from "../lib/cells";
import { downloadText } from "../lib/brief";
import type { RankedInvestigation } from "../lib/ranking";
import { DownloadIcon, ExternalIcon } from "./icons";

const fmt = (n: number) => String(+n.toPrecision(4));

function valueText(c: ColumnSummary): string {
  const unit = c.unit ? ` ${c.unit}` : "";
  if (c.sameListEveryRow) return `${c.examples[0]} in every row (a test matrix)`;
  if (c.numeric) return `${fmt(c.numeric.min)}–${fmt(c.numeric.max)}${unit} · ${c.distinct} distinct`;
  return `${c.distinct} distinct: ${c.examples.join(" · ")}${c.distinct > 3 ? " …" : ""}`;
}

/** What each ranked investigation varied, held fixed and measured, read from its NASA run tables. */
export function TableExplorer({ ranked }: { ranked: RankedInvestigation[] }) {
  const options = useMemo(() => ranked.map((r) => r.investigation).filter((inv) => tablesFor(inv).length), [ranked]);
  const [id, setId] = useState(options[0]?.id ?? "");
  const [tableIdx, setTableIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Follow the lead when the ranking changes and the chosen profile drops out.
  useEffect(() => {
    if (!options.some((o) => o.id === id)) setId(options[0]?.id ?? "");
  }, [options, id]);
  useEffect(() => { setTableIdx(0); setShowAll(false); }, [id]);

  const inv = options.find((o) => o.id === id);
  if (!inv) return null;
  const metas = tablesFor(inv);
  const meta = metas[Math.min(tableIdx, metas.length - 1)];
  const s = summarizeTable(meta);
  const t = getTable(meta.id);
  const rows = showAll ? t.rows : t.rows.slice(0, 12);
  const byRole = (role: ColumnSummary["role"]) => s.varied.filter((c) => c.role === role);

  return (
    <section className="card" aria-labelledby="explorer-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Data explorer · NASA run tables</p>
          <h3 id="explorer-title">What each investigation varied and measured</h3>
        </div>
        <div className="hero-actions">
          <button className="btn" onClick={() => downloadText(`ember-rows-${inv.id}.csv`, buildRowsCsv([inv]), "text/csv")}>
            <DownloadIcon /> {inv.name} rows (.csv)
          </button>
          <button className="btn" onClick={() => downloadText("ember-rows-ranked.csv", buildRowsCsv(options), "text/csv")} title="Every ranked investigation that has a stored NASA table">
            <DownloadIcon /> All ranked (.csv)
          </button>
        </div>
      </div>
      <p className="small muted">
        Every filled cell, one line per run and column, with the NASA table, its SHA-256, the source row, the value as NASA wrote
        it and, for ranked conditions, the value in EMBER's unit. Column roles are judged from NASA's headers.
      </p>

      <div className="explorer-pick">
        <label className="field-label" htmlFor="explorer-inv">Investigation (in ranked order)</label>
        <select id="explorer-inv" value={inv.id} onChange={(e) => setId(e.target.value)}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.fullName}</option>)}
        </select>
        {metas.length > 1 && (
          <div className="segmented small-seg" role="group" aria-label="NASA table">
            {metas.map((m, i) => (
              <button key={m.id} aria-pressed={i === tableIdx} onClick={() => setTableIdx(i)}>{m.file.replace(/^PSI-\d+_Experimental table_/, "").replace(/\.csv$/i, "")}</button>
            ))}
          </div>
        )}
      </div>

      <p className="small">
        <a href={meta.url} target="_blank" rel="noreferrer">NASA {meta.id} <ExternalIcon /></a>{" "}
        <span className="muted">· {meta.file} · {s.rows} runs</span>
      </p>

      <div className="explorer-grid">
        {(["condition", "setting", "result"] as const).map((role) => (
          <div key={role}>
            <h4 className="explorer-h">{role === "condition" ? "Ranked conditions that varied" : role === "setting" ? "Settings that varied" : "Results recorded"}</h4>
            {byRole(role).length ? (
              <ul className="col-list">
                {byRole(role).map((c) => (
                  <li key={c.header}>
                    <strong>{c.header}</strong>
                    <span className="muted"> {valueText(c)}</span>
                    {c.dropped && <span className="warn-text"> · left out as impossible: {c.dropped.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">None in this table.</p>}
          </div>
        ))}
      </div>

      <p className="small"><strong>Held fixed in every run:</strong>{" "}
        {s.fixed.length ? s.fixed.map((c) => `${c.header} = ${c.examples[0]}`).join(" · ") : <span className="muted">nothing</span>}
      </p>
      {(s.bookkeeping.length > 0 || s.empty.length > 0 || s.noValueCells > 0) && (
        <p className="small muted">
          {s.bookkeeping.length > 0 && <>Run ids and dates: {s.bookkeeping.join(", ")}. </>}
          {s.empty.length > 0 && <>Empty columns: {s.empty.join(", ")}. </>}
          {s.noValueCells > 0 && <>{s.noValueCells} cells say "no measurement" (a dash) and are left out.</>}
        </p>
      )}

      <details className="fold fold-inline">
        <summary><span>NASA rows · {t.rows.length} run{t.rows.length === 1 ? "" : "s"}</span><span className="disclose" aria-hidden /></summary>
      <div className="table-scroll" tabIndex={0} aria-label={`NASA ${meta.id} rows`}>
        <table className="run-table">
          <thead>
            <tr><th>Row</th>{t.header.map((h, i) => <th key={i}>{cleanHeader(h)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sourceRow}>
                <td className="muted">{r.sourceRow}</td>
                {t.header.map((_, i) => {
                  const v = r.cells[i] ?? "";
                  return <td key={i} className={isNoValue(v) ? "muted" : undefined}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.rows.length > 12 && (
        <button className="link-btn center" onClick={() => setShowAll(!showAll)}>{showAll ? "Show the first 12 rows" : `Show all ${t.rows.length} rows`}</button>
      )}
      </details>
    </section>
  );
}
