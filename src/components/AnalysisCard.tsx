import { useEffect, useState } from "react";
import type { GroundingReport } from "../lib/grounding";
import { scenarioKey } from "../lib/recorded";
import type { Scenario } from "../lib/scenario";

interface Result {
  model?: string;
  generatedAt?: string;
  ms?: number;
  attempts?: number;
  report?: GroundingReport;
  recorded?: boolean;
  cached?: boolean;
  error?: string;
}

type Status = {
  enabled: boolean;
  provider?: string | null;
  model: string | null;
  recorded?: number;
  limits?: { perVisitor: number; windowMinutes: number; daily: number } | null;
  server: boolean;
};

const ORIGIN_LABEL = { nasa: "NASA", derived: "NASA data · EMBER-computed", ember: "EMBER", user: "Scenario" } as const;

/** Recorded answers for the unedited presets, loaded only when there is no live model. */
async function recordedFor(scenario: Scenario): Promise<Result | null> {
  const data = (await import("../data/recorded-analyses.json")).default as unknown as { entries: Record<string, Result> };
  const hit = data.entries[scenarioKey(scenario)];
  return hit ? { ...hit, recorded: true } : null;
}

/**
 * Optional AI synthesis. The model is treated as an untrusted author: the server
 * checks every excerpt and number against the evidence package, retries once with the
 * checker's findings, and this card shows what was kept, what was dropped and why.
 */
export function AnalysisCard({ scenario }: { scenario: Scenario }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [forKey, setForKey] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const key = JSON.stringify(scenario);

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s) => setStatus({ ...s, server: true }))
      .catch(() => setStatus({ enabled: false, model: null, server: false }));
  }, []);

  useEffect(() => {
    if (!status || status.enabled) return;
    let live = true;
    recordedFor(scenario).then((r) => live && setHasRecording(!!r));
    return () => { live = false; };
  }, [status, key]);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      if (!status?.enabled) {
        setResult((await recordedFor(scenario)) ?? { error: "No recorded analysis for this exact scenario." });
      } else {
        const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
        setResult(await r.json());
      }
      setForKey(key);
    } catch {
      setResult({ error: "Could not reach the EMBER server." });
    } finally {
      setBusy(false);
    }
  };

  const canRun = !!status && (status.enabled || hasRecording);
  const stale = result && forKey !== key;
  const report = result?.report;

  return (
    <section className="card analysis">
      <div className="section-head">
        <div>
          <p className="eyebrow">Grounded AI analysis · optional</p>
          <h3>What the evidence says about your scenario</h3>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={!canRun || busy} aria-busy={busy}>
          {busy ? "Analyzing…" : !status?.enabled && hasRecording ? "Show recorded analysis" : result ? "Re-analyze" : "Analyze scenario"}
        </button>
      </div>
      <p className="small muted">
        {status?.enabled ? `${status.provider} (${status.model})` : "Google Gemini"} reads a server-built package of NASA PSI
        text, run-table ranges, the NASA table rows nearest your scenario and EMBER's limitations. EMBER rejects any claim
        whose excerpt is not found word for word in the source it cites (NASA text or EMBER’s own summaries, labelled), or whose numbers do not appear in those sources,
        your scenario or Earth reference values, and asks the model once to correct what failed. This makes the basis
        auditable; it does not prove the reasoning is right.
      </p>
      {busy && <p className="small muted" role="status">Waiting for the model and the grounding check. This can take up to a minute or two.</p>}
      {status?.enabled && (
        <p className="small muted">
          Unedited presets show answers recorded through this same pipeline, instantly. Change any value for a fresh live
          analysis{status.limits ? ` (up to ${status.limits.perVisitor} per ${status.limits.windowMinutes} minutes per visitor; repeated scenarios are served from cache)` : ""}.
        </p>
      )}
      {status && !status.enabled && (
        <p className="small warn-note">
          {hasRecording
            ? "No live model is connected. This preset has an answer recorded through the same pipeline; it is labelled as recorded."
            : <>Live AI analysis is off. Put <code>GEMINI_API_KEY=…</code> in <code>.env.local</code> and restart <code>npm run dev</code>. Recorded answers exist for the unedited presets. Everything else on this page works without it.</>}
        </p>
      )}
      {stale && <p className="small warn-note">The scenario changed since this analysis. Re-analyze to update it.</p>}
      {result?.error && <p className="warn-text" role="alert">{result.error}</p>}
      {report && (
        <div className={`analysis-body ${stale ? "is-stale" : ""}`}>
          <div className={`verdict verdict-${report.verdict}`}>
            <strong>
              {report.verdict === "accepted" ? "All claims passed the grounding check" : report.verdict === "partial" ? "Some claims were rejected" : "Answer rejected"}
            </strong>
            <span className="small">
              {report.receipt.acceptedClaims} of {report.receipt.claims} claims kept · {report.receipt.excerpts} verified excerpts:{" "}
              {report.receipt.nasaExcerpts} NASA text ({report.receipt.tableRowExcerpts ?? 0} run-table rows), {report.receipt.derivedExcerpts ?? 0} EMBER-computed from NASA tables, {report.receipt.emberExcerpts} EMBER, {report.receipt.userExcerpts} scenario
            </span>
            <span className="small">
              {result?.recorded ? "Recorded" : result?.cached ? "Cached live answer" : "Live"} · {result?.model}
              {result?.attempts === 2 ? " · corrected once after the check" : ""}
              {result?.ms ? ` · ${(result.ms / 1000).toFixed(0)} s` : ""}
              {result?.generatedAt ? ` · ${result.generatedAt.slice(0, 10)}` : ""}
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
    </section>
  );
}
