import { useMemo } from "react";
import { INVESTIGATIONS } from "../data/investigations";
import { gapPoints, nearestSolid, type GapFuel, type GapPoint } from "../lib/explorer";
import type { Scenario } from "../lib/scenario";

const X = { min: 10, max: 50, ticks: [10, 20, 30, 40, 50] };
const Y = { min: 0, max: 80, ticks: [0, 20, 40, 60, 80] };
const FUEL_LABEL: Record<GapFuel, string> = { solid: "Solid material", liquid: "Liquid droplets", gas: "Gas flames", none: "No fuel" };

/** Square = solid, circle = liquid, triangle = gas: shape as well as colour, so the map reads without colour. */
function Marker({ fuel, x, y, assumed, r = 4 }: { fuel: GapFuel; x: number; y: number; assumed?: boolean; r?: number }) {
  const cls = `pt pt-${fuel}${assumed ? " assumed" : ""}`;
  if (fuel === "solid") return <rect className={cls} x={x - r} y={y - r} width={r * 2} height={r * 2} />;
  if (fuel === "gas") return <polygon className={cls} points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} />;
  return <circle className={cls} cx={x} cy={y} r={r} />;
}

function tip(p: GapPoint): string {
  const pr = p.pressurePsi == null ? "pressure not recorded" : `${p.pressurePsi} psia${p.pressureAssumed ? " (cabin pressure assumed; not in the table)" : ""}`;
  return `${p.name} · ${FUEL_LABEL[p.fuel]} · ${p.oxygenPct}% O₂, ${pr} · NASA ${p.table} row${p.rows.length > 1 ? "s" : ""} ${p.rows.slice(0, 8).join(", ")}${p.rows.length > 8 ? "…" : ""}`;
}

export function GapMap({ scenario }: { scenario: Scenario }) {
  const data = useMemo(() => gapPoints(INVESTIGATIONS), []);
  const W = 640, left = 52, right = 16, top = 14, plotH = 260, stripGap = 34, stripH = 22, bottom = 40;
  const plotW = W - left - right;
  const H = top + plotH + stripGap + stripH + bottom;
  const x = (v: number) => left + ((Math.min(Math.max(v, X.min), X.max) - X.min) / (X.max - X.min)) * plotW;
  const y = (v: number) => top + plotH - ((Math.min(Math.max(v, Y.min), Y.max) - Y.min) / (Y.max - Y.min)) * plotH;
  const stripY = top + plotH + stripGap + stripH / 2;

  const plotted = data.points.filter((p) => p.pressurePsi != null);
  const noPressure = data.points.filter((p) => p.pressurePsi == null);
  // Solid points last so they sit on top of the dense droplet and gas clouds.
  const order = (a: GapPoint, b: GapPoint) => (a.fuel === "solid" ? 1 : 0) - (b.fuel === "solid" ? 1 : 0);

  const o2 = scenario.oxygenPct;
  const p = scenario.pressurePsi;
  const solid = o2 != null ? nearestSolid(data.points, o2) : null;
  const solidMax = Math.max(...data.points.filter((q) => q.fuel === "solid").map((q) => q.oxygenPct));
  const headline =
    o2 == null
      ? "Set an oxygen level to place your scenario on the map."
      : solid && o2 > solidMax
        ? `Your ${o2}% O₂ is ${+(o2 - solidMax).toFixed(1)} points above the highest-oxygen solid-material run (${solid.name}, ${solid.oxygenPct}%).`
        : solid
          ? `The closest solid-material run to your ${o2}% O₂ is ${solid.name} at ${solid.oxygenPct}%.`
          : `No solid-material run has a recorded oxygen level.`;

  return (
    <section className="card" aria-labelledby="gapmap-title">
      <p className="eyebrow">Joint test conditions · NASA run-table rows</p>
      <h3 id="gapmap-title">Where tests were actually run</h3>
      <p className="gap-headline">{headline}</p>
      <p className="small muted">
        Each mark is a NASA test run: oxygen and pressure from the same row, so these are conditions that were tested together,
        not the per-condition ranges used for ranking. {plotted.length + noPressure.length} distinct points from{" "}
        {new Set(data.points.map((q) => q.table)).size} tables.
      </p>
      <div className="gapmap-scroll" tabIndex={0} aria-label="Gap map (scrolls sideways on small screens)">
        <svg viewBox={`0 0 ${W} ${H}`} className="gapmap" role="img" aria-label={`Oxygen against pressure for NASA test runs by fuel type. ${headline}`}>
          {X.ticks.map((t) => (
            <g key={`x${t}`}>
              <line className="grid" x1={x(t)} x2={x(t)} y1={top} y2={top + plotH} />
              <text className="tick" x={x(t)} y={H - bottom + 16} textAnchor="middle">{t}{t === X.max ? "+" : ""}</text>
            </g>
          ))}
          {Y.ticks.map((t) => (
            <g key={`y${t}`}>
              <line className="grid" x1={left} x2={W - right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={left - 8} y={y(t) + 4} textAnchor="end">{t}</text>
            </g>
          ))}
          <text className="axis-label" x={left + plotW / 2} y={H - 6} textAnchor="middle">Oxygen, vol % (values above 50 drawn at the edge)</text>
          <text className="axis-label" transform={`translate(14 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle">Pressure, psia</text>
          <line className="grid" x1={left} x2={W - right} y1={stripY - stripH / 2 - 6} y2={stripY - stripH / 2 - 6} />
          <text className="strip-label" x={left} y={stripY - stripH / 2 - 10}>Pressure not recorded in the table</text>

          {[...plotted].sort(order).map((q, i) => (
            <g key={`p${i}`}><Marker fuel={q.fuel} x={x(q.oxygenPct)} y={y(q.pressurePsi!)} assumed={q.pressureAssumed} /><title>{tip(q)}</title></g>
          ))}
          {noPressure.map((q, i) => (
            <g key={`n${i}`}><Marker fuel={q.fuel} x={x(q.oxygenPct)} y={stripY} /><title>{tip(q)}</title></g>
          ))}

          {o2 != null && (
            <g aria-hidden>
              <line x1={x(o2)} x2={x(o2)} y1={top} y2={top + plotH} stroke="var(--bad)" strokeDasharray="4 3" />
              {p != null && <line x1={left} x2={W - right} y1={y(p)} y2={y(p)} stroke="var(--bad)" strokeDasharray="4 3" />}
              {p != null && <circle cx={x(o2)} cy={y(p)} r={7} fill="none" stroke="var(--bad)" strokeWidth={2.5} />}
              <text className="you-label" x={Math.min(x(o2) + 9, W - right - 90)} y={(p != null ? y(p) : top + 12) - 9}>
                Your scenario{o2 > X.max ? ` (${o2}%)` : ""}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="gap-legend small muted">
        {(["solid", "liquid", "gas"] as const).map((f) => (
          <span key={f}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><Marker fuel={f} x={7} y={7} /></svg>{FUEL_LABEL[f]}</span>
        ))}
        <span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><Marker fuel="solid" x={7} y={7} assumed /></svg>Pressure not in the table; cabin pressure assumed</span>
      </div>
      <p className="small warn-note">
        Hover a mark for the investigation, NASA table and rows.
        {data.ambiguousRows ? ` ${data.ambiguousRows} rows list several oxygen and pressure levels without saying which were paired, so they are not drawn (FLEX-2).` : ""}
        {data.curatedOnly.length ? ` Not drawn: ${data.curatedOnly.join(", ")}, whose oxygen is a written approximation rather than a table value.` : ""}
        {" "}All runs are microgravity; gravity is not an axis here.
      </p>
    </section>
  );
}
