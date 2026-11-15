# M1 — First defensible analysis

Implemented November 15, 2026, on the M0 baseline (`aa68612`). Entry point: `#compare`, also linked from F4. This delivers the narrow M1 acceptance gate: one source-cross-checked comparison, explicit exclusions/uncertainty, sensitivity and an offline reproduction package. Independent human/scientific review and the reviewed F8 package remain follow-on work.

## Scope and provenance

- 47 candidate PSI-25 observations: 20 PMMA slab rows and 27 explicitly named SIBAL rows. These are observations, not an asserted count of independent experiments.
- Four gas cells per row (188 cells): calibrated initial/final O2 and initial/final CO. Independently transcribed into `src/lib/analysis/review.ts` from rendered NASA/TM-20210011385, Tables A.4/A.6, printed pp. 108–109/112–113 (PDF pp. 116–117/120–121). All 188 match the stored PSI cells, treating missing sentinels equivalently while preserving original strings.
- Review performed by Codex; no independent human/scientific sign-off. The numbers are cross-checked against another presentation of the same experiment, not independently measured ground truth.
- T23 gas cells agree but its material differs in wording: PSI says Sibal; the report says SI. Reviewed mode excludes it until equivalence is resolved.
- T28a/T28b final O2 anomalies recur in the report; they are not corrected. Both also lack a complete CO pair.
- Negative CO readings are preserved. An explicit sensitivity policy excludes them without inventing a zero-offset correction.
- NTRS 20150019858, PDF p. 4, supplies published CO sensor context (zero calibration every 60 days, 0–1000 ppm range, 1 ppm resolution). This is not a per-reading uncertainty model; M5's explicit `>500` flag remains censored.
- Dates are not reconciled session IDs. For example, T10's report date is 2018 while PSI says 2014. No session-clustered uncertainty is claimed.
- Source PDF/CSV SHA-256 values, dataset DOI/license and exact locators travel with every package. Original sources are never overwritten. Reports were downloaded and inspected under `research/m1`; PDFs and the local PDF tool installation are research artifacts, not production dependencies.

## Calculation contract

The estimand is median(final CO − initial CO) in A minus the corresponding median in B, in ppm. Cohorts can be reversed; a shared starting-O2 window applies to both. Raw mode matches the relevant F4 medians. Source-reconciled mode adds source-match/material eligibility; there are no justified numeric replacements.

Every row has either a used entry or exclusion entry with all applicable reasons. Missing and censored values never become zeros or bounds-as-point-estimates. Initial O2 and CO ranges expose condition imbalance; raw geometry and airflow strings are in the ledger and export. Burn duration, mass and flow are not harmonized. The result is neither an intrinsic toxicity ranking nor a causal material comparison.

The deterministic percentile bootstrap uses 2,000 independent-observation resamples, seed 20261115, and linearly interpolated 2.5th/97.5th percentiles of median differences. Intervals are exploratory and may be too narrow due to shared sessions. Measurement/calibration and transfer uncertainty are not included. No interval is produced without overlapping starting O2 or at least two distinct numeric changes per cohort. This is a degeneracy safeguard, not an assertion of inferential adequacy. Empty cohorts and invalid specs block comparisons and downloads.

Default sensitivity results:

| Policy | A / B numeric observations | Difference (ppm) | 95% bootstrap interval (ppm) |
|---|---:|---:|---:|
| Raw numeric pairs | 19 / 25 | 315 | 200–409 |
| Source-reconciled | 19 / 24 | 314 | 198.9875–409 |
| Reconciled, negative CO excluded | 18 / 20 | 302 | 194.5–393.025 |
| Reconciled, common O2 range (17.9–20.8 vol%) | 12 / 11 | 319.5 | 221.5–459 |

Intervals are rounded only for display; the package preserves full numerical results. All materials in this narrow slice are explicitly stated in PSI, so a no-inferred-material filter would be redundant. Shared links pin the data/review version and reject stale snapshots. The package retains control history from the current page visit; links retain the current state only.

## Reproduction

Download the ZIP from Compare, extract it, and run `node reproduce.mjs` with Node.js 22+. No npm install, server, network or AI key is required. The runner:

1. Verifies each payload SHA-256.
2. Reconstructs the 47 candidates from the 129 stored raw PSI rows.
3. Checks the reconstructed observations against the exported normalized observations.
4. Recomputes the complete comparison and sensitivity results with the same bundled engine as the browser.
5. Checks exact unrounded equality and writes `reproduced-results.json`; a mismatch exits unsuccessfully.

The package contains the spec/schema, filter history, raw/normalized JSON, included/excluded CSV, units, source manifest/crosswalk, expected results, engine, runner, README, MIT license and checksum files. Hashes detect accidental corruption; they do not authenticate authorship. Original upstream CSV/PDF bytes are not included, so this reproduces calculations from preserved cells, not a fresh NASA download/extraction. An independent statistical implementation is future work.

## Validation

- 13 new tests cover the report crosswalk, source drift, bounds/missing values, anomalies, raw-F4 parity, hand-calculated medians, denominator accounting, sensitivity, determinism, invalid/empty/nonoverlapping/degenerate comparisons, shared links and stale versions.
- A standalone package is executed in an isolated temporary directory by Node with no app/server dependencies; complete unrounded output matches. Deliberate payload corruption is rejected.
- Full suite: 526 tests across 29 files pass. Production TypeScript/Vite/API build passes. Existing large bundle warnings remain; Compare and its PSI table load lazily.
- `npm run data:check` reproduces the unchanged baseline derived data. Browser checks cover policy changes, empty-result/export blocking and exact shared-link reload. The actual browser-downloaded ZIP passes Python's independent standard-library ZIP/CRC check and its Node runner reproduces the custom 18–21 vol% result (12 / 11 observations; difference 303.5 ppm) exactly.

## Follow-on work

Reviewed F8 pairing/export; session identities and grouped resampling; independent human review; additional comparison templates; mass/duration/flow harmonization only where defensible. This milestone does not claim completion of workstreams C–F across the whole Atlas or of the M2 acceptance gate for all eight findings.
