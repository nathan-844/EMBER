import type { FuelType, SafetyQuestion } from "../data/types";
import { MATERIAL_OPTIONS, PRESETS, presetScenario, type EnvironmentId, type Scenario } from "../lib/scenario";
import { SlidersIcon } from "./icons";
import { missionLink } from "../lib/analysis/mission-link";

type NumericKey = "oxygenPct" | "pressurePsi" | "gravityG" | "airflowMs";

const SLIDERS: { key: NumericKey; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "oxygenPct", label: "Oxygen", unit: "vol %", min: 0, max: 100, step: 0.5 },
  { key: "pressurePsi", label: "Pressure", unit: "psia", min: 0.1, max: 30, step: 0.1 },
  { key: "gravityG", label: "Gravity", unit: "g / Earth", min: 0, max: 1, step: 0.001 },
  { key: "airflowMs", label: "Airflow", unit: "m/s", min: 0, max: 1, step: 0.01 },
];

export const QUESTIONS: { id: SafetyQuestion; label: string }[] = [
  { id: "prevention", label: "Prevention" },
  { id: "detection", label: "Detection" },
  { id: "suppression", label: "Suppression" },
];

type Props = {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
  onSaveBaseline: () => void;
  hasBaseline: boolean;
};

export function ScenarioPanel({ scenario, onChange, onSaveBaseline, hasBaseline }: Props) {
  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) =>
    onChange({ ...scenario, [key]: value, ...(key in SLIDER_KEYS ? { environment: "custom" } : {}) });
  const preset = PRESETS.find((p) => p.id === scenario.environment);

  return (
    <aside className="card panel" id="scenario" aria-label="Your scenario">
      <div className="panel-head">
        <h2><SlidersIcon /> Your scenario</h2>
        <button className="icon-btn" title="Reset to lunar habitat" aria-label="Reset to lunar habitat" onClick={() => onChange(presetScenario("lunar-habitat"))}>↺</button>
      </div>

      <label className="field-label" htmlFor="env">Environment</label>
      <select id="env" value={scenario.environment} onChange={(e) => onChange(presetScenario(e.target.value as EnvironmentId, scenario))}>
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <p className="hint">
        {preset?.note}{" "}
        {preset?.source
          ? <>Values from the <a href={`https://ntrs.nasa.gov/citations/${preset.source.ntrsId}`} target="_blank" rel="noreferrer">{preset.source.label} (NTRS {preset.source.ntrsId})</a>; airflow is EMBER's assumption.</>
          : "Illustrative presets; edit to match your design."}
      </p>

      <span className="field-label" id="q-label">Safety question</span>
      <div className="segmented" role="group" aria-label="Safety question">
        {QUESTIONS.map((q) => (
          <button key={q.id} aria-pressed={scenario.question === q.id} onClick={() => set("question", q.id)}>{q.label}</button>
        ))}
      </div>

      <p className="panel-group">Cabin conditions <span>leave any blank if unknown</span></p>
      {SLIDERS.map((s) => {
        const value = scenario[s.key];
        return (
          <div className="slider-field" key={s.key}>
            <div className="slider-head">
              <label htmlFor={s.key} className="field-label">{s.label}</label>
              <span className="unit">{s.unit}</span>
            </div>
            <div className="slider-row">
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={value ?? s.min} disabled={value == null}
                aria-label={`${s.label} slider`}
                onChange={(e) => set(s.key, Number(e.target.value))}
              />
              <input
                id={s.key} type="number" className="num" min={s.min} max={s.max} step={s.step}
                value={value ?? ""} placeholder="—"
                onChange={(e) => {
                  if (e.target.value === "") return set(s.key, null);
                  const v = Number(e.target.value);
                  // Never negative or above the maximum; the lower bound is enforced on blur so "0.5" can be typed.
                  if (Number.isFinite(v)) set(s.key, Math.min(Math.max(v, 0), s.max));
                }}
                onBlur={() => { if (value != null && value < s.min) set(s.key, s.min); }}
              />
            </div>
            <div className="slider-scale">
              <span>{s.min}</span>
              <button className="link-btn" onClick={() => set(s.key, value == null ? (s.min + s.max) / 2 : null)}>
                {value == null ? "Specify" : "Unspecified"}
              </button>
              <span>{s.max}</span>
            </div>
          </div>
        );
      })}

      <label className="field-label" htmlFor="fuel">Fuel</label>
      <select id="fuel" value={scenario.fuel ?? ""} onChange={(e) => set("fuel", (e.target.value || null) as FuelType | null)}>
        <option value="">Unspecified</option>
        <option value="solid">Solid material</option>
        <option value="liquid">Liquid</option>
        <option value="gas">Gas</option>
      </select>

      <label className="check">
        <input type="checkbox" checked={scenario.includeAdjacent} onChange={(e) => set("includeAdjacent", e.target.checked)} />
        Include analogues &amp; adjacent research
      </label>

      <details className="fold fold-inline panel-more">
        <summary><span>Material &amp; flow (optional)</span><span className="disclose" aria-hidden /></summary>
      <div className="grid-2">
        <div>
          <label className="field-label" htmlFor="flowdir">Flow direction</label>
          <select id="flowdir" value={scenario.flowDirection ?? ""} onChange={(e) => set("flowDirection", (e.target.value || null) as Scenario["flowDirection"])}>
            <option value="">Unspecified</option>
            <option value="opposed">Opposed</option>
            <option value="concurrent">Concurrent</option>
            <option value="quiescent">Still air</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="material">Material</label>
          <select id="material" value={scenario.material ?? ""} onChange={(e) => set("material", e.target.value || null)}>
            <option value="">Unspecified</option>
            {MATERIAL_OPTIONS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="span-2">
          <label className="field-label" htmlFor="thick">Thickness · mm</label>
          <input id="thick" type="number" min={0} step={0.1} placeholder="Unknown" value={scenario.thicknessMm ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              set("thicknessMm", e.target.value === "" || !Number.isFinite(v) ? null : Math.min(Math.max(v, 0), 1000));
            }} />
        </div>
      </div>
      <p className="hint">These fields preserve the original investigation ranking. <a href={missionLink(scenario)}>Compare material evidence in Mission</a> to apply row-level thickness and flow gates. A complete atmosphere transfers to B; incomplete atmospheres open defaults. Confirm the material name and form there.</p>
      </details>

      <button className="btn wide" onClick={onSaveBaseline}>＋ {hasBaseline ? "Replace comparison baseline" : "Save as comparison baseline"}</button>
    </aside>
  );
}

const SLIDER_KEYS = { oxygenPct: 1, pressurePsi: 1, gravityG: 1, airflowMs: 1 };

/**
 * Phone-only bar at the top of the results: the two choices that change the answer most
 * (environment and safety question), with a link down to every condition.
 */
export function QuickScenario({ scenario, onChange }: { scenario: Scenario; onChange: (next: Scenario) => void }) {
  return (
    <div className="quick-scenario" aria-label="Quick scenario">
      <label className="field-label" htmlFor="env-quick">Environment</label>
      <select id="env-quick" value={scenario.environment} onChange={(e) => onChange(presetScenario(e.target.value as EnvironmentId, scenario))}>
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <div className="segmented" role="group" aria-label="Safety question">
        {QUESTIONS.map((q) => (
          <button key={q.id} aria-pressed={scenario.question === q.id} onClick={() => onChange({ ...scenario, question: q.id })}>{q.label}</button>
        ))}
      </div>
      <a className="quick-all" href="#scenario">All conditions (oxygen, pressure, gravity, airflow, fuel) ↓</a>
    </div>
  );
}
