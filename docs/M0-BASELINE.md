# M0: accurate baseline

Milestone M0 of the EMBER functionality and data roadmap, completed 2026-11-15 on top of commit
`e08de4d`. Scope: workstream A (a trustworthy baseline), the minimal identity and quantity fixes
from workstream B, and a review of the SAME and SAME-R fresh/aged denominators.

Exit gate: *counts agree and distinguish observations from experiments; baseline checks pass;
changes are documented.*

This report keeps two things apart. **Code correctness** is what the automated checks establish:
the software does what it specifies and the data files rebuild from their sources. **Scientific
validation** is whether NASA's values and EMBER's reading of them are right; almost none of that
has been independently done, and the second half of this report says exactly what has not.

## What changed

| Roadmap task | Delivered |
|---|---|
| A1. One manifest for all counts | `src/data/counts.json`, built by `scripts/build-counts.ts` in `npm run data:atlas` and re-checked by `npm run data:check`. The landing, findings, data and scenario pages read their counters from it. |
| A2. Separate rows, observations, experiments | The manifest counts source rows, test rows, supplement rows and distinct experiments separately. The Data page explains the difference. Findings list their ids and are never summed. |
| A3. Versions and hashes in exports | A snapshot id (SHA-256 over the seven data files a result depends on) is in the evidence brief, in every line of the scenario CSV and in the atlas download's file name. Changes are logged in [CHANGELOG.md](CHANGELOG.md). The pre-M0 state is commit `e08de4d`. |
| A4. Explicit status | Each value says when it was `converted`, `invalid`, a `bound` or a `placeholder`; each row says whether a missing condition is a `blank` cell or `not-in-table`. Material basis (`stated`, `inferred`, `none`) already existed. Experiment identity says how it is known, and a supplement says whether it is `matched`. |
| A5. Bounded and multi-valued cells | Multi-valued cells are typed `list`, `range` or `trajectory` and never reduced to one number. Matching uses whole spans and unrounded values. Off-scale readings were already kept as bounds and now carry `status: bound`. |
| A6. Checks recorded against the code | `verify-report.json` records the parent commit, a hash of the exact source tree tested and the data snapshot id. |
| A7. SAME / SAME-R identity | Reviewed: 45 SAME test rows observe 29 runs; 109 SAME-R test rows observe 67. The legacy row count (1,912) is kept and the experiment count (1,854) is reported beside it. |
| B (minimal). Supplemental observations | New row kind `supplement` for the 109 SAME-R results rows, linked to their run by experiment identity. They no longer share a kind with footnotes. |
| F8 pairing | Pairs by experiment identity, refuses ambiguous or inconsistent pairs, lists the 10 excluded runs by id, and reports SAME and SAME-R separately. |
| Workbook sync | Reads from memory (no temporary path), dependency pinned in `scripts/requirements.txt`, stops if a formula cell has no saved value (2,741 formula cells, all with values). |
| Documentation | Counts corrected in the README, feature guide, data guide and data card; competitor comparisons removed from the old data plan. |

Deliberately not done in M0 (later milestones): the general Atlas v2 schema (gravity, uncertainty,
endpoint definitions), reconciliation against NASA publications, the comparison engine, session-aware
uncertainty, reproduction packages, and material, thickness and flow-direction as evidence filters.

## Acceptance checks

Run on the final M0 tree. Commands are in the repository; results are in `src/data/verify-report.json`.

| Check | Result |
|---|---|
| Every displayed count agrees with a recount | Pass. `src/lib/counts.test.ts` recounts from the freshly built atlas and NASA's stored tables with independent loops, and matches the manifest. The manifest reproduces all nine counts in the roadmap's own baseline table (623, 1,289, 402, 5, 85, 1,023, 3, 887, 1,304). |
| Counts distinguish observations from experiments | Pass. 2,168 records; 1,912 test rows; 1,854 experiments; 109 supplements; tested in `atlas.test.ts` and `counts.test.ts`. |
| Docs agree with the data | Pass. 22 sentences across four documents are checked against the manifest by test. |
| An output identifies its snapshot | Pass for the brief, the scenario CSV and the atlas download name (tested). The row-level CSV carries each NASA file's SHA-256 per line, as before, and not the snapshot id. |
| Ambiguous scalar conversions corrected or excluded | Pass. The three range-valued test rows are matched by span; no display rounding in matching (tested, including an edge case 0.004 outside a window). |
| Paired and duplicated evidence cannot inflate counts | Pass for SAME and SAME-R (tested: no two rows of a table share a run identity and role; every aged row has its fresh row). Not established elsewhere: see below. |
| Existing findings reproduce | Pass. F1–F7 numerically identical; F8 identical (46 of 48, median 1.5 times), with added per-flight figures. Each finding still recomputes from its cited rows alone and matches a recount from NASA's raw cells. |
| Raw NASA data preserved | Pass. No file in `src/data/tables` changed; the workbook sheet re-extracts byte for byte from a fresh PSI download (SHA-256 `6d3a539c…`). |
| Type check, tests, build, data rebuild | Pass: `tsc`, 513 tests in 28 files, `npm run build`, `npm run data:check`. No test was removed or weakened; 47 were added. |
| Recorded AI answers still valid | Pass: all 74 kept, no claim newly rejected, all recorded verdicts reproduce. |
| Accessibility of changed pages | Pass: axe WCAG 2 A/AA on the Data and Credibility pages, light and dark; no horizontal scroll at 390 px. |
| Performance | Measured in the build container, not on a reference laptop: atlas table ready about 0.1 s after navigation; five text filters took 14–32 ms each. The atlas browser chunk is 1.14 MB (77 kB gzipped), up 2% from keeping unrounded values and spans. |

## Code correctness: what the checks do establish

- The atlas, audit, findings and counts rebuild deterministically from the stored NASA files, and CI
  fails if a committed file differs from a rebuild.
- Every atlas value equals the NASA cell it cites; every finding's numbers come from its cited rows.
- Run identities for SAME and SAME-R are internally consistent across NASA's two files, except the
  two runs listed as unresolved.
- Counts, docs and exports cannot drift from the data without a test failing.

## Scientific validation: what has not been done

No independent scientist has reviewed any of this. Specifically:

- **NASA's values are taken as written.** The tables and the workbook were not compared with the
  source papers or final reports, cell by cell. Four quotations from the SAME and SAME-R final
  reports are verified as text; that is not a numerical reconciliation of the workbook.
- **Experiment identity is reviewed for two investigations only.** For the other 1,758 test rows,
  one row is assumed to be one experiment. Identical rows flagged in the audit may be duplicates.
- **The SAME-R file conflict is open.** "Teflon 57" (run table only) and "Kapton 112" (workbook
  only) are kept as written; nobody has determined which file is right.
- **Workbook values are Excel's saved results.** They were not recalculated, and the definitions of
  the size metrics (count-mean versus mass-based diameter) were not checked against the reports.
- **The DBP runs are missing from F8 for a data reason, not a physical one.** The sheet EMBER reads
  holds no reduced diameter for them; raw readings exist elsewhere in the workbook and are not imported.
- **Uncertainty intervals assume independent runs.** Session and carousel grouping were not
  assessed, so intervals may be too narrow. This is now stated on each finding.
- **Nearby-test windows, ranking weights and the 5-point / 2.5 psi proximity scale are chosen, not
  fitted,** and remain unvalidated.
- **Material, thickness and flow direction** in a scenario are still descriptive only; they do not
  filter evidence.
- **Live AI answer quality** was not evaluated (no model key in the build environment); the checks
  cover citations and numbers, not reasoning.
- **Gravity** is still a single fixed value in the atlas; partial-gravity material is quotation only.

## Reproducing M0

```bash
npm ci
```

```bash
npm run data:check
```

```bash
npm test
```

```bash
npm run build
```

To re-extract the SAME/SAME-R sheet from NASA's workbook (needs Python 3 and network access to
psi.nasa.gov):

```bash
python3 -m pip install -r scripts/requirements.txt
```

```bash
npm run sync:same
```
