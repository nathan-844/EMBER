import manifest from "../data/table-manifest.json";
import { INVESTIGATIONS } from "../data/investigations";
import { SAFFIRE_NTRS_RUNS, SAFFIRE_NTRS_SOURCE } from "../data/ntrs-saffire";
import { REJECTED_EXAMPLE, tableOxygenSpan } from "../lib/landing";
import { PRESETS } from "../lib/scenario";

const REPO = "https://github.com/nathan-844/EMBER";
const TABLE_ROWS = manifest.tables.reduce((n, t) => n + t.rows, 0);
const SOLID = tableOxygenSpan("solid")!;
const LIQUID = tableOxygenSpan("liquid")!;
const GAS = tableOxygenSpan("gas")!;
const MOON_O2 = PRESETS.find((p) => p.id === "lunar-habitat")!.values.oxygenPct!;
const SAFFIRE_ABOVE = SAFFIRE_NTRS_RUNS.filter((r) => r.oxygenPct > SOLID.max);
const SCALE_MAX = 45;
const pct = (o2: number) => `${(o2 / SCALE_MAX) * 100}%`;

function Bar({ label, note, min, max, tone }: { label: string; note: string; min: number; max: number; tone: "solid" | "liquid" | "gas" }) {
  return (
    <div className="o2-row">
      <div className="o2-label"><strong>{label}</strong><span>{note}</span></div>
      <div className="o2-track">
        <span className={`o2-bar ${tone}`} style={{ left: pct(min), width: pct(max - min) }} />
        <span className="o2-moon" style={{ left: pct(MOON_O2) }} />
      </div>
    </div>
  );
}

export function Landing() {
  const gap = +(MOON_O2 - SOLID.max).toFixed(1);
  return (
    <main className="page landing">
      <header className="land-hero">
        <p className="eyebrow accent">NASA Space Apps 2026 · Flame in Freefall</p>
        <h1>A Moon base may breathe {MOON_O2}% oxygen. <span>Does NASA’s fire data cover it?</span></h1>
        <p className="land-lede">
          EMBER ranks NASA’s microgravity combustion experiments against your crew habitat, shows where the evidence runs out, and
          checks every AI-written claim against NASA’s own text.
        </p>
        <div className="land-actions">
          <a className="btn btn-primary land-cta" href="#lab">Launch EMBER →</a>
          <a className="btn land-btn" href="#credibility">How far can you trust it?</a>
          <a className="btn land-btn" href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
        </div>
        <dl className="land-stats">
          <div><dt>{INVESTIGATIONS.length}</dt><dd>NASA investigations ranked against your scenario</dd></div>
          <div><dt>{TABLE_ROWS.toLocaleString("en-US")}</dt><dd>test rows from {manifest.tables.length} NASA PSI run tables</dd></div>
          <div><dt>{SOLID.max}%</dt><dd>highest oxygen in any solid-material test in those tables</dd></div>
        </dl>
      </header>

      <section className="card land-section" aria-labelledby="land-finding">
        <p className="eyebrow">The finding</p>
        <h2 id="land-finding">NASA’s archived solid-material tests stop {gap} points short of a Moon-base atmosphere.</h2>
        <p className="land-text">
          No solid-material test in NASA’s Physical Science Informatics (PSI) run tables goes above {SOLID.max}% oxygen ({SOLID.top}).
          The tables that reach {MOON_O2}% burned fuel droplets or gas flames, which is analogue evidence for how cabin materials burn.
        </p>
        <div className="o2-chart" role="img" aria-label={`Oxygen tested in NASA PSI run tables. Solid materials ${SOLID.min} to ${SOLID.max} percent, liquid droplets ${LIQUID.min} to ${LIQUID.max} percent, gas flames ${GAS.min} to ${GAS.max} percent. Moon-base scenario at ${MOON_O2} percent.`}>
          <div className="o2-row o2-head" aria-hidden="true">
            <div className="o2-label" />
            <div className="o2-track bare"><span className="o2-moon-label" style={{ left: pct(MOON_O2) }}>Moon base · {MOON_O2}%</span></div>
          </div>
          <Bar label="Solid materials" note={`${SOLID.min}–${SOLID.max}% O₂`} min={SOLID.min} max={SOLID.max} tone="solid" />
          <Bar label="Fuel droplets" note={`${LIQUID.min}–${LIQUID.max}% O₂`} min={LIQUID.min} max={LIQUID.max} tone="liquid" />
          <Bar label="Gas flames" note={`${GAS.min}–${GAS.max}% O₂`} min={GAS.min} max={GAS.max} tone="gas" />
          <div className="o2-row">
            <div className="o2-label"><strong>Saffire V–VI</strong><span>published, not in PSI</span></div>
            <div className="o2-track">
              {SAFFIRE_ABOVE.map((r) => <span key={r.sample} className="o2-diamond" style={{ left: pct(r.oxygenPct) }} title={`${r.sample}: ${r.material}, ${r.oxygenPct}% O₂`} />)}
              <span className="o2-moon" style={{ left: pct(MOON_O2) }} />
            </div>
          </div>
          <div className="o2-row o2-axis" aria-hidden="true">
            <div className="o2-label" />
            <div className="o2-track bare">{[0, 10, 20, 30, 40].map((t) => <span key={t} style={{ left: pct(t) }}>{t}%</span>)}</div>
          </div>
        </div>
        <p className="land-note">
          Bars are min–max envelopes of each fuel type’s run tables, not a continuous test matrix. Outside PSI, NASA’s Saffire V and VI
          flights burned solid samples at {Math.min(...SAFFIRE_ABOVE.map((r) => r.oxygenPct))}–{Math.max(...SAFFIRE_ABOVE.map((r) => r.oxygenPct))}% oxygen
          (<a href={SAFFIRE_NTRS_SOURCE.url} target="_blank" rel="noreferrer">NASA NTRS {SAFFIRE_NTRS_SOURCE.ntrsId}</a>); EMBER shows them but does not score them.
        </p>
      </section>

      <section className="land-section" aria-labelledby="land-does">
        <p className="eyebrow">What you can do</p>
        <h2 id="land-does">Describe a habitat. See what NASA has tested, and what it has not.</h2>
        <div className="land-grid three">
          <article className="card">
            <h3>Rank the evidence</h3>
            <p>Set oxygen, pressure, gravity, airflow and fuel, or start from an ISS, Moon, rover, Mars or spacesuit preset. Every score opens to show why.</p>
          </article>
          <article className="card">
            <h3>See the gaps</h3>
            <p>A map of every NASA test row against your scenario, with plain statements of what the evidence cannot tell you.</p>
          </article>
          <article className="card">
            <h3>Ask a question</h3>
            <p>Get an AI answer in which each quote and number is traced to its source. Claims that fail are shown as rejected, with the reason.</p>
          </article>
        </div>
      </section>

      <section className="land-section land-grid two" aria-labelledby="land-ai">
        <div>
          <p className="eyebrow">Checked AI</p>
          <h2 id="land-ai">The AI is treated as an untrusted author.</h2>
          <ul className="land-list">
            <li>Every quote must appear word for word in the source it cites.</li>
            <li>Every number must trace to those sources or to your scenario.</li>
            <li>Findings must quote NASA’s text, not EMBER’s own summaries.</li>
            <li>Any claim that something is safe or will not burn is refused.</li>
          </ul>
          <p className="land-note">The check covers sources, numbers and wording. It does not prove that a claim follows from its quote.</p>
        </div>
        <figure className="card land-claim">
          <figcaption className="eyebrow">A real claim EMBER rejected</figcaption>
          <p className="land-claim-kind"><span className="land-pill bad">Rejected</span> {REJECTED_EXAMPLE.kind}</p>
          <blockquote>{REJECTED_EXAMPLE.text}</blockquote>
          <p className="land-claim-why"><strong>Why:</strong> {REJECTED_EXAMPLE.problem}</p>
        </figure>
      </section>

      <section className="card land-section" aria-labelledby="land-not">
        <p className="eyebrow">Honest limits</p>
        <h2 id="land-not">What EMBER does not claim</h2>
        <ul className="land-list cols">
          <li>It does not predict flammability, flame spread, extinction or fire risk.</li>
          <li>Match points select evidence. They are not confidence or probability.</li>
          <li>NASA’s PSI archive holds no partial-gravity combustion data yet.</li>
          <li>It is not a NASA product and not a safety certification.</li>
        </ul>
      </section>

      <section className="land-close">
        <h2>See what NASA’s data says about your habitat.</h2>
        <div className="land-actions">
          <a className="btn btn-primary land-cta" href="#lab">Launch EMBER →</a>
          <a className="btn land-btn" href="#credibility">Credibility self-assessment</a>
        </div>
        <p className="land-note">
          Data: NASA <a href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer">Physical Science Informatics</a> repository
          and <a href={SAFFIRE_NTRS_SOURCE.url} target="_blank" rel="noreferrer">NASA NTRS {SAFFIRE_NTRS_SOURCE.ntrsId}</a>.
          EMBER is a Space Apps research prototype and is not affiliated with or endorsed by NASA.
        </p>
      </section>
    </main>
  );
}
