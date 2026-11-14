import { useState } from "react";
import { CONDITION_LABELS, MAX_CONDITION_POINTS, rangeLabel, rankLabel, type ConditionResult, type RankedInvestigation } from "../lib/ranking";
import { getPsiRecord } from "../data/psi";
import type { Scenario } from "../lib/scenario";
import { ExternalIcon } from "./icons";
import { RobustnessBar } from "./RobustnessBar";

const STATUS_TEXT: Record<ConditionResult["status"], string> = {
  match: "inside profile range",
  near: "just outside profile range",
  outside: "outside profile range",
  unknown: "profile has no normalized range",
  unspecified: "you left this unspecified",
};

function rangeText(c: ConditionResult): string {
  if (!c.range) return "";
  const tag = c.range.source === "psi-table" ? "PSI run table" : "curated estimate";
  const nearest = c.nearest != null ? `; nearest ${c.nearest}` : "";
  return ` (${rangeLabel(c.range)}${nearest}, ${tag}: ${c.range.basis})`;
}

function PsiRecordPanel({ accession }: { accession: string | null }) {
  const rec = getPsiRecord(accession);
  if (!rec) return null;
  const objectives = rec.objectives.length > 420 ? rec.objectives.slice(0, 420).trimEnd() + "…" : rec.objectives;
  return (
    <div className="psi-record">
      <p className="eyebrow">NASA PSI record · {rec.accession}</p>
      <p className="psi-title"><a href={rec.url} target="_blank" rel="noreferrer">{rec.title} <ExternalIcon /></a></p>
      <dl>
        {rec.subResearchArea && <><dt>Area</dt><dd>{rec.researchArea} · {rec.subResearchArea}</dd></>}
        {rec.flightPlatform && <><dt>Platform</dt><dd>{rec.flightPlatform}</dd></>}
        {rec.hardware && <><dt>Hardware</dt><dd>{rec.hardware}</dd></>}
        {(rec.startDate || rec.endDate) && <><dt>Investigation</dt><dd>{rec.startDate ?? "?"} to {rec.endDate ?? "?"}</dd></>}
        {rec.publicReleaseDate && <><dt>Public release</dt><dd>{rec.publicReleaseDate}</dd></>}
        {rec.publications.length > 0 && <><dt>Publications</dt><dd>{rec.publications.length} listed in PSI</dd></>}
      </dl>
      {objectives && <p className="psi-obj"><strong>Objectives (PSI):</strong> {objectives}</p>}
    </div>
  );
}

function Row({ r }: { r: RankedInvestigation }) {
  const [open, setOpen] = useState(false);
  const inv = r.investigation;
  const outsideO2 = r.conditions.find((c) => c.key === "oxygenPct")?.status === "outside";
  return (
    <li className="rank-row">
      <span className="rank-num">{rankLabel(r)}</span>
      <div className="rank-body">
        <h4>
          {inv.psi.url ? <a href={inv.psi.url} target="_blank" rel="noreferrer">{inv.name} <ExternalIcon /></a> : inv.name}
          <span className="full-name">{inv.fullName}</span>
        </h4>
        <p>{inv.summary}</p>
        <div className="tags">
          <span className={`badge ${r.relevance === "direct" ? "badge-ok" : ""}`}>{r.relevance === "direct" ? "Direct" : "Adjacent"}</span>
          <span className="small muted">{inv.hardware}</span>
          {inv.psi.accession ? (
            <a className="badge badge-psi" href={inv.psi.url!} target="_blank" rel="noreferrer" title={`NASA PSI record, matched ${inv.psi.verifiedOn}`}>
              NASA PSI · {inv.psi.accession} <ExternalIcon />
            </a>
          ) : (
            <span className="badge badge-warn">PSI record unverified</span>
          )}
        </div>
      </div>
      <div className="rank-score">
        <div className="score"><strong>{r.total}</strong>/100</div>
        <div className="small muted">question {r.questionPoints}/25 · conditions {r.conditionPoints}/{MAX_CONDITION_POINTS}</div>
        <div className="meter"><span style={{ width: `${r.total}%` }} /></div>
        <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {r.matchedCount}/{r.specifiedCount} specified conditions match · {open ? "hide" : "explain"}
        </button>
        {outsideO2 && <p className="warn-text">Selected oxygen is outside this profile's normalized envelope</p>}
      </div>
      {open && (
        <div className="explain">
          <ul>
            {r.conditions.map((c) => (
              <li key={c.key} className={`st-${c.status}`}>
                <strong>{CONDITION_LABELS[c.key]}</strong>: {STATUS_TEXT[c.status]}{rangeText(c)} — {c.points} pts
              </li>
            ))}
          </ul>
          {(inv.testedMaterials?.length || inv.testedFlowDirections?.length) ? (
            <p className="small muted">
              Recorded in the PSI run table (not scored):
              {inv.testedMaterials?.length ? ` materials ${inv.testedMaterials.join(", ")}.` : ""}
              {inv.testedFlowDirections?.length ? ` Flow direction ${inv.testedFlowDirections.join(" and ")}.` : ""}
            </p>
          ) : null}
          <PsiRecordPanel accession={inv.psi.accession} />
        </div>
      )}
    </li>
  );
}

export function RankedList({ ranked, scenario }: { ranked: RankedInvestigation[]; scenario: Scenario }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? ranked : ranked.slice(0, 5);
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Supporting evidence</p>
          <h3>Investigations ranked for your scenario</h3>
        </div>
        <span className="badge">Live matching</span>
      </div>
      <p className="small muted">
        Scores separate the safety question (25 points) from condition matching (75 points: 15 per condition inside its recorded range, 8 when just outside it).
        They do not estimate fire probability, confidence or safety. Equal scores share a rank only when the fuel match is the same; unknown fields earn no points.
      </p>
      <RobustnessBar scenario={scenario} />
      {ranked.length === 0 ? (
        <p className="muted">No profile addresses this question. Try including adjacent research.</p>
      ) : (
        <ol className="rank-list">{visible.map((r) => <Row key={r.investigation.id} r={r} />)}</ol>
      )}
      {ranked.length > 5 && (
        <button className="link-btn center" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show top 5" : `Explore all ${ranked.length} profiles`}
        </button>
      )}
    </section>
  );
}
