import { INVESTIGATIONS } from "../data/investigations";
import { PSI_SNAPSHOT } from "../data/psi";
import rawReport from "../data/verify-report.json";
import tableManifest from "../data/table-manifest.json";
import rawAudit from "../data/atlas/audit.json";
import type { AuditFile } from "../lib/atlas/audit";

const AUDIT = rawAudit as unknown as AuditFile;
import { profilesWithNormalizedConditions } from "../lib/ranking";

interface VerifyReport {
  recordedAt: string;
  code?: { parentCommit: string; sourceTreeSha256: string; files: number; uncommittedChanges: number } | null;
  dataSnapshot?: { id: string; sha256: string };
  node: string;
  tests: { passed: number; failed: number; total: number; files: number; names: { file: string; title: string; status: string }[] };
  dataFingerprint: { algorithm: string; files: string[]; value: string };
  scoreboard?: { id: string; label: string; how: "rerun" | "recorded" | "manual"; checked: number; passed: number; method: string }[];
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
const profileRecords = INVESTIGATIONS.map((i) => PSI_SNAPSHOT.records.find((r) => r.accession === i.psi.accession)).filter((r): r is NonNullable<typeof r> => !!r);
const withDoi = new Set(profileRecords.filter((r) => r.doi).map((r) => r.accession)).size;
const accessions = new Set(profileRecords.map((r) => r.accession)).size;
const cc0 = new Set(profileRecords.filter((r) => r.license?.id === "CC0-1.0").map((r) => r.accession)).size;
const noLicence = [...new Set(profileRecords.filter((r) => !r.license).map((r) => r.accession))];
const TABLES = tableManifest as { tables: { id: string; rows: number }[] };
const usedTables = new Set(INVESTIGATIONS.flatMap((i) => Object.values(i.conditions)).filter((r) => r?.source === "psi-table").map((r) => r!.table));
const tableRows = TABLES.tables.filter((t) => usedTables.has(t.id)).reduce((n, t) => n + t.rows, 0);
const tableRanges = INVESTIGATIONS.flatMap((i) => Object.values(i.conditions)).filter((r) => r?.source === "psi-table").length;
const tableProfiles = INVESTIGATIONS.filter((i) => Object.values(i.conditions).some((r) => r?.source === "psi-table")).length;
const normalized = profilesWithNormalizedConditions();
const testsLine = report.tests.total
  ? `${report.tests.passed} of ${report.tests.total} automated checks passed, recorded ${report.recordedAt} on Node ${report.node.replace(/^v/, "")}`
  : "No test report recorded yet (run npm run verify:report)";

const BOARD = report.scoreboard ?? [];
const AUTOMATED = BOARD.filter((r) => r.how !== "manual");
const BOARD_PASSED = AUTOMATED.reduce((n, r) => n + r.passed, 0);
const BOARD_CHECKED = AUTOMATED.reduce((n, r) => n + r.checked, 0);
const HOW_LABEL = { rerun: "Re-run on every report", recorded: "Recorded by a sync run", manual: "Checked by hand" } as const;

function Scoreboard() {
  if (!BOARD.length) return null;
  return (
    <section className="card scoreboard section-gap" aria-labelledby="board-title">
      <div className="board-head">
        <div>
          <p className="eyebrow">Verification scoreboard · recorded {report.recordedAt}</p>
          <h2 className="h3-size" id="board-title">Every check, with totals</h2>
        </div>
        <p className="board-total"><strong>{BOARD_PASSED.toLocaleString("en-US")}</strong> of {BOARD_CHECKED.toLocaleString("en-US")} automated checks pass</p>
      </div>
      <div className="table-wrap">
        <table className="board">
          <thead><tr><th>Check</th><th>Result</th><th>How</th><th>What is checked</th></tr></thead>
          <tbody>
            {BOARD.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td className="num"><span className={`badge ${r.passed === r.checked ? "badge-ok" : "badge-bad"}`}>{r.passed.toLocaleString("en-US")}/{r.checked.toLocaleString("en-US")}</span></td>
                <td className="small muted">{HOW_LABEL[r.how]}</td>
                <td className="small">{r.method}</td>
              </tr>
            ))}
            <tr className="not-run">
              <td>AI answer accuracy benchmark</td>
              <td className="num"><span className="badge badge-warn">Not run</span></td>
              <td className="small muted">Needs a live Gemini key</td>
              <td className="small">Would score live answers to fixed questions against hand-written expected findings. The checks above confirm each claim's quotes and numbers come from its sources; they do not grade whether the reasoning is right. The analysis benchmark above has no model in it; its cases are listed on the <a href="#research-benchmark">Workbench page</a>.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">The total counts automated checks only; hand checks are listed but not added in. Run <code>npm run verify:report</code> to re-run them and rewrite this table.</p>
      <p className="small muted">
        These results belong to data snapshot <code>{report.dataSnapshot?.id ?? "not recorded"}</code>
        {report.code ? <> and source tree <code>{report.code.sourceTreeSha256.slice(0, 12)}</code> (built on commit <code>{report.code.parentCommit.slice(0, 7)}</code>)</> : null}.
        They show that the software does what its tests specify. They are not a review of NASA’s measurements or of the scientific reading of them.
      </p>
    </section>
  );
}

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
    shown: `${verified} of ${INVESTIGATIONS.length} profiles link to their NASA PSI record, synced ${PSI_SNAPSHOT.fetchedOn}. ${tableProfiles} profiles take ${tableRanges} oxygen, pressure or airflow ranges from ${usedTables.size} of ${TABLES.tables.length} stored NASA PSI run tables (${tableRows.toLocaleString("en-US")} source rows; SHA-256 per file); the remaining ranges are labelled curated. The Fire Test Atlas keeps the NASA header and cell behind every value of all ${TABLES.tables.length} tables, and a data audit lists ${AUDIT.totals.issues} issues found in them.`,
    missing: "Gravity, fuel type and the remaining curated ranges are not read from tables. The ranking's ranges are marginal min–max envelopes; joint test points are counted separately (tests near your scenario). Only one slice has been compared with its source paper: 188 BASS-II oxygen and carbon monoxide cells against NASA/TM-20210011385 (Compare page). The other tables were not.",
  },
  {
    name: "Results uncertainty", q: "Is uncertainty in the results represented?", level: "Limited",
    shown: "Unknown inputs earn zero and are flagged; equal scores share a rank within a fuel group; other fuels and adjacent research are labelled separately. Findings and comparisons carry intervals computed from their own rows, and the Compare and Workbench pages recompute each result under stricter data-quality rules.",
    missing: "Measurement uncertainty from the experiments is not propagated. The intervals treat each row or pair as independent; which runs shared a session has not been reviewed.",
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
    missing: "No formal configuration-control or release-approval process. A CI check rebuilds the atlas, audit and findings from the stored NASA tables and fails if the committed data differs.",
  },
  {
    name: "People qualifications", q: "Who built and reviewed it?", level: "Not established",
    shown: "Built as a NASA Space Apps research prototype.",
    missing: "Curated interpretations have not been signed off by an independent combustion or fire-safety expert. The BASS-II source cross-check was done by an AI coding assistant, not by a second person.",
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
        <div className="card stat"><p className="big">{normalized}</p><p className="small muted">Profiles with O₂, pressure or airflow ranges ({tableProfiles} from NASA run tables, the rest curated estimates)</p></div>
      </div>

      <Scoreboard />

      <section className="card verify section-gap">
        <div>
          <p className="eyebrow">Verify it yourself</p>
          <h2 className="h3-size">Reproduce from the repository</h2>
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
            <div className="factor-head"><h3 className="h4-size">{f.name}</h3><span className={`badge ${LEVEL_CLASS[f.level]}`}>{f.level}</span></div>
            <p className="q">{f.q}</p>
            <p><strong>Shown:</strong> {f.shown}</p>
            <p><strong>Missing:</strong> {f.missing}</p>
          </article>
        ))}
      </div>

      <p className="eyebrow section-gap">FAIR data self-check</p>
      <h2 className="h2">Findable, accessible, interoperable, reusable.</h2>
      <div className="factor-grid">
        <article className="card factor"><h3 className="h4-size">Findable</h3><p>{verified} of {INVESTIGATIONS.length} profiles carry a NASA PSI accession and link to its record. NASA assigns each PSI investigation a DOI; {withDoi} of the {accessions} records EMBER uses have one, and EMBER shows it beside the record.</p></article>
        <article className="card factor"><h3 className="h4-size">Accessible</h3><p>All curated data is plain TypeScript in the repository; no account or API key is needed.</p></article>
        <article className="card factor"><h3 className="h4-size">Interoperable</h3><p>Units are fixed per field (vol %, psia, g, m/s). The CSV export adds one harmonised unit per quantity; the ranked ranges themselves are not harmonised across studies.</p></article>
        <article className="card factor"><h3 className="h4-size">Reusable</h3><p>Every range states its basis. {cc0} of the {accessions} PSI records EMBER uses state a CC0-1.0 (public domain) licence on the record{noLicence.length ? `; ${noLicence.join(", ")} states none, so check it before reuse` : ""}. EMBER's own code is MIT-licensed.</p></article>
      </div>

      <section className="card warm section-gap">
        <h2 className="h3-size">What EMBER does not claim</h2>
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
