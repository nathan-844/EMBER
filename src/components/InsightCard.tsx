import type { Insight } from "../lib/limitations";
import { FlameIcon } from "./icons";

export function InsightCard({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <section className="card insight">
      <div className="section-head">
        <p className="eyebrow accent"><FlameIcon size={12} /> Fire-safety insight</p>
        <span className={`badge ${insight.fullCoverage ? "badge-ok" : "badge-warn"}`}>
          {insight.fullCoverage ? "All specified conditions recorded" : `${insight.gaps.length} condition${insight.gaps.length === 1 ? "" : "s"} not covered`}
        </span>
      </div>
      <h3 className="insight-title">{insight.title}</h3>
      <p>{insight.body}</p>
      <div className="consider">
        <span className="eyebrow">Engineering consideration</span>
        <span>{insight.consideration}</span>
      </div>
    </section>
  );
}
