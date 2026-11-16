import { COUNTS } from "../lib/snapshot";
import { SAFFIRE_NTRS_RUNS, SAFFIRE_NTRS_SOURCE } from "../data/ntrs-saffire";
import { REJECTED_EXAMPLE, tableOxygenSpan } from "../lib/landing";
import { PRESETS } from "../lib/scenario";
import rawAudit from "../data/atlas/audit.json";
import rawFindings from "../data/findings.json";
import type { AuditFile } from "../lib/atlas/audit";
import type { FindingsFile } from "../lib/findings/types";
import { NASA_PHOTOS } from "../data/nasa-media";
import { NasaPhoto } from "../components/NasaPhoto";

const FLAMES = ["iss035e015900", "iss040e086481", "jsc2023e046631", "jsc2023e046375"].map((id) => NASA_PHOTOS.find((p) => p.nasaId === id)!);

const FINDINGS = rawFindings as unknown as FindingsFile;
const AUDIT = rawAudit as unknown as AuditFile;

const REPO = "https://github.com/nathan-844/EMBER";
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
          EMBER reads every row of NASA’s microgravity fire tests into one traceable table, computes what the measurements show, ranks the
          experiments against your crew habitat, and checks every AI-written claim against NASA’s own text.
        </p>
        <div className="land-actions">
          <a className="btn btn-primary land-cta" href="#lab">Launch EMBER →</a>
          <a className="btn land-btn" href="/ember-demo-30s.mp4" target="_blank" rel="noreferrer">Watch the 30-second demo</a>
          <a className="btn land-btn" href="#tour">Take the 1-minute tour</a>
          <a className="btn land-btn" href="#findings">See the findings</a>
          <a className="btn land-btn" href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
        </div>
        <dl className="land-stats">
          <div><dt>{COUNTS.rows.psi.toLocaleString("en-US")}</dt><dd>NASA source rows from {COUNTS.sources.psiTables} PSI tables ({COUNTS.observations.testRows.toLocaleString("en-US")} of them tests), every value traced to the cell it came from</dd></div>
          <div><dt>{FINDINGS.findings.length}</dt><dd>measured findings computed from those rows by code, with no AI in the loop</dd></div>
          <div><dt>{AUDIT.totals.issues}</dt><dd>data-quality issues found and documented in {AUDIT.totals.tablesAffected} of NASA’s {AUDIT.totals.tablesChecked} tables</dd></div>
        </dl>
      </header>

      <section className="land-section" aria-labelledby="land-path">
        <p className="eyebrow">Start here · one minute</p>
        <h2 id="land-path">From the ISS to the Moon, in four steps.</h2>
        <ol className="land-path">
          <li><a href="#lab" className="card"><span className="land-step">1</span><strong>Set a Moon habitat</strong><span className="muted">Pick the lunar preset and see which of 20 NASA investigations apply, and why.</span></a></li>
          <li><a href="#findings/F6" className="card"><span className="land-step">2</span><strong>See where the tests stop</strong><span className="muted">NASA’s archived solid-material tests end {gap} points of oxygen short of it.</span></a></li>
          <li><a href="#mission" className="card"><span className="land-step">3</span><strong>Move a material from A to B</strong><span className="muted">Which tests of a cabin panel still apply when the air changes from ISS to lunar?</span></a></li>
          <li><a href="#credibility" className="card"><span className="land-step">4</span><strong>Check our work</strong><span className="muted">Every test, source check and AI score, with the failures listed.</span></a></li>
        </ol>
      </section>

      <section className="land-section" aria-labelledby="land-demo">
        <p className="eyebrow">See it run</p>
        <h2 id="land-demo">EMBER in 30 seconds.</h2>
        <video className="land-video" controls preload="none" poster="/ember-demo-poster.jpg" aria-label="30-second demo of EMBER, with captions burned in and no sound">
          <source src="/ember-demo-30s.mp4" type="video/mp4" />
        </video>
        <p className="land-note">Recorded from the running app. Captions are part of the picture; there is no sound.</p>
      </section>

      <section className="land-section" aria-labelledby="land-brief">
        <p className="eyebrow">The challenge</p>
        <h2 id="land-brief">NASA asked for a dashboard that summarizes, ranks and interprets its fire data.</h2>
        <div className="land-grid three">
          <a href="#findings" className="card">
            <h3>Summarizes</h3>
            <p>{FINDINGS.findings.length} findings computed from NASA’s own rows, and all {COUNTS.rows.total.toLocaleString("en-US")} records in one searchable table with each value traced to its cell.</p>
          </a>
          <a href="#lab" className="card">
            <h3>Ranks</h3>
            <p>20 investigations scored against your habitat’s oxygen, pressure, gravity, airflow and fuel. Every score opens to show its reasons.</p>
          </a>
          <a href="#lab" className="card">
            <h3>Interprets</h3>
            <p>An AI answers your question from NASA’s text. A claim is shown only if its quotes and numbers are found in the source; the rest are shown as rejected.</p>
          </a>
        </div>
      </section>

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

      <section className="land-section" aria-labelledby="land-photos">
        <p className="eyebrow">NASA photos · public domain</p>
        <h2 id="land-photos">What these fires look like in orbit.</h2>
        <p className="land-text">
          Flames from two of the studies EMBER ranks (BASS and BASS-II) and from Saffire-IV, the first of the later Saffire flights NASA has
          published but PSI does not hold. Saffire V and VI burned the same kinds of samples at 26–31% oxygen. Captions follow NASA's own descriptions.
        </p>
        <div className="land-photos">
          {FLAMES.map((p) => <NasaPhoto key={p.nasaId} photo={p} compact />)}
        </div>
      </section>

      <section className="land-section" aria-labelledby="land-measured">
        <p className="eyebrow">Measured findings</p>
        <h2 id="land-measured">What NASA’s own measurements show, computed from the rows.</h2>
        <ol className="land-findings">
          {FINDINGS.findings.map((f) => (
            <li key={f.id}>
              <a href={`#findings/${f.id}`} className="card">
                <span className="finding-id">{f.id}</span>
                <strong>{f.title}</strong>
                <span className="muted">{f.n.toLocaleString("en-US")} {f.unit ? "runs" : "tests"}</span>
              </a>
            </li>
          ))}
        </ol>
        <p className="land-note">Each finding is computed by code from the rows it cites; no AI writes or edits it. <a href="#findings">Open the findings →</a></p>
      </section>

      <section className="card land-section" aria-labelledby="land-audit">
        <p className="eyebrow">Checked data</p>
        <h2 id="land-audit">We read every cell of NASA’s tables, and wrote down what is wrong with them.</h2>
        <p className="land-text">
          {AUDIT.totals.error} likely errors, {AUDIT.totals.gap} missing values and {AUDIT.totals.note} quirks: oxygen written as “3400%”, a thickness of “037 mm”,
          fuel labels that count up row by row, gas fractions that do not add up to 1. Nothing in NASA’s files is changed. Each issue is listed
          with the cells as written and how EMBER handles it.
        </p>
        <div className="land-actions">
          <a className="btn land-btn" href="#data/audit">Read the audit</a>
          <a className="btn land-btn" href="#data">Browse all {COUNTS.rows.total.toLocaleString("en-US")} records</a>
        </div>
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

      <section className="land-section" aria-labelledby="land-work">
        <p className="eyebrow">Work with the rows</p>
        <h2 id="land-work">Compare tests, plan a mission, and take the calculation with you.</h2>
        <div className="land-grid three">
          <a href="#compare" className="card">
            <h3>Compare two materials</h3>
            <p>How much carbon monoxide BASS-II's PMMA slabs added against SIBAL fabric, with every row used or left out, and the result recomputed under stricter rules.</p>
          </a>
          <a href="#research" className="card">
            <h3>Run a comparison of your own</h3>
            <p>Templates for Saffire-II ground against orbit, FLEX droplets at two oxygen levels, and fresh against aged smoke. Comparisons that do not make sense are blocked, with the reason.</p>
          </a>
          <a href="#mission" className="card">
            <h3>Check a mission's evidence</h3>
            <p>List your materials, set two atmospheres, and see which NASA tests apply to each. Then list the tests that would fill the gaps within a budget.</p>
          </a>
        </div>
        <p className="land-note">Each page downloads a ZIP that reruns its numbers with Node alone: no server, no network, no AI key.</p>
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
