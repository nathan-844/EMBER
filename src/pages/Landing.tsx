import { COUNTS } from "../lib/snapshot";
import { SAFFIRE_NTRS_SOURCE } from "../data/ntrs-saffire";
import { INVESTIGATIONS } from "../data/investigations";
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

const INVESTIGATION_COUNT = INVESTIGATIONS.length;
const SOLID = tableOxygenSpan("solid")!;
const MOON_O2 = PRESETS.find((p) => p.id === "lunar-habitat")!.values.oxygenPct!;


export function Landing() {
  const gap = +(MOON_O2 - SOLID.max).toFixed(1);
  return (
    <main className="landing">
      <div className="land-top">
        <section className="panel-soft land-hero">
          <span className="tag">NASA Space Apps 2026 · Flame in Freefall</span>
          <h1>A Moon base may breathe {MOON_O2}% oxygen. <span>Does NASA’s fire data cover it?</span></h1>
          <p className="land-lede">
            EMBER reads every row of NASA’s microgravity fire tests into one traceable table, computes what the measurements show, ranks the
            experiments against your crew habitat, and checks every AI-written claim against NASA’s own text.
          </p>
          <div className="land-actions">
            <a className="pill pill-accent pill-lg" href="#lab">Set a Moon habitat</a>
            <a className="pill pill-white pill-lg" href="#findings">See the {FINDINGS.findings.length} findings</a>
            <a className="pill pill-white pill-lg" href="#tour">Take the 1-minute tour</a>
          </div>
        </section>

        <div className="land-side">
          <div className="land-video-card">
            <div className="land-video-head"><span>30-second demo · captions, no sound</span><span className="tag tag-white">0:30</span></div>
            <video className="land-video" controls preload="none" poster="/ember-demo-poster.jpg" aria-label="30-second demo of EMBER, with captions burned in and no sound">
              <source src="/ember-demo-30s.mp4" type="video/mp4" />
            </video>
          </div>
          <dl className="land-stats">
            <div className="panel-soft"><dt>{COUNTS.rows.psi.toLocaleString("en-US")}</dt><dd>NASA rows from {COUNTS.sources.psiTables} tables</dd></div>
            <div className="panel-soft"><dt>{FINDINGS.findings.length}</dt><dd>findings computed by code</dd></div>
            <div className="panel-soft"><dt>{AUDIT.totals.issues}</dt><dd>data issues documented</dd></div>
          </dl>
        </div>
      </div>

      <section className="panel-soft land-steps" aria-labelledby="steps-h">
        <div className="section-head">
          <h2 id="steps-h">Try EMBER in four steps</h2>
          <span className="muted">About one minute</span>
        </div>
        <ol className="step-grid">
          <li><a href="#lab"><span className="step-dot on">1</span><em className="step-page">Explore</em><strong>Set your habitat</strong><span>Set oxygen, pressure, gravity and airflow, and see which of {INVESTIGATION_COUNT} NASA investigations apply. For a Moon base, PSI’s solid-material tests stop {gap} points of oxygen short.</span></a></li>
          <li><a href="#findings"><span className="step-dot">2</span><em className="step-page">Findings</em><strong>Read what the tests show</strong><span>{FINDINGS.findings.length} results computed by code from NASA’s own test rows, each with its rows, method and limits.</span></a></li>
          <li><a href="#mission"><span className="step-dot">3</span><em className="step-page">Analyze</em><strong>Check a material</strong><span>Pick a cabin material and see whether its NASA fire tests, mostly run in ISS air, apply in your habitat’s air.</span></a></li>
          <li><a href="#data"><span className="step-dot">4</span><em className="step-page">Data · Credibility</em><strong>Check the evidence</strong><span>Browse all {COUNTS.rows.total.toLocaleString("en-US")} NASA records and the {AUDIT.totals.issues} data issues, and see every check EMBER runs.</span></a></li>
        </ol>
      </section>

      <section className="panel-soft land-photos-card" aria-labelledby="land-photos">
        <div className="section-head">
          <h2 id="land-photos">What these fires look like in orbit</h2>
          <span className="muted">NASA photos · public domain</span>
        </div>
        <div className="land-photos">
          {FLAMES.map((p) => <NasaPhoto key={p.nasaId} photo={p} compact />)}
        </div>
      </section>

      <div className="two-up">
        <figure className="panel-soft land-claim">
          <figcaption className="muted">The AI is treated as an untrusted author. A real claim EMBER rejected:</figcaption>
          <p className="land-claim-kind"><span className="land-pill bad">Rejected</span> {REJECTED_EXAMPLE.kind}</p>
          <blockquote>{REJECTED_EXAMPLE.text}</blockquote>
          <p className="land-claim-why"><strong>Why:</strong> {REJECTED_EXAMPLE.problem}</p>
        </figure>
        <section className="panel-dark land-audit" aria-labelledby="land-audit">
          <span className="muted-dark">Checked data</span>
          <h2 id="land-audit">We read every cell of NASA’s tables and wrote down what is wrong with them.</h2>
          <p>{AUDIT.totals.error} likely errors, {AUDIT.totals.gap} missing values and {AUDIT.totals.note} quirks, such as oxygen written as “3400%”. Nothing in NASA’s files is changed.</p>
          <div className="land-actions">
            <a className="pill pill-accent" href="#data/audit">Read the audit</a>
            <a className="pill pill-white" href="#data">Browse all {COUNTS.rows.total.toLocaleString("en-US")} records</a>
          </div>
        </section>
      </div>

      <p className="land-foot">
        A research prototype. It does not predict fire behaviour, is not a safety certification, and is not affiliated with or endorsed by NASA.
        Data: NASA <a href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer">Physical Science Informatics</a> and{" "}
        <a href={SAFFIRE_NTRS_SOURCE.url} target="_blank" rel="noreferrer">NASA NTRS {SAFFIRE_NTRS_SOURCE.ntrsId}</a>.
      </p>
    </main>
  );
}
