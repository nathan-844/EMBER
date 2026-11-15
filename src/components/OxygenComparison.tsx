import { NTRS_QUOTES } from "../data/ntrs-evidence";
import { EARTH_SEA_LEVEL, ppo2Sentence, ppo2VsEarth, type Scenario } from "../lib/scenario";
import { NtrsQuoteBlock } from "./PartialGravityPanel";

const RUFF = NTRS_QUOTES.find((q) => q.id === "ruff21-o2-vs-pressure")!;

function Pair({ label, unit, mine, earth, digits }: { label: string; unit: string; mine: number; earth: number; digits: number }) {
  const max = Math.max(mine, earth) * 1.1;
  return (
    <div className="ox-pair">
      <p className="eyebrow">{label}</p>
      {[["Your scenario", mine, "ox-bar mine"], ["Earth sea level", earth, "ox-bar"]].map(([name, v, cls]) => (
        <div className="ox-row" key={name as string}>
          <span className="ox-name">{name}</span>
          <span className="ox-track" aria-hidden><span className={cls as string} style={{ width: `${((v as number) / max) * 100}%` }} /></span>
          <span className="ox-val">{(v as number).toFixed(digits)} {unit}</span>
        </div>
      ))}
    </div>
  );
}

/** Oxygen fraction and oxygen partial pressure, each against Earth sea-level air. */
export function OxygenComparison({ scenario }: { scenario: Scenario }) {
  const c = ppo2VsEarth(scenario);
  if (!c) return <p className="small muted">Set oxygen and pressure to compare your atmosphere with Earth's.</p>;
  return (
    <section className="card ox-compare" aria-labelledby="o2-title">
      <p className="eyebrow">Oxygen against Earth air</p>
      <h3 id="o2-title">{c.kpa.toFixed(1)} kPa of oxygen: {ppo2Sentence(c)}</h3>
      <div className="ox-grid">
        <Pair label="Oxygen fraction" unit="%" mine={scenario.oxygenPct!} earth={EARTH_SEA_LEVEL.oxygenPct} digits={1} />
        <Pair label="Oxygen partial pressure" unit="kPa" mine={c.kpa} earth={c.earthKpa} digits={1} />
      </div>
      <p className="small muted">
        Partial pressure is the fraction times the total pressure ({c.psi.toFixed(2)} psia here); it is what a crew breathes. Low-pressure
        habitats add oxygen to keep it near Earth's, so the fraction rises even when the partial pressure does not. NASA's tests point to the
        fraction as the stronger driver of material flammability:
      </p>
      <NtrsQuoteBlock q={RUFF} />
      <p className="small muted">EMBER's ranking compares your oxygen fraction with each study's tested range for that reason.</p>
    </section>
  );
}
