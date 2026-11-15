import { useState } from "react";
import type { CitedRow } from "../../lib/findings/rows";
import { ExternalIcon } from "../icons";

const OUTCOME_WORDS: Record<string, string> = {
  extinguished: "went out", "burned-out": "burned away", disrupted: "broke apart", burned: "burned", "no-spread": "no flame spread",
  "no-ignition": "did not ignite", flash: "flash only", terminated: "fuel flow stopped", "not-recorded": "not recorded",
};
const FIRST = 20;

/** The NASA rows behind a finding, with each cell exactly as NASA wrote it. Loads on first open. */
export function RowsPanel({ ids }: { ids: string[] }) {
  const [rows, setRows] = useState<Record<string, CitedRow> | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const load = () => {
    if (rows || failed) return;
    import("../../data/findings-rows.json")
      .then((m) => setRows(m.default as unknown as Record<string, CitedRow>))
      .catch(() => setFailed(true));
  };
  const shown = all ? ids : ids.slice(0, FIRST);
  return (
    <details className="fold fold-inline" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && load()}>
      <summary><span>Show the {ids.length} NASA rows behind this</span><span className="disclose" aria-hidden /></summary>
      {failed && <p className="small warn-text">The rows could not be loaded. They are also in src/data/atlas/atlas.csv.</p>}
      {!rows && !failed && <p className="small muted">Loading rows…</p>}
      {rows && (
        <>
          <ol className="cited-list" tabIndex={0} aria-label="NASA rows behind this finding">
            {shown.map((id) => {
              const r = rows[id];
              return (
                <li key={id}>
                  <p className="cited-head">
                    <a href={r.url} target="_blank" rel="noreferrer">{r.source} <ExternalIcon /></a>
                    <span>{r.material}</span>
                    <span className="muted">{OUTCOME_WORDS[r.outcome] ?? r.outcome}</span>
                  </p>
                  <dl className="cited-cells">
                    {r.cells.map(([c, v]) => <div key={c}><dt>{c}</dt><dd>{v || "—"}</dd></div>)}
                  </dl>
                </li>
              );
            })}
          </ol>
          <p className="small muted cited-note">Cells are shown exactly as NASA wrote them, including NASA’s own header spelling.</p>
          {ids.length > FIRST && (
            <button className="link-btn center" onClick={() => setAll(!all)}>{all ? `Show the first ${FIRST} rows` : `Show all ${ids.length} rows`}</button>
          )}
        </>
      )}
    </details>
  );
}
