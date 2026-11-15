// One chart per finding, drawn from the finding's own table (src/data/findings.json), so the chart,
// the table view and the claim all show the same computed numbers.
import type { ReactElement } from "react";
import type { Finding } from "../../lib/findings/types";
import { useTip } from "./Tip";

type Cell = string | number | null;
const col = (f: Finding, name: string) => {
  const i = f.table.columns.indexOf(name);
  if (i < 0) throw new Error(`${f.id} table has no column ${name}`);
  return (row: Cell[]) => row[i];
};
const num = (v: Cell) => (typeof v === "number" ? v : Number(v));
const pctOf = (v: number, lo: number, hi: number) => `${((v - lo) / (hi - lo)) * 100}%`;

/** Plain table of a finding's numbers: the table view every chart offers. */
export function FindingTable({ f }: { f: Finding }) {
  return (
    <div className="table-scroll compact" tabIndex={0} aria-label={`${f.id} data table`}>
      <table className="probe-table finding-table">
        <thead><tr>{f.table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {f.table.rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? "—"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ items }: { items: { cls: string; label: string; shape?: "dot" | "rect" }[] }) {
  return (
    <ul className="viz-legend" aria-label="Legend">
      {items.map((i) => <li key={i.label}><span className={`viz-key ${i.shape ?? "rect"} ${i.cls}`} aria-hidden />{i.label}</li>)}
    </ul>
  );
}

function Axis({ ticks, lo, hi, fmt, title }: { ticks: number[]; lo: number; hi: number; fmt: (t: number) => string; title: string }) {
  return (
    <div className="viz-row viz-axis" aria-hidden>
      <div className="viz-label" />
      <div className="viz-track bare">
        {ticks.map((t) => <span key={t} style={{ left: pctOf(t, lo, hi) }}>{fmt(t)}</span>)}
        <em>{title}</em>
      </div>
    </div>
  );
}

/** F1: dumbbell – extinction-diameter ratio at the lowest and highest oxygen tested, per group. */
function F1Chart({ f }: { f: Finding }) {
  const { ref, bind, node } = useTip();
  const [fuel, gas, band, runs, levels, rho, lo, hi] = ["Fuel", "Added gas", "Pressure", "Runs", "O₂ levels (%)", "Rank correlation", "Ratio at lowest O₂", "Ratio at highest O₂"].map((c) => col(f, c));
  return (
    <div className="viz" ref={ref}>
      <Legend items={[{ cls: "s2", label: "At the lowest O₂ tested", shape: "dot" }, { cls: "s1", label: "At the highest O₂ tested", shape: "dot" }]} />
      <div className="viz-grid">
        {f.table.rows.map((r, i) => {
          const [o2lo, o2hi] = String(levels(r)).split("–");
          const a = num(lo(r)), b = num(hi(r));
          return (
            <div className="viz-row" key={i}>
              <div className="viz-label"><strong>{fuel(r)} · {gas(r)}</strong><span>{band(r)} · {runs(r)} runs · ρ {rho(r)}</span></div>
              <div className="viz-track">
                <span className="viz-link" style={{ left: pctOf(Math.min(a, b), 0, 1), width: `${Math.abs(a - b) * 100}%` }} />
                <span className="viz-dot s2" style={{ left: pctOf(a, 0, 1) }} {...bind(`${a} of the starting diameter`, `${fuel(r)}, ${gas(r)}, ${band(r)}, at ${o2lo}% O₂`)} />
                <span className="viz-dot s1" style={{ left: pctOf(b, 0, 1) }} {...bind(`${b} of the starting diameter`, `${fuel(r)}, ${gas(r)}, ${band(r)}, at ${o2hi}% O₂`)} />
              </div>
            </div>
          );
        })}
        <Axis ticks={[0, 0.25, 0.5, 0.75, 1]} lo={0} hi={1} fmt={(t) => String(t)} title="Droplet diameter left when the flame went out (share of the start)" />
      </div>
      {node}
    </div>
  );
}

/** F2: tall segmented bars – how FLEX burns ended, in air vs near exploration air. */
function F2Chart({ f }: { f: Finding }) {
  const { ref, bind, node } = useTip();
  const [o2, runs, out, apart, away] = ["O₂ (%)", "Runs", "Went out", "Broke apart", "Burned away"].map((c) => col(f, c));
  const groups = [
    { label: "Air · 21% O₂ · 1 atm", rows: f.table.rows.filter((r) => num(o2(r)) === 21) },
    { label: `${f.numbers.o2Levels}% O₂ · ${f.numbers.psiMin}–${f.numbers.psiMax} psia`, rows: f.table.rows.filter((r) => num(o2(r)) >= 30) },
  ].map((g) => {
    const sum = (get: (r: Cell[]) => Cell) => g.rows.reduce((n, r) => n + num(get(r)), 0);
    return { label: g.label, total: sum(runs), parts: [{ cls: "s2", name: "Went out", n: sum(out) }, { cls: "s1", name: "Broke apart", n: sum(apart) }, { cls: "s3", name: "Burned away", n: sum(away) }] };
  });
  return (
    <div className="viz" ref={ref}>
      <Legend items={[{ cls: "s2", label: "Went out" }, { cls: "s1", label: "Broke apart" }, { cls: "s3", label: "Burned away" }]} />
      <div className="viz-grid">
        {groups.map((g) => (
          <div className="viz-row tall" key={g.label}>
            <div className="viz-label"><strong>{g.label}</strong><span>{g.total} droplet burns</span></div>
            <div className="seg-bar" role="group" aria-label={`${g.label}: ${g.parts.map((p) => `${p.name} ${p.n}`).join(", ")}`}>
              {g.parts.filter((p) => p.n > 0).map((p) => (
                <span key={p.name} className={`seg ${p.cls}`} style={{ flexGrow: p.n }} {...bind(`${p.n} of ${g.total} (${Math.round((p.n / g.total) * 100)}%)`, `${g.label}: ${p.name.toLowerCase()}`)}>
                  {p.n / g.total >= 0.12 ? p.n : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}

const EXTENT = ["no spread", "partial burn", "whole sample"];
function Extent({ v }: { v: string }) {
  const n = EXTENT.indexOf(v);
  return (
    <span className="extent" title={v}>
      <span className="extent-steps" aria-hidden>{[0, 1, 2].map((k) => <i key={k} className={k <= n && n > 0 ? "on" : ""} />)}</span>
      {v}
    </span>
  );
}

/** F3: the pairs themselves are the clearest form – eight samples, orbit beside ground. */
function F3Chart({ f }: { f: Finding }) {
  const [sample, mat, thick, orbit, ground, verdict] = ["Sample", "Material", "Thickness (mm)", "In orbit", "On the ground (1 g)", "Ground vs orbit"].map((c) => col(f, c));
  return (
    <div className="table-scroll compact" tabIndex={0} aria-label="Saffire-II samples: orbit and ground burn">
      <table className="probe-table pairs">
        <thead><tr><th scope="col">Sample</th><th scope="col">Material</th><th scope="col">In orbit</th><th scope="col">On the ground (1 g)</th><th scope="col">Result</th></tr></thead>
        <tbody>
          {f.table.rows.map((r) => (
            <tr key={String(sample(r))}>
              <td className="mono">{sample(r)}</td>
              <td>{mat(r)}{thick(r) != null && <span className="muted"> · {thick(r)} mm</span>}</td>
              <td><Extent v={String(orbit(r))} /></td>
              <td><Extent v={String(ground(r))} /></td>
              <td className={verdict(r) === "ground further" ? "strong-text" : "muted"}>{verdict(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** F4: single-series bars – median CO rise per burn, by material. */
function F4Chart({ f }: { f: Finding }) {
  const { ref, bind, node } = useTip();
  const [mat, burns, inferred, co, co2, off] = ["Material", "Burns", "Material inferred", "Median CO change (ppm)", "Median CO₂ change (% points)", "CO off scale"].map((c) => col(f, c));
  const rows = f.table.rows.filter((r) => co(r) != null);
  const vals = rows.map((r) => num(co(r)));
  const lo = Math.min(0, ...vals), hi = Math.ceil(Math.max(...vals) / 100) * 100;
  const ticks = Array.from({ length: hi / 100 + 1 }, (_, i) => i * 100);
  return (
    <div className="viz" ref={ref}>
      <div className="viz-grid">
        {rows.map((r) => {
          const v = num(co(r));
          const extra = [num(inferred(r)) ? `material inferred for ${inferred(r)} of ${burns(r)}` : "", num(off(r)) ? `${off(r)} off scale` : ""].filter(Boolean).join(" · ");
          return (
            <div className="viz-row" key={String(mat(r))}>
              <div className="viz-label"><strong>{mat(r)}</strong><span>{burns(r)} burns{extra ? ` · ${extra}` : ""}</span></div>
              <div className="viz-track">
                <span className="viz-zero" style={{ left: pctOf(0, lo, hi) }} />
                <span
                  className={`viz-bar ${v < 0 ? "neg" : ""}`}
                  style={{ left: pctOf(Math.min(0, v), lo, hi), width: `${(Math.abs(v) / (hi - lo)) * 100}%` }}
                  {...bind(`${v} ppm CO · ${co2(r)} points CO₂`, `${mat(r)}, median change per burn`)}
                />
                <span className="viz-value" style={{ left: `calc(${pctOf(Math.max(0, v), lo, hi)} + 6px)` }}>{v} ppm</span>
              </div>
            </div>
          );
        })}
        <Axis ticks={ticks} lo={lo} hi={hi} fmt={(t) => String(t)} title="Median CO change per burn (ppm)" />
      </div>
      {node}
    </div>
  );
}

/** F5: fuel × pressure matrix of cool flames over runs. */
function F5Chart({ f }: { f: Finding }) {
  const [fuel, p, runs, cool] = ["Fuel", "Pressure (bar)", "Runs", "Cool flames"].map((c) => col(f, c));
  const fuels = [...new Set(f.table.rows.map((r) => String(fuel(r))))];
  const pressures = [...new Set(f.table.rows.map((r) => num(p(r))))].sort((a, b) => a - b);
  const at = (fu: string, pr: number) => f.table.rows.find((r) => fuel(r) === fu && num(p(r)) === pr);
  return (
    <div className="table-scroll compact" tabIndex={0} aria-label="CFI-G cool flames by fuel and pressure">
      <table className="matrix">
        <caption>Cool flames / runs, by fuel and pressure</caption>
        <thead><tr><th scope="col">Fuel</th>{pressures.map((pr) => <th key={pr} scope="col">{pr} bar</th>)}</tr></thead>
        <tbody>
          {fuels.map((fu) => (
            <tr key={fu}>
              <th scope="row">{fu}</th>
              {pressures.map((pr) => {
                const r = at(fu, pr);
                return <td key={pr} className={r && num(cool(r)) > 0 ? "hit" : r ? "" : "empty"}>{r ? <><strong>{cool(r)}</strong> / {runs(r)}</> : "not run"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** F6: oxygen dot strip – every solid test above 21.9% O₂, with the exploration atmosphere shaded. */
function F6Chart({ f }: { f: Finding }) {
  const { ref, bind, node } = useTip();
  const [src, mat, o2, psi, outcome, tests] = ["Source", "Material", "O₂ (%)", "Pressure (psia)", "Outcome", "Tests"].map((c) => col(f, c));
  const lo = 21, hi = 33;
  return (
    <div className="viz" ref={ref}>
      <Legend items={[{ cls: "s1", label: "NASA PSI tables", shape: "dot" }, { cls: "s2", label: "NASA paper (NTRS 20240002981)", shape: "dot" }]} />
      <div className="viz-grid">
        <div className="viz-row viz-axis zone-head" aria-hidden>
          <div className="viz-label" />
          <div className="viz-track bare"><span className="zone-label" style={{ left: pctOf(30, lo, hi) }}>Exploration air: ≥30% O₂ at ≤10.2 psi</span></div>
        </div>
        {f.table.rows.map((r, i) => {
          const fromPaper = String(src(r)).includes("NTRS");
          const x = num(o2(r));
          const p = psi(r);
          return (
            <div className="viz-row" key={i}>
              <div className="viz-label"><strong>{mat(r)}</strong><span>{src(r)} · {p == null ? "no pressure" : `${p} psia`} · {outcome(r)}{num(tests(r)) > 1 ? ` · ${tests(r)} tests` : ""}</span></div>
              <div className="viz-track">
                <span className="viz-zone" style={{ left: pctOf(30, lo, hi), width: `${((hi - 30) / (hi - lo)) * 100}%` }} />
                <span className={`viz-dot ${fromPaper ? "s2" : "s1"}`} style={{ left: pctOf(x, lo, hi) }} {...bind(`${x}% O₂${p == null ? "" : ` at ${p} psia`}`, `${mat(r)} (${fromPaper ? "NTRS paper" : src(r)}), ${outcome(r)}`)} />
              </div>
            </div>
          );
        })}
        <Axis ticks={[21, 24, 27, 30, 33]} lo={lo} hi={hi} fmt={(t) => `${t}%`} title="Oxygen in the test (%)" />
      </div>
      {node}
    </div>
  );
}

const CHARTS: Record<string, (p: { f: Finding }) => ReactElement> ={ F1: F1Chart, F2: F2Chart, F3: F3Chart, F4: F4Chart, F5: F5Chart, F6: F6Chart };

export function FindingChart({ f }: { f: Finding }) {
  const Chart = CHARTS[f.id];
  return Chart ? <Chart f={f} /> : <FindingTable f={f} />;
}

/** Charts whose form is already a table need no separate table view. */
export const IS_TABLE_FORM = new Set(["F3", "F5", "F7", "F8"]);
