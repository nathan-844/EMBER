import { useState } from "react";
import { INVESTIGATIONS } from "../data/investigations";
import type { ConditionEnvelope } from "../data/types";
import type { Scenario } from "../lib/scenario";

type Dim = "oxygenPct" | "pressurePsi" | "airflowMs";

const DIMS: Record<Dim, { label: string; unit: string; max: number; ticks: number[]; probes: number[] }> = {
  oxygenPct: { label: "Ambient O₂", unit: "%", max: 100, ticks: [0, 20, 40, 60, 80, 100], probes: [21, 30, 40, 85] },
  pressurePsi: { label: "Pressure", unit: "psia", max: 16, ticks: [0, 4, 8, 12, 16], probes: [4.3, 8.2, 10.2, 14.7] },
  airflowMs: { label: "Airflow", unit: "m/s", max: 0.6, ticks: [0, 0.2, 0.4, 0.6], probes: [0, 0.05, 0.2, 0.5] },
};

type Props = { scenario: Scenario; onProbe: (key: Dim, value: number) => void };

export function CoverageChart({ scenario, onProbe }: Props) {
  const [dim, setDim] = useState<Dim>("oxygenPct");
  const d = DIMS[dim];
  const rows = INVESTIGATIONS.filter((inv) => inv.conditions[dim as keyof ConditionEnvelope]);
  const value = scenario[dim];

  const W = 640, labelW = 110, plotW = W - labelW - 20, rowH = 34, top = 10;
  const H = top + rows.length * rowH + 30;
  const x = (v: number) => labelW + (Math.min(v, d.max) / d.max) * plotW;

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Parameter coverage</p>
          <h3>Where the measurements exist</h3>
        </div>
        <div className="segmented small-seg" role="group" aria-label="Dimension">
          {(Object.keys(DIMS) as Dim[]).map((k) => (
            <button key={k} aria-pressed={dim === k} onClick={() => setDim(k)}>{DIMS[k].label}</button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No profile has a normalized {d.label.toLowerCase()} range.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="coverage" role="img" aria-label={`${d.label} coverage by investigation`}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect x={labelW} y={top} width={plotW} height={rows.length * rowH} fill="url(#hatch)" />
          {d.ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top} y2={top + rows.length * rowH} stroke="var(--border)" />
              <text x={x(t)} y={H - 8} textAnchor="middle" className="tick">{t}</text>
            </g>
          ))}
          {rows.map((inv, i) => {
            const r = inv.conditions[dim as keyof ConditionEnvelope]!;
            const y = top + i * rowH + 8;
            const w = Math.max(x(r.max) - x(r.min), 3);
            return (
              <g key={inv.id}>
                <text x={0} y={y + 13} className="row-label">{inv.name}</text>
                <rect x={x(r.min)} y={y} width={w} height={18} rx={2} fill={i % 2 ? "var(--bar-2)" : "var(--bar)"}>
                  <title>{`${inv.name}: ${r.min}–${r.max} ${d.unit}. ${r.basis}`}</title>
                </rect>
                <text x={x(r.max) + 6} y={y + 13} className="row-note">{r.min}–{r.max} {d.unit}</text>
              </g>
            );
          })}
          {value != null && (
            <g>
              <line x1={x(value)} x2={x(value)} y1={top - 4} y2={top + rows.length * rowH} stroke="var(--bad)" strokeWidth="2" />
              <circle cx={x(value)} cy={top - 4} r={4} fill="var(--bad)" />
            </g>
          )}
        </svg>
      )}
      <div className="legend small muted">
        <span><i className="sw sw-bar" /> Curated envelope (approximate)</span>
        <span><i className="sw sw-you" /> Your scenario</span>
        <span><i className="sw sw-hatch" /> Unassessed coverage</span>
      </div>
      <div className="probe-row small">
        <span className="muted">Explore {d.label.toLowerCase()}:</span>
        {d.probes.map((p) => (
          <button key={p} className={`chip ${value === p ? "on" : ""}`} onClick={() => onProbe(dim, p)}>{p}{d.unit === "%" ? "%" : ""}</button>
        ))}
      </div>
      <p className="small warn-note">
        Envelopes are curated scalar ranges, not confirmed commanded test matrices. They do not establish continuous or joint-condition coverage.
      </p>
    </section>
  );
}
