import type { FuelType, SafetyQuestion } from "../data/types";
import { PRESETS, presetScenario, type EnvironmentId, type Scenario } from "../lib/scenario";
import { SlidersIcon } from "./icons";

type NumericKey = "oxygenPct" | "pressurePsi" | "gravityG" | "airflowMs";

const SLIDERS: { key: NumericKey; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "oxygenPct", label: "Oxygen", unit: "vol %", min: 0, max: 100, step: 0.5 },
  { key: "pressurePsi", label: "Pressure", unit: "psia", min: 0.1, max: 30, step: 0.1 },
  { key: "gravityG", label: "Gravity", unit: "g / Earth", min: 0, max: 1, step: 0.001 },
  { key: "airflowMs", label: "Airflow", unit: "m/s", min: 0, max: 1, step: 0.01 },
];

const QUESTIONS: { id: SafetyQuestion; label: string }[] = [
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
    <aside className="card panel" aria-label="Your scenario">
      <div className="panel-head">
        <h2><SlidersIcon /> Your scenario</h2>
        <button className="icon-btn" title="Reset to lunar habitat" onClick={() => onChange(presetScenario("lunar-habitat"))}>↺</button>
      </div>

      <label className="field-label" htmlFor="env">Environment</label>
      <select id="env" value={scenario.environment} onChange={(e) => onChange(presetScenario(e.target.value as EnvironmentId, scenario))}>
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <p className="hint">{preset?.note} Illustrative presets; edit to match your design.</p>

      <span className="field-label">Safety question</span>
      <div className="segmented" role="group" aria-label="Safety question">
        {QUESTIONS.map((q) => (
          <button key={q.id} aria-pressed={scenario.question === q.id} onClick={() => set("question", q.id)}>{q.label}</button>
        ))}
      </div>

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
                onChange={(e) => set(s.key, e.target.value === "" ? null : Number(e.target.value))}
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

      <div className="grid-2">
        <div>
          <label className="field-label" htmlFor="fuel">Fuel</label>
          <select id="fuel" value={scenario.fuel ?? ""} onChange={(e) => set("fuel", (e.target.value || null) as FuelType | null)}>
            <option value="">Unspecified</option>
            <option value="solid">Solid material</option>
            <option value="liquid">Liquid</option>
            <option value="gas">Gas</option>
          </select>
        </div>
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
            <option>Cotton-fiberglass fabric</option>
            <option>Nomex</option>
            <option>PMMA</option>
            <option>Ultem</option>
            <option>Silicone</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="thick">Thickness · mm</label>
          <input id="thick" type="number" min={0} step={0.1} placeholder="Unknown" value={scenario.thicknessMm ?? ""}
            onChange={(e) => set("thicknessMm", e.target.value === "" ? null : Number(e.target.value))} />
        </div>
      </div>
      <p className="hint">Material, thickness and flow direction are recorded for the brief but do not change ranking: no profile has normalized data for them yet.</p>

      <label className="check">
        <input type="checkbox" checked={scenario.includeAdjacent} onChange={(e) => set("includeAdjacent", e.target.checked)} />
        Include analogues &amp; adjacent research
      </label>

      <button className="btn wide" onClick={onSaveBaseline}>＋ {hasBaseline ? "Replace comparison baseline" : "Save as comparison baseline"}</button>
    </aside>
  );
}

const SLIDER_KEYS = { oxygenPct: 1, pressurePsi: 1, gravityG: 1, airflowMs: 1 };
