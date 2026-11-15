import type { Insight } from "../lib/limitations";
import { FlameIcon } from "./icons";

export function InsightCard({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <section className="card insight" aria-labelledby="insight-title">
      <div className="section-head">
        <p className="eyebrow accent"><FlameIcon size={12} /> Fire-safety insight</p>
        <span className={`badge ${insight.fullCoverage ? "badge-ok" : "badge-warn"}`}>
          {insight.fullCoverage ? "All specified conditions recorded" : `${insight.gaps.length} condition${insight.gaps.length === 1 ? "" : "s"} not covered`}
        </span>
      </div>
      <h3 className="insight-title" id="insight-title">{insight.title}</h3>
      {insight.keyFinding && (
        <p className="key-finding"><strong>Key finding:</strong> {insight.keyFinding}</p>
      )}
      <p className="insight-body">{insight.body}</p>
      <div className="consider">
        <span className="eyebrow">Engineering consideration</span>
        <span>{insight.consideration}</span>
      </div>
      {insight.sources && (
        <p className="small muted insight-sources">
          Sources: {insight.sources.map((s, i) => <span key={s.href}>{i ? " · " : ""}<a href={s.href} target="_blank" rel="noreferrer">{s.label}</a></span>)}
        </p>
      )}
    </section>
  );
}
