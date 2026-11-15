import { useId, useState } from "react";
import { ASK_MAX, SUGGESTED_ASKS } from "../lib/recorded";
import type { Analysis } from "./useAnalysis";

const ORIGIN_LABEL = { nasa: "NASA", derived: "NASA data · EMBER-computed", ember: "EMBER", user: "Scenario" } as const;

/**
 * "Ask EMBER": a typed question, one-click suggestions, or an analysis of the whole scenario.
 * Every answer goes through the same evidence package and grounding check.
 */
export function AskForm({ analysis, onSubmit, compact = false }: { analysis: Analysis; onSubmit?: () => void; compact?: boolean }) {
  const [text, setText] = useState("");
  const inputId = useId();
  const { live, busy, canRun, status } = analysis;
  const go = (ask?: string) => {
    onSubmit?.();
    void analysis.run(ask ?? null);
  };
  const typedOk = live && text.trim().length >= 3;
  const chips = !status || live ? SUGGESTED_ASKS : SUGGESTED_ASKS.filter((q) => canRun(q));

  return (
    <div className={`ask${compact ? " ask-compact" : ""}`}>
      <form className="ask-row" onSubmit={(e) => { e.preventDefault(); if (typedOk) go(text); }}>
        <label htmlFor={inputId} className="sr-only">Your question about this scenario</label>
        <input
          id={inputId}
          type="text"
          value={text}
          maxLength={ASK_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={!status ? "Connecting…" : live ? "Ask about this scenario, e.g. why is the top match first?" : chips.length ? "Live AI is off here; try a suggested question" : "Live AI is off here"}
          disabled={!live || busy}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit" disabled={!typedOk || busy} aria-busy={busy}>
          {busy ? "Checking…" : "Ask"}
        </button>
      </form>
      {/* Without a live model only suggestions with a recorded answer are offered; while connecting all show, disabled. */}
      {chips.length > 0 ? (
        <div className="ask-chips" role="group" aria-label="Suggested questions">
          {chips.map((q) => (
            <button key={q} type="button" className="ask-chip" onClick={() => go(q)} disabled={busy || !canRun(q)}>
              {q}
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted">Suggested questions replay recorded answers on the unedited presets.</p>
      )}
      <button type="button" className="btn ask-whole" onClick={() => go()} disabled={busy || !canRun(null)}>
        {!live && canRun(null) ? "Show the recorded analysis of this scenario" : "Or analyze the whole scenario"}
      </button>
    </div>
  );
}

/** The checked answer: verdict and receipt, the summary, each claim with its verified excerpts. */
export function AnalysisReport({ analysis }: { analysis: Analysis }) {
  const { result, stale, busy } = analysis;
  const report = result?.report;
  if (busy) return <p className="small muted ask-wait" role="status">Waiting for the model and the grounding check. This can take up to a minute or two.</p>;
  if (!result) return null;
  return (
    <div className="analysis-result" aria-live="polite">
      <p className="ask-question">
        <span className="eyebrow">{result.ask ? "You asked" : "Whole-scenario analysis"}</span>
        {result.ask && <span>“{result.ask}”</span>}
      </p>
      {stale && <p className="small warn-note">The scenario changed since this answer. Ask again to update it.</p>}
      {result.error && <p className="warn-text" role="alert">{result.error}</p>}
      {report && (
        <div className={`analysis-body ${stale ? "is-stale" : ""}`}>
          <div className={`verdict verdict-${report.verdict}`}>
            <strong>
              {report.verdict === "accepted" ? "All claims passed the source check" : report.verdict === "partial" ? "Some claims were rejected" : "Answer rejected"}
            </strong>
            <span className="small">
              {report.receipt.acceptedClaims} of {report.receipt.claims} claims kept · {report.receipt.excerpts} verified excerpts:{" "}
              {report.receipt.nasaExcerpts} NASA text ({report.receipt.tableRowExcerpts ?? 0} run-table rows), {report.receipt.derivedExcerpts ?? 0} EMBER-computed from NASA tables, {report.receipt.emberExcerpts} EMBER, {report.receipt.userExcerpts} scenario
            </span>
            <span className="small">
              {result.recorded ? "Recorded" : result.cached ? "Cached live answer" : "Live"} · {result.model}
              {result.attempts === 2 ? " · corrected once after the check" : ""}
              {result.ms ? ` · ${(result.ms / 1000).toFixed(0)} s` : ""}
              {result.generatedAt ? ` · ${result.generatedAt.slice(0, 10)}` : ""}
            </span>
          </div>
          {report.verdict !== "rejected" && report.summary.accepted && <p className="analysis-summary">{report.summary.text}</p>}
          {!report.summary.accepted && <p className="small warn-text">Summary withheld: {report.summary.problems.join(" ")}</p>}
          <ol className="claims">
            {report.claims.map((c, i) => (
              <li key={i} className={c.accepted ? "claim ok" : "claim rejected"}>
                {c.accepted ? (
                  <>
                    <p><span className="badge kind">{c.kind}</span> {c.text}</p>
                    {c.implication && <p className="small implication"><strong>Implication:</strong> {c.implication}</p>}
                    <ul className="cites">
                      {c.citations.map((ct, j) => (
                        <li key={j}>
                          <span className={`badge ${ct.origin === "nasa" ? "badge-psi" : ""}`}>{ORIGIN_LABEL[ct.origin]}</span>{" "}
                          <span className="small muted">{ct.label}:</span> <q>{ct.excerpt}</q>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <details>
                    <summary className="small">Rejected {c.kind?.toLowerCase() ?? "claim"}: {c.problems.join(" ")}</summary>
                    <p className="small muted">{c.text}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
          {report.verdict !== "rejected" && report.openQuestions.length > 0 && (
            <div className="consider">
              <span className="eyebrow">Open questions the evidence cannot answer</span>
              <ul>{report.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The full AI view (inside the dashboard dialog). The model is treated as an untrusted author:
 * the server checks every excerpt and number against the evidence package, retries once with
 * the checker's findings, and this view shows what was kept, what was dropped and why.
 */
export function AnalysisCard({ analysis }: { analysis: Analysis }) {
  const { status, live } = analysis;
  return (
    <section className="card analysis">
      <AskForm analysis={analysis} />
      <details className="fold fold-inline">
        <summary><span>How the check works</span><span className="disclose" aria-hidden /></summary>
        <p className="small muted">
          {live ? `${status?.provider} (${status?.model})` : "Google Gemini"} reads a server-built package of NASA PSI
          text, run-table ranges, the NASA table rows nearest your scenario and EMBER's limitations, plus your question if you
          asked one. EMBER rejects any claim whose excerpt is not found word for word in the source it cites (NASA text or
          EMBER’s own summaries, labelled), or whose numbers do not appear in those sources, your scenario or Earth reference
          values, and asks the model once to correct what failed. Numbers typed only in a question are not accepted: set them
          in the scenario panel instead. This makes the basis auditable; it does not prove the reasoning is right.
        </p>
      </details>
      {live && (
        <p className="small muted">
          Unedited presets replay recorded answers instantly. Anything else is a live answer
          {status?.limits ? ` (up to ${status.limits.perVisitor} per ${status.limits.windowMinutes} minutes per visitor; repeated questions are served from cache)` : ""}.
        </p>
      )}
      {status && !live && (
        <p className="small warn-note">
          No live model is connected here. Unedited presets replay answers recorded through the same pipeline, labelled as recorded.
          To ask your own questions locally, put <code>GEMINI_API_KEY=…</code> in <code>.env.local</code> and restart <code>npm run dev</code>.
        </p>
      )}
      <AnalysisReport analysis={analysis} />
    </section>
  );
}
