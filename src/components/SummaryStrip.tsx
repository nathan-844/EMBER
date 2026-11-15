import { gravityRegime, ppo2VsEarth, type Scenario } from "../lib/scenario";

type Props = { scenario: Scenario; relevant: number; total: number };

export const GRAVITY_TEXT = {
  microgravity: ["Direct evidence", "PSI data are microgravity results"],
  partial: ["Analogue evidence", "No partial-gravity data in PSI yet"],
  earth: ["Ground analogue", "PSI focuses on low-gravity results"],
  unspecified: ["Unspecified", "Set gravity to assess transfer"],
} as const;

export function SummaryStrip({ scenario, relevant, total }: Props) {
  const ppo2 = ppo2VsEarth(scenario);
  const [gTitle, gNote] = GRAVITY_TEXT[gravityRegime(scenario.gravityG)];
  return (
    <section className="card summary">
      <div>
        <p className="eyebrow">Oxygen partial pressure</p>
        <p className="big">{ppo2 == null ? "—" : ppo2.psi.toFixed(2)} <small>psia</small></p>
        <p className="small muted">{ppo2 ? `${ppo2.kpa.toFixed(1)} kPa · Earth sea level ${ppo2.earthKpa.toFixed(1)} kPa` : "Calculated · O₂ fraction × pressure"}</p>
      </div>
      <div>
        <p className="eyebrow">Question-relevant profiles</p>
        <p className="big">{relevant} <small>of {total}</small></p>
        <p className="small muted">Safety-question metadata</p>
      </div>
      <div>
        <p className="eyebrow">Gravity transfer</p>
        <p className="big-text">{gTitle}</p>
        <p className="small muted">{gNote}</p>
      </div>
    </section>
  );
}
