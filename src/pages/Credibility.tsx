import { INVESTIGATIONS } from "../data/investigations";
import { PSI_SNAPSHOT } from "../data/psi";
import rawReport from "../data/verify-report.json";
import tableManifest from "../data/table-manifest.json";
import { profilesWithNormalizedConditions } from "../lib/ranking";

interface VerifyReport {
  recordedAt: string;
  node: string;
  tests: { passed: number; failed: number; total: number; files: number; names: { file: string; title: string; status: string }[] };
  dataFingerprint: { algorithm: string; files: string[]; value: string };
}
const report = rawReport as VerifyReport;

type Level = "Evidence shown" | "Partial" | "Limited" | "Not established";
const LEVEL_CLASS: Record<Level, string> = {
  "Evidence shown": "badge-ok",
  Partial: "badge-warn",
  Limited: "badge-warn",
  "Not established": "badge-bad",
};

const verified = INVESTIGATIONS.filter((i) => i.psi.verifiedOn).length;
const TABLES = tableManifest as { tables: { id: string; rows: number }[] };
const tableRows = TABLES.tables.reduce((n, t) => n + t.rows, 0);
const tableRanges = INVESTIGATIONS.flatMap((i) => Object.values(i.conditions)).filter((r) => r?.source === "psi-table").length;
const tableProfiles = INVESTIGATIONS.filter((i) => Object.values(i.conditions).some((r) => r?.source === "psi-table")).length;
const normalized = profilesWithNormalizedConditions();
const testsLine = report.tests.total
  ? `${report.tests.passed} of ${report.tests.total} automated checks passed, recorded ${report.recordedAt} on Node ${report.node.replace(/^v/, "")}`
  : "No test report recorded yet (run npm run verify:report)";

const FACTORS: { name: string; q: string; level: Level; shown: string; missing: string }[] = [
  {
    name: "Verification", q: "Does the software do what it specifies?", level: report.tests.total && !report.tests.failed ? "Evidence shown" : "Partial",
    shown: `${testsLine}: ranking rules, unknown-field handling, limitations and robustness probes.`,
    missing: "No independent code review has been recorded.",
  },
  {
    name: "Validation", q: "Does it agree with the real world for its intended use?", level: "Not established",
    shown: "EMBER ranks evidence; it does not predict fire behavior, so there is no physical output to validate.",
    missing: "Relevance weights have not been compared with expert rankings; the weight-scheme probe shows when the lead depends on them.",
  },
  {
    name: "Input pedigree", q: "Where did every input come from?", level: verified === INVESTIGATIONS.length ? "Partial" : "Limited",
    shown: `${verified} of ${INVESTIGATIONS.length} profiles link to their NASA PSI record, synced ${PSI_SNAPSHOT.fetchedOn}. ${tableProfiles} profiles take ${tableRanges} oxygen, pressure or airflow ranges straight from ${TABLES.tables.length} stored NASA PSI run tables (${tableRows} source rows, SHA-256 per file); the remaining ranges are labelled curated.`,
    missing: "Gravity, fuel type and the remaining curated ranges are not read from tables. Ranges are marginal min–max envelopes, not joint test points.",
  },
  {
    name: "Results uncertainty", q: "Is uncertainty in the results represented?", level: "Limited",
    shown: "Unknown inputs earn zero and are flagged; ties share a rank; adjacent research is labelled separately.",
    missing: "Measurement uncertainty from the experiments is not propagated.",
  },
  {
    name: "Results robustness", q: "How sensitive are results to the inputs?", level: "Evidence shown",
    shown: "Every scenario runs small input changes, single-input removals and four alternative point schemes, and reports whether the lead holds.",
    missing: "Probes test the ranking rule near your inputs, not the underlying experiments.",
  },
  {
    name: "Use history", q: "Has it been used successfully before?", level: "Limited",
    shown: "Automated tests only.",
    missing: "No external users or field use yet.",
  },
  {
    name: "M&S management", q: "Are versions and changes controlled?", level: "Evidence shown",
    shown: `Git history and a recorded data fingerprint (${report.dataFingerprint.value ? report.dataFingerprint.value.slice(0, 12) + "…" : "not recorded"}).`,
    missing: "No formal configuration-control or release-approval process.",
  },
  {
    name: "People qualifications", q: "Who built and reviewed it?", level: "Not established",
    shown: "Built as a NASA Space Apps research prototype.",
    missing: "Curated interpretations have not been signed off by an independent combustion or fire-safety expert.",
  },
];

export function Credibility() {
  return (
    <main className="page">
      <header className="cred-hero">
        <p className="eyebrow">Credibility self-assessment</p>
        <h1>How far can you trust this evidence?</h1>
        <p className="muted">EMBER checks that its software does what it specifies and says where its data came from. It is not a validated predictive model.</p>
      </header>

      <div className="stats">
        <div className="card stat"><p className="big">{report.tests.passed}/{report.tests.total}</p><p className="small muted">Automated checks passed · recorded {report.recordedAt || "never"}</p></div>
        <div className="card stat"><p className="big">{INVESTIGATIONS.length}</p><p className="small muted">Curated investigation profiles</p></div>
        <div className="card stat"><p className="big">{verified}/{INVESTIGATIONS.length}</p><p className="small muted">Profiles linked to a NASA PSI record · synced {PSI_SNAPSHOT.fetchedOn}</p></div>
        <div className="card stat"><p className="big">{normalized}</p><p className="small muted">Profiles with normalized O₂, pressure or airflow ranges</p></div>
      </div>

      <section className="card verify">
        <div>
          <p className="eyebrow">Verify it yourself</p>
          <h3>Reproduce from the repository</h3>
          <pre><code>npm ci && npm run verify:report</code></pre>
          <pre><code>npm run sync:psi</code></pre>
          <p className="small muted">
            Re-fetches {PSI_SNAPSHOT.records.length} Combustion Science records (of {PSI_SNAPSHOT.totalInvestigations} PSI investigations) from <code>{PSI_SNAPSHOT.source}</code>.
            Stored response SHA-256: <code>{PSI_SNAPSHOT.responseSha256}</code>
          </p>
          <p className="small muted">
            Re-runs every test, recomputes the data fingerprint and rewrites <code>src/data/verify-report.json</code>.
            Recorded fingerprint: <code>{report.dataFingerprint.value || "none"}</code>
          </p>
        </div>
      </section>

      <p className="eyebrow section-gap">NASA-STD-7009B · Eight credibility factors</p>
      <h2 className="h2">What we can show, and what is missing.</h2>
      <p className="small muted">NASA's modeling and simulation standard assesses credibility through eight factors. EMBER uses them as a reporting structure for an honest self-assessment. This is not a formal NASA credibility assessment, accreditation or compliance claim.</p>
      <div className="factor-grid">
        {FACTORS.map((f) => (
          <article className="card factor" key={f.name}>
            <div className="factor-head"><h4>{f.name}</h4><span className={`badge ${LEVEL_CLASS[f.level]}`}>{f.level}</span></div>
            <p className="q">{f.q}</p>
            <p><strong>Shown:</strong> {f.shown}</p>
            <p><strong>Missing:</strong> {f.missing}</p>
          </article>
        ))}
      </div>

      <p className="eyebrow section-gap">FAIR data self-check</p>
      <h2 className="h2">Findable, accessible, interoperable, reusable.</h2>
      <div className="factor-grid">
        <article className="card factor"><h4>Findable</h4><p>{verified} of {INVESTIGATIONS.length} profiles carry a NASA PSI accession and link to its record. PSI does not publish DOIs for investigation records.</p></article>
        <article className="card factor"><h4>Accessible</h4><p>All curated data is plain TypeScript in the repository; no account or API key is needed.</p></article>
        <article className="card factor"><h4>Interoperable</h4><p>Units are fixed per field (vol %, psia, g, m/s). Cross-study harmonization is not done.</p></article>
        <article className="card factor"><h4>Reusable</h4><p>Every range states its basis. Licensing of the original PSI data must be checked per record before reuse.</p></article>
      </div>

      <section className="card warm section-gap">
        <h3>What EMBER does not claim</h3>
        <ul className="limits">
          <li>It does not predict flammability, spread rate, extinction or fire risk.</li>
          <li>Match points select evidence. They are not confidence or probability.</li>
          <li>No partial-gravity measurements are in the ranked profiles.</li>
          <li>It is not a NASA product and not a safety certification.</li>
        </ul>
      </section>

      <details className="card section-gap">
        <summary><strong>All {report.tests.total} recorded checks ({report.tests.files} test files)</strong></summary>
        <ul className="check-list">
          {report.tests.names.map((t, i) => (
            <li key={i} className={t.status === "passed" ? "ok" : "bad"}>{t.status === "passed" ? "✓" : "✗"} <code>{t.file}</code> {t.title}</li>
          ))}
        </ul>
      </details>
    </main>
  );
}
