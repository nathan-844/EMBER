// "Measured near your scenario": individual NASA tests near the scenario's oxygen and pressure,
// counted from the Fire Test Atlas. Loaded on demand (it pulls in the compact atlas).
import { useMemo } from "react";
import rawRows from "../data/atlas/atlas-rows.json";
import rawFindings from "../data/findings.json";
import type { CompactRow } from "../lib/atlas/compact";
import { NEAR_WINDOW, nearbyTests, type NearbyGroup } from "../lib/coverage";
import type { FindingsFile } from "../lib/findings/types";
import type { Scenario } from "../lib/scenario";

const ROWS = rawRows as unknown as CompactRow[];
const FINDINGS = (rawFindings as unknown as FindingsFile).findings;
const FUEL_WORDS = { solid: "Solid materials", liquid: "Fuel droplets", gas: "Gas flames", aerosol: "Aerosols" } as const;
export const OUTCOME_WORDS: Record<string, string> = {
  extinguished: "went out", "burned-out": "burned away", disrupted: "broke apart", burned: "burned", "no-spread": "no flame spread",
  "no-ignition": "did not ignite", flash: "flash only", terminated: "fuel flow stopped", "not-recorded": "outcome not recorded",
};

function useNearby(scenario: Scenario) {
  return useMemo(() => nearbyTests(ROWS, scenario), [scenario.oxygenPct, scenario.pressurePsi]); // eslint-disable-line react-hooks/exhaustive-deps
}

const where = (s: Scenario) => `${s.oxygenPct}% O₂${s.pressurePsi == null ? "" : ` and ${s.pressurePsi} psia`}`;

/** The tile's one-line summary. */
export function NearbyStat({ scenario }: { scenario: Scenario }) {
  const n = useNearby(scenario);
  if (!n) return <p className="tile-text">Set an oxygen level to count the NASA tests near it.</p>;
  const g = n.groups.find((x) => x.fuel === (scenario.fuel ?? "solid"))!;
  return (
    <>
      <p className="tile-stat">{g.joint.length}<small> {g.fuel} tests</small></p>
      <p className="tile-text">
        within {NEAR_WINDOW.oxygenPct} points of {scenario.oxygenPct}% O₂{n.usesPressure ? ` and ${NEAR_WINDOW.pressurePsi} psi of ${scenario.pressurePsi} psia` : ""}, counted row by row. {n.totalJoint} across all fuels.
      </p>
    </>
  );
}

function Group({ g, usesPressure, mine }: { g: NearbyGroup; usesPressure: boolean; mine: boolean }) {
  const byInv = new Map<string, number>();
  for (const r of g.joint) byInv.set(r.source.replace(/, (row|sample) .*$/, ""), (byInv.get(r.source.replace(/, (row|sample) .*$/, "")) ?? 0) + 1);
  const outcomes = Object.entries(g.outcomes).sort((a, b) => b[1]! - a[1]!);
  return (
    <article className={`card near-group${mine ? " mine" : ""}`}>
      <p className="eyebrow">{FUEL_WORDS[g.fuel]}{mine ? " · your fuel type" : ""}</p>
      <p className="near-num"><strong>{g.joint.length}</strong> test{g.joint.length === 1 ? "" : "s"} nearby</p>
      {g.joint.length > 0 && (
        <>
          <p className="small"><strong>From:</strong> {[...byInv.entries()].map(([k, v]) => `${k} (${v})`).join(", ")}</p>
          <p className="small"><strong>How they ended:</strong> {outcomes.map(([o, c]) => `${c} ${OUTCOME_WORDS[o] ?? o}`).join(", ")}</p>
        </>
      )}
      {usesPressure && g.oxygenOnly.length > 0 && (
        <p className="small muted">{g.oxygenOnly.length} more match on oxygen, but their NASA table records no pressure, so they cannot be placed on both.</p>
      )}
      {g.nearest ? (
        <p className="small">
          <strong>Closest test:</strong> <a href={g.nearest.row.url} target="_blank" rel="noreferrer">{g.nearest.row.source}</a>, {g.nearest.row.material}, {g.nearest.row.o2}% O₂
          {g.nearest.row.psi != null && ` at ${g.nearest.row.psi} psia`} ({OUTCOME_WORDS[g.nearest.row.outcome]}). Distance {g.nearest.distance}, where 1 is the edge of the window.
        </p>
      ) : (
        <p className="small muted">No {FUEL_WORDS[g.fuel].toLowerCase()} test records both oxygen and pressure.</p>
      )}
    </article>
  );
}

export function NearbyPanel({ scenario }: { scenario: Scenario }) {
  const n = useNearby(scenario);
  if (!n) return <p>Set an oxygen level in the scenario to count the NASA tests near it.</p>;
  const nearInv = new Set(n.groups.flatMap((g) => [...g.joint, ...g.oxygenOnly]).map((r) => r.investigation));
  const related = FINDINGS.filter((f) => f.investigations.some((i) => nearInv.has(i)));
  return (
    <div className="near">
      <p>
        Individual NASA tests within <strong>{NEAR_WINDOW.oxygenPct} points of oxygen</strong>
        {n.usesPressure && <> and <strong>{NEAR_WINDOW.pressurePsi} psi of pressure</strong></>} of your scenario ({where(scenario)}), counted row by row
        from the Fire Test Atlas. The ranking uses each study's min–max range per condition; this counts tests that hit{n.usesPressure ? " both conditions together" : " your oxygen level"}.
      </p>
      <div className="near-grid">
        {n.groups.map((g) => <Group key={g.fuel} g={g} usesPressure={n.usesPressure} mine={scenario.fuel === g.fuel} />)}
      </div>
      {related.length > 0 && (
        <>
          <h3 className="near-h">Measured findings from these tests</h3>
          <ul className="near-findings">
            {related.map((f) => <li key={f.id}><a href={`#findings/${f.id}`}><span className="finding-id">{f.id}</span> {f.title}</a></li>)}
          </ul>
        </>
      )}
      <p className="small muted">
        The window is a choice, not a physical threshold. Gravity and airflow are not part of it: every test here ran in microgravity. A nearby test is
        evidence to read, not a prediction for your scenario. <a href="#data">Browse every test →</a>
      </p>
    </div>
  );
}
