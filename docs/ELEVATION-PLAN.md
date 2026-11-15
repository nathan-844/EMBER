# EMBER functionality and data roadmap

Prepared November 15, 2026; updated against commit `e08de4d` of `nathan-844/EMBER` (previous baseline: `96a9969`).

**Objective:** make EMBER a reusable research workbench that turns NASA combustion records into defensible comparisons, traceable findings and specific research questions. A user should be able to select evidence, compute an answer, challenge its assumptions and reproduce it outside EMBER.

This is an implementation plan, not a claim that all proposed capabilities already exist. It prioritizes functionality and data before a visual redesign. Estimates are rough engineering effort for someone familiar with the repository, excluding external review, source access delays and new experimental work. No award outcome is guaranteed.

**November 15 implementation update:** M0 was imported in `aa68612`. The narrow M1 comparison workflow is now implemented locally: source-cross-checked BASS-II PMMA/SIBAL CO comparison, oxygen and quality controls, sensitivity, a complete row ledger, pinned share links and an offline reproducibility ZIP. See [M1-IMPLEMENTATION.md](M1-IMPLEMENTATION.md) for scope, review limits, results and validation. Independent human/scientific sign-off and the reviewed F8 package remain follow-on tasks; this does not complete all of workstreams C–F.

**M2 implementation update:** the local workbench now adds Saffire-II, FLEX and optional smoke-ageing comparisons, the additive Atlas research-v2 view, reproducible exports for all eight findings and a 60-case deterministic benchmark. Smoke pair values are independently checked against stored workbook cells; original workbook/PDF extraction and independent scientific review remain separate. See [M2-IMPLEMENTATION.md](M2-IMPLEMENTATION.md) for exact scope and validation. The benchmark is a structured deterministic baseline, not completed live-AI, retrieval or citation-entailment evaluation.

**M3 implementation update:** `#mission` adds A/B atmosphere evidence applicability, editable material inventories and explicit condition windows, row-level provenance/reasons, sensitivity and Pareto views, plus a transparent budgeted test-coverage planner and offline reproducibility ZIP. Thickness recovery is limited to source geometry and the explicit Saffire labels; unknown pressure/gravity stay unknown. The test planner is a greedy coverage heuristic, not experimental-design optimization. See [M3-IMPLEMENTATION.md](M3-IMPLEMENTATION.md) for scope, validation and limits.

## 1. Award alignment and scope

The official 2025 Best Use of Data description emphasizes making space data accessible or applying it in a distinctive way. A 2026-specific award definition was not successfully retrieved during this review; use the 2025 definition as directional guidance, not as a verified 2026 rubric. The current challenge is Flame in Freefall.

- [Official award description, 2025](https://www.spaceappschallenge.org/2025/awards/)
- [Official challenge, 2026](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)

For EMBER, prioritize four measurable contributions:

1. **Accessibility:** heterogeneous NASA records become understandable, queryable, downloadable data.
2. **Useful analysis:** users can answer a new question from actual observations.
3. **Credibility:** independent checks, explicit uncertainty and limits support the answer.
4. **Reuse:** another person can reproduce and extend the analysis without the application.

The full roadmap is larger than a hackathon submission. Build in gated releases and preserve the submitted snapshot. Before publishing post-deadline changes as competition work, check the applicable event rules and organizer instructions. Do not assume later work will be eligible for judging.

## 2. Changes since the first plan and verified starting point

The latest import contains three commits: DOI/licence metadata and corrected FAIR statements (`586b72e`), SAME/SAME-R workbook ingestion and F8 (`eeb5c20`), and final-report quotations from PSI-hosted PDFs (`e08de4d`). These changes advance parts of workstreams B, C, F and I; they do not complete general source reconciliation or interactive comparisons.

| Previously proposed work | New status | Remaining work |
|---|---|---|
| Capture source DOI and licence | Delivered for all 24 PSI catalogue records: all have DOIs; 23 declare CC0-1.0; PSI-10 has no declared licence | Carry record/file-level terms and citations into analysis exports; do not treat a missing declaration as CC0 |
| Add SAME smoke measurements | First ingestion delivered: 154 workbook rows, 45 associated with SAME and 109 with SAME-R | Link observations to canonical experiment IDs; support stratified analysis and preserve measurement semantics |
| Compute smoke-related findings | F8 delivered: 48 fresh/aged pairs, 46 increasing, median within-pair diameter ratio 1.5 | Independently review pairing and zeros; separate flight/material/age effects; add sensitivity and reproducible export |
| Check published smoke results | Two PSI-hosted final reports and four additional verified quotations recorded | Reconcile workbook values and units against report tables; quotation verification alone is not numerical reconciliation |
| Detection design questions | Eleven questions now include smoke travel time and obstructions | Make evidence comparisons functional; do not imply a smoke-transport or detector-performance model exists |

**Priority adjustment:** bring observation identity and SAME/SAME-R pairing review into M0/M1. Keep BASS-II as the first general comparison candidate, but make a reviewed F8 reproduction package an early detection-focused deliverable. Do not plan to re-import smoke data that is already present.

Counts below were recomputed from the committed JSON, not copied from older prose. They describe the application's current classification, not an independently established count of physical experiments. The import review also inspects the new extraction and finding code; software validation is recorded separately below and does not establish independent scientific validity.

| Item | Current state |
|---|---|
| Atlas source records | 2,168: 2,163 PSI source rows plus five NTRS samples |
| Record kinds | 1,912 rows labelled `test`; 103 session summaries; 16 matrix rows; 137 rows labelled `aside`, including 109 scientifically useful SAME-R supplemental observations |
| PSI tables | 23, including the extracted SAME/SAME-R workbook sheet |
| Findings | Eight computed findings, F1–F8 |
| Audit | 42 issues across 16 of 23 tables; internal consistency, not systematic paper reconciliation |
| Recorded outcomes | 623 test-labelled rows; 1,289 test-labelled rows say `not-recorded` |
| Solid-material rows labelled test | 402; only five have a scalar pressure value in the Atlas (409 solid records if non-test kinds are also counted) |
| Inferred material identity | 85 test rows |
| Test-labelled rows without a scalar ambient oxygen value | 1,023, including three rows carrying multiple/range values rather than one scalar |
| Test-labelled rows without a scalar pressure / flow value | 887 / 1,304; absence here does not establish that the original research lacks the information |
| Stored verification report | Reports 466 passing tests; distinguish this committed report from fresh validation below |
| Source catalogue identifiers | All 24 PSI records have DOI metadata; 23 have a CC0-1.0 declaration; PSI-10's licence is unknown |

**Fresh import validation (November 15, 2026, `e08de4d`):** all 466 tests across 27 files passed; `npm run build` passed TypeScript checking, the Vite production build and API bundle generation; `npm run data:check` reproduced the committed derived data. The initial sandbox test attempt blocked loopback connections; rerunning with local socket access passed. The build emits a non-blocking large-chunk warning (including the approximately 1.12 MB uncompressed Atlas browser chunk). Measure load/interaction performance before adding more browser data. These checks do not independently validate NASA measurements, the scientific interpretation, live AI answer quality or a fresh workbook/PDF download; those remain the review work described below.

Already present: source-cell lineage, material normalization, audit flags, a CSV export, code-generated findings, intervals/tests for findings, source-backed presets, partial-gravity literature quotations, nearby-test counts, ranking sensitivity, AI citation checks, a guided tour, reproducible derived-data builds, DOI/licence display and SAME/SAME-R particle-size measurements with a paired ageing finding.

Important implementation constraints:

- `AtlasRow.gravity` currently accepts only `microgravity`. F3 keeps paired ground-test observations in measures. New gravity data requires an observation-aware schema, not simply relabelling these records.
- `Quantity` supports scalars and arrays, but does not explicitly distinguish ranges, lists, trajectories, bounds and censoring thresholds.
- `compactAtlas()` selects the maximum listed value and rounds it for the browser. Three test rows currently have multivalued oxygen. A future analysis engine must not treat a range endpoint as an exact observation.
- `Scenario.material`, `thicknessMm` and `flowDirection` are described as descriptive-only. Wire them into test-level evidence eligibility before implying they constrain results.
- Nearby evidence currently uses oxygen and pressure windows, grouped by fuel class. It is not full joint-condition coverage across materials, geometry, gravity and flow.
- Existing bootstrap calculations resample rows. Session dependence needs assessment before interpreting intervals as independent-run uncertainty.
- F8 correctly forms fresh/aged ratios before resampling those ratios; its current uncertainty is therefore pair-based. Flight/material differences and possible dependence between runs still need assessment.
- SAME's old eight-row table is now classified as a matrix, and 45 workbook observations are classified as tests. Sixteen of those 45 have aged-measurement labels ending in `a`; they are repeated observations, not necessarily additional experiments. Do not present the global 1,912 count as independent runs until identity is reconciled.
- The 109 SAME-R result rows are retained as `aside` to avoid counting them twice against PSI-101-0. That is a useful immediate safeguard, but conflates scientific observations with footnotes. Add a first-class supplemental-observation relation rather than dropping them in generic filters.
- F8 pairs by test label; this snapshot has no duplicate workbook labels. Future imports should key by experiment/flight identity, explicitly reject duplicate or ambiguous pairs and verify fresh/aged material and condition consistency.
- The new per-column `zeroIsMissing` rule converts zero particle-size/dispersion readings to missing. Verify its scope against the workbook and final reports; its explanatory text mentions all-zero rows, while the implementation applies at the column level. Record excluded pair IDs and reasons, not just a count.
- Documentation remains inconsistent: the README audit count is 37; the feature guide's Atlas totals and parts of the data card still describe the older dataset. The older data plan also contains competitive-superiority claims that should not be repeated without a fresh audit.
- `sync:same` introduces Python/openpyxl, uses a `/tmp` path on download and reads cached Excel formula values (`data_only=True`). Before promising source-to-app reproduction on Windows, make temporary paths portable, document/pin dependencies and handle missing cached formula values. The extracted sheet can rebuild the app today, but reproducing workbook extraction is a separate check.

## 3. Product architecture

Keep the existing React/TypeScript application and deterministic build pipeline. Do not introduce a database, graph service or second web backend merely to handle approximately 2,000 records.

```text
Immutable source snapshots + source registry
                    |
              Extraction rules
                    |
       Atlas v2 + observation identities
                    |
      Reconciliation / quality overlays
                    |
      Versioned analysis specification
                    |
    Eligibility -> cohorts -> statistics
                    |
     Sensitivity + coverage + limitations
                    |
   UI / evidence report / reproducibility package
                    |
     Optional AI explanation of computed output
```

All result-producing calculations should live in pure modules usable by build scripts, the browser and exports. AI can translate a question into a reviewed analysis specification or explain computed output; it must not invent rows, normalize scientific values or choose an unreviewed statistical method.

Every saved result needs an identity: source snapshot hash, Atlas version/hash, analysis specification, method version, code commit and seed where relevant. Display rounding must not affect membership, matching or calculations.

## 4. Workstream A — Establish a trustworthy baseline

**Priority P0. Estimated effort: 0.5–1.5 engineering days.**

Tasks:

1. Generate all record, test, source, outcome and issue counts from one manifest. Update docs and visible counters from that manifest.
2. Separate source rows, independent experiments, observations, session summaries and source documents in every metric. Do not sum finding sample sizes: findings reuse tests.
3. Record analysis versions and hashes in exports. Preserve the original snapshot and a change log.
4. Add explicit status fields: source-reported, derived, inferred, unresolved and unverified. Distinguish missing, invalid, not applicable and not digitized.
5. Review parsing of bounded and multivalued cells before extending comparisons.
6. Run existing type checks, tests, data rebuild check and production build; record results against the exact commit. Fix documentation independently of whether software tests pass.
7. Review SAME/SAME-R experiment versus observation identities before using the new test count in a pitch. Preserve the legacy row count for traceability and report a separate reviewed experiment count.

**Done when:** every displayed count agrees with a recount; an output identifies its snapshot; every currently ambiguous scalar conversion is either corrected or explicitly excluded from exact matching.

## 5. Workstream B — Atlas v2: represent the science properly

**Priority P0 foundation. Estimated effort: 2–4 days.**

Extend rather than discard existing per-cell lineage.

| Concept | Proposed additions |
|---|---|
| Experiment identity | `experimentId`, `observationId`, optional `sessionId`, `campaignId`, `pairedGroupId`, and evidence for each grouping |
| Source identity | Source ID, existing PSI DOI/licence/record version, file/sheet identity, snapshot ID/hash, locator, extraction-rule version and stable observation identity separate from source row position |
| Gravity | Regime, numeric/range value if reported, duration where relevant, apparatus and whether measured, nominal or analogue |
| Quantity semantics | Scalar, range, discrete set, ordered start/end trajectory, lower/upper bound, unknown; raw representation retained |
| Uncertainty | Reported measurement uncertainty, calibration information and source; unknown stays unknown |
| Material | Name, formulation where stated, geometry, thickness, dimensions and inference basis |
| Conditions | Pressure, ambient oxygen, burner composition, diluent, flow direction and magnitude, ignition protocol where available |
| Endpoint | Outcome definition, termination mechanism, observation duration and censoring reason |
| Source relationships | Same experiment reported twice, aggregate of tests, paired comparison, reanalysis or independent experiment; explicitly link SAME-R workbook measurements to PSI-101-0 conditions and fresh/aged observations to one parent run |

A PSI record and a publication table may describe the same experiment. Link them; do not count them as two experiments. Source-row identifiers are stable within a snapshot, not necessarily across future source revisions.

Allow paired ground/orbit measurements and fresh/aged smoke measurements to become linked observations while preserving parent sample/run identities and denominator definitions. Introduce a supplemental-observation kind or relation so SAME-R result rows do not masquerade as footnotes. Partial-gravity reports without run-level tables remain literature evidence, not synthetic test rows.

**Done when:** every existing finding reproduces under the migration or has a documented scientific reason for changing; ranges survive browser serialization; unknown gravity never becomes zero gravity; paired and duplicated evidence cannot inflate independent sample counts.

## 6. Workstream C — Reconcile PSI with NASA publications

**Priority P1; start with headline datasets. Estimated effort: 2–5 days for a first reviewed slice.**

Build a source registry and reconciliation table:

`PSI source cell -> NASA report/page/table -> linked experiment -> agreement status -> derived-value decision -> affected findings`.

Recommended first scope:

1. BASS-II: material labels, CO sensor reporting and calibration, session context, specimen geometry and known ambient conditions.
2. Saffire-II: thickness notation, sample identities, paired ground/orbit setup and outcome definitions.
3. FLEX: column units, session identities, termination semantics and independently documented measured quantities.
4. Existing Saffire IV–VI transcription: preserve and expand the checked table linkage rather than re-entering the same samples.
5. SAME/SAME-R: use the now-ingested workbook and both PSI-hosted final reports to review particle-size definitions, ageing pairs, zeros, flow conditions and the meaning of each measurement. Four checked quotations exist already; numerical crosswalks remain to be built. Prioritize this alongside BASS-II for the new F8 claim.

Classify relationships as agrees, unit-equivalent, different experimental context, unresolved conflict or unable to match. A difference is not automatically an error. Keep raw PSI and publication values immutable; a resolution is a separate reviewed overlay with a reason and source locator.

Enrich a missing condition only when the report explicitly applies it to the identified tests. A general apparatus description is insufficient to assign pressure to every row. Expose enriched and source-cell-only analyses separately.

Create manually reviewed reference cases spanning all extraction rules, with extra coverage for inferred material, nonstandard units, censoring, paired measurements and source conflicts. A second reviewer should check high-impact resolutions when available; label team-only review honestly.

**Done when:** a user can inspect one completely reconciled finding, see each unresolved discrepancy and reproduce either the raw-only or reviewed-overlay result. Report reviewed cells/eligible cells and experiment matches; do not advertise every audit flag as a confirmed NASA error.

## 7. Workstream D — Interactive comparison engine

**Priority P1 flagship. Estimated effort: 3–5 days for one complete analysis family.**

Create `AnalysisSpec` and `AnalysisResult` contracts before writing interface components.

An analysis specification stores: question, dataset version, outcome/estimand, filters for A and B, exact/approximate match requirements, stratification, missing-value policy, quality policy, method ID and seed. The result stores: included and excluded observation IDs, reasons, denominators, condition imbalance, effect estimate, uncertainty, sensitivity, evidence references and limitations.

Initial templates:

- **BASS-II measured CO change:** compare selected material/form groups, with starting conditions and geometry displayed. Compare observed concentration changes, not toxicity or intrinsic material emissions.
- **Saffire-II paired ground/orbit extent:** preserve pairing and ordinal outcome definitions; do not imply gravity was the only experimental difference.
- **FLEX extinction observations:** stratify by fuel, diluent, pressure and initial droplet size when supported. Make explicit that analyses restricted to extinguished runs are conditional, not estimates of overall extinction probability.
- **SAME/SAME-R ageing observations (fourth template after pair review):** compare fresh and aged mean diameters within each run, stratify by flight/material/flow and show ageing duration. Keep count/first-moment mean diameter separate from mass-based size measures. These heated-material chamber observations do not predict flaming cabin fires or detector response.

Workflow:

1. Choose an outcome that the selected tables actually measure.
2. Select cohorts through structured controls or a reviewed natural-language proposal.
3. Check eligibility: outcome meaning, units, apparatus, fuel, geometry, gravity and relevant conditions.
4. Show sample counts, independent groups where known and missingness before displaying a comparison.
5. Compute approved descriptive or inferential statistics.
6. Show excluded rows and remaining condition differences beside the result.
7. Save/share the exact specification and download the reproducibility package.

Return useful refusals: incompatible endpoints, no overlapping conditions, unknown required context or insufficient observations for the chosen method. Do not invent a universal minimum sample threshold: define adequacy per method and show descriptive results when inference is inappropriate.

Start within experiments. Cross-investigation pooling requires a separate reviewed harmonization rule and compatible measurement context. Similar units alone do not establish comparability.

**Done when:** the initial templates reproduce existing findings where definitions match; changing filters deterministically updates results; invalid comparisons are blocked; independent reference calculations agree within specified tolerances; every denominator is reconstructable.

## 8. Workstream E — Uncertainty and data-quality sensitivity

**Priority P1; build with the comparison engine. Estimated effort: 2–4 days.**

Distinguish three kinds of uncertainty: variation in the observed sample, uncertainty in measurement/extraction, and uncertainty in applying observations to another environment. A narrow interval for the first does not remove the other two.

Tasks:

- Preserve `>500`, off-scale readings and unknown thresholds as bounds/censoring, not ordinary numbers. Never silently discard them from a claim about all burns.
- Use paired methods for paired experiments. Assess session/campaign clustering; where grouping is supported, compare row-based and grouped uncertainty. If grouping is unknown, disclose the independence assumption.
- For F8, retain whole fresh/aged pairs during resampling. Show SAME and SAME-R separately and assess leave-one-material/flight-out sensitivity where estimable. Use the median of within-pair ratios deliberately; the ratio of the two group medians is a different statistic. Do not imply separately calculated diameter/time medians describe one representative run or a controlled growth-rate curve.
- Report unstable or undefined bootstrap replicates rather than silently presenting an apparently precise result. Review denominator-near-zero ratios.
- Add explicit sensitivity policies: all valid observations, no inferred material, exclude relevant flagged measurements, raw-only versus reconciled context, narrower condition windows and leave-one-session/group-out where feasible.
- Distinguish observation count, eligible numeric count, censored count, excluded count and independent group count.
- Show how the estimate, interval and direction change. If data disappear under stricter assumptions, report insufficient evidence rather than stable results.
- For interactive exploration, label findings exploratory; retain filter history and avoid selecting only favorable comparisons. Any confirmatory claim needs a fixed analysis plan or independent validation.

Avoid a single scientific “confidence percentage.” Provide a compact breakdown of provenance, comparability, sample support and sensitivity instead.

**Done when:** every headline finding has a sensitivity report, no bound becomes an exact measurement, and unsupported uncertainty claims are suppressed. A changed or weakened finding counts as a successful audit outcome.

## 9. Workstream F — Reproduce and reuse an analysis

**Priority P1. Estimated effort: 1–3 days after result contracts stabilize.**

Add “Download this analysis” with:

```text
analysis.json              question, filters, method, versions and seed
observations.csv           values used, provenance and quality status
excluded.csv               rows/observations excluded with reasons
source-manifest.json       source URLs, locators, hashes and licenses
expected-results.json      unrounded numerical results and tolerances
reproduce.mjs              minimal deterministic reference runner
README.md                  commands, assumptions, interpretation and limits
checksums.sha256           package integrity
```

Include redistributable source snippets/files where terms permit, otherwise source locators and exact snapshot identifiers. Reuse the existing PSI DOI/licence metadata; carry unknown licence status for PSI-10 rather than inheriting CC0 from other records. Record workbook file identity, sheet name, original Excel row and formula/cached-value handling as well as its hash. Preserve a verifiable workbook snapshot where permitted so extraction can be reproduced independently of the extracted JSON. Prefer packaging the same tested TypeScript calculation as a standalone JavaScript runner first. An independent Python notebook is valuable as a later cross-check; if offered, maintain numerical parity tests rather than two uncoordinated implementations.

Add machine-readable schema, units dictionary, versioned dataset download, analysis links and a changelog. Offer Parquet or SQLite/DuckDB-compatible exports only when a concrete user workflow benefits; CSV/JSON remain the simplest initial interchange.

Prepare a release bundle and citation metadata. A DOI or public archive is useful after content and licensing are checked; it is not evidence that the scientific results are correct. Publication is a later task, not part of this planning request.

**Done when:** a fresh environment without EMBER's web server or an AI key reproduces all eight published findings and at least one user-defined comparison from a package, including the exact F8 pair selection and exclusions.

## 10. Workstream G — Material and mission evidence workspace

**Priority P2. Estimated effort: 2–4 days.**

Make material, thickness and flow-direction inputs functional. Users should be able to assemble a small list of habitat materials and see:

- Exact material/formulation matches, related materials and analogues as separate groups.
- Tested geometry and thickness, with explicit missing values.
- Conditions tested together, measured outcomes and relevant literature.
- What changes between mission atmospheres A and B.
- Which evidence remains applicable, becomes less applicable or is unavailable.
- Design questions triggered by those differences.

Do not infer assembly-level combustion from isolated constituent tests. A material inventory is an evidence organizer, not a digital twin predicting whole-cabin behavior.

**Done when:** changing a supported material/geometry/flow input changes eligibility and explains why; an unmatched material returns a useful evidence gap; A/B comparisons share the same data version and analysis rules.

## 11. Workstream H — Full joint coverage and proposed experiments

**Priority P2, dependent on schema and source enrichment. Estimated effort: 3–5 days.**

Extend the current oxygen/pressure proximity tool into an evidence-support assessment:

1. Apply categorical gates for material/form, gravity regime and compatible endpoint.
2. Compare continuous conditions using explicit, adjustable scales and ranges; preserve units.
3. Separate fully documented matches, partial matches with missing dimensions, analogues and no matches.
4. Report sensitivity to proximity windows. Keep the existing ranking as a comparison baseline rather than silently replacing it.
5. Show non-dominated evidence options where a single scalar ranking hides trade-offs.

Do not treat equal oxygen partial pressure as equivalent combustion conditions. Keep total pressure, oxygen fraction, diluent and flow separately visible.

For the experiment planner, let the user define a target region, material, candidate test conditions and a test budget. A transparent first algorithm can choose candidates that cover previously unsupported target combinations under explicit distance and feasibility rules. Show the incremental coverage gained by each proposed test, any assumed costs and unresolved feasibility.

Do not call this expected information gain or optimal scientific design without a validated probabilistic model. It is a coverage-based proposal. Unknown pressure is missing evidence, not a match or proof of a never-performed experiment.

**Done when:** small synthetic cases verify selection and accounting; widening a coverage window behaves predictably; a suggested experiment names the question it addresses and the evidence it lacks; no proposed result is shown as observed data.

## 12. Workstream I — Expand data where it answers a question

**Priority P2/P3, in small reviewed increments. Effort varies with source accessibility.**

Order source acquisition by usable evidence gained, not total rows:

| Candidate | Intended value | Admission gate |
|---|---|---|
| Published context for existing solid tests | Recover pressure, material geometry or session context | Exact applicability to identified experiments is demonstrated |
| Partial-gravity tables behind currently cited NASA reports | Support gravity-specific comparisons | Run-level values, apparatus, duration, uncertainty and source locators exist; quotation alone is insufficient |
| SAME/SAME-R follow-on analysis (first ingestion already delivered) | Extend detection-related evidence through flight/material/flow-specific comparisons and reviewed fresh/aged pairs | Review instrument and size-metric semantics, missing-zero treatment and observation links before extending F8 |
| FLEX suppressant-related observations | Compare outcomes within compatible fuel/condition groups | Endpoint meaning and diluent fractions are verified; disrupted/terminated runs remain distinct |
| Digitized published curves | Recover otherwise inaccessible measurements | Raw figure, axis calibration, extraction method and digitization uncertainty retained; separately filterable |
| NASA videos with quantitative metadata | Potential flame-front or droplet measurements | Known frame timing and spatial calibration, annotated reference frames and quantified error |

Do not add plots or video-derived measurements if calibration is unavailable. Photographs remain illustrative. Proposed or upcoming missions remain future evidence, never measurements.

Each ingestion batch needs source terms, immutable snapshots, provenance, schema checks, independent spot checks, deduplication and an impact report showing changed findings/coverage. Do not automatically scrape the entire literature or silently update a judged release.

## 13. Workstream J — Evaluate answers, not just software

**Priority P1 for the first baseline; P2 for a larger reviewed benchmark. Estimated effort: 2–4 days plus review.**

Create a fixed question set before tuning answers. Start with 30 development questions and 30 held-out evaluation questions; expand toward 100 if review capacity exists. These are proposed sizes, not completed results.

Cover extraction, unit conversion, source selection, paired comparison, missing data, conflicting sources, partial-gravity transfer, scenario applicability, misleading premises and appropriate refusal. Add cases for fresh/aged observation counts, count-mean versus mass-based particle diameters, micrometre/nanometre conversions, unsupported detector-placement claims and source-level unknown licence status. Reference answers need source cells/pages, acceptable variants and required limitations. Review high-impact cases independently; retain disagreement and adjudication.

Compare:

1. Simple source/keyword retrieval baseline.
2. Current EMBER.
3. EMBER with the comparison and reconciliation engine.

Keep the corpus, questions and evaluation conditions identical. Separate deterministic engine results, recorded AI playback and fresh live AI generation. Record model/configuration, source hash, date, latency and failures; run repeated live trials on a subset to expose variability.

Report per-category factual correctness, citation entailment, numerical accuracy, appropriate abstention, unsupported-claim rate, coverage and latency. Include the denominator and uncertainty where meaningful. Exact quote matching is not proof that a claim follows from the quote.

Add a small usability study: ask 5–8 people to find an applicable test, explain a limitation and reproduce a comparison. Measure task completion, errors and time against the current interface or direct source workflow. This is a small usability study, not proof of scientific validity.

**Done when:** publishable results include failures, frozen reference answers and reproducible scoring rules. Any zero-tolerance gate refers to the fixed evaluated suite, not a guarantee for all possible queries.

## 14. Workstream K — Optional validated modelling

**Priority P3 research extension. Do not put on the critical path.**

A constrained prediction model can be valuable only after the data and validation support it. Choose one measured response in one coherent experiment family, not “spacecraft fire risk.”

Procedure:

1. Establish the endpoint and independent grouping structure.
2. Compare a simple mean baseline, an interpretable regression and at most one justified nonlinear candidate.
3. Split by session/campaign where available; keep preprocessing and tuning inside training folds. Test on genuinely independent experiments when available.
4. Evaluate error, interval coverage, calibration and failure by subgroup. Report uncertainty on improvements, not a winning point estimate alone.
5. Define an eligibility gate requiring known relevant conditions and empirical support. If support is absent, abstain.
6. Publish a model card, training IDs, evaluation splits and the exact model artifact.

Ship only if it offers a meaningful, reproducible improvement and appropriately calibrated uncertainty. Otherwise retain descriptive comparisons. Do not transfer droplet performance to solid cabin materials or infer lunar behavior from microgravity by an arbitrary scaling factor.

## 15. Implementation map

The following new locations are proposals; preserve existing public contracts through adapters while migrating.

| Existing location | Planned work |
|---|---|
| `src/lib/atlas/types.ts`, `build.ts`, `specs.ts`, `compact.ts` | Observation identity, quantity semantics, gravity support, lineage and lossless analysis fields |
| `src/lib/atlas/materials.ts` | Reviewed aliases, material/geometry matching and ambiguity |
| `src/lib/findings/*` | Refactor findings into reusable analysis templates without losing current regression fixtures |
| Proposed `src/lib/analysis/*` | Specs, eligibility, cohorts, comparisons, uncertainty and sensitivity |
| Proposed `src/lib/reconciliation/*` | Source crosswalks, resolution overlays and impact tracking |
| `scripts/sync-same-results.py`, `src/lib/findings/same.ts` | Portable/verifiable workbook ingestion, pair identity and exclusions, stratified F8 sensitivity |
| `src/data/psi.ts`, `scripts/sync-psi.mjs`, `scripts/sync-ntrs.ts` | Reuse DOI/licence/record-version fields; preserve distinction between NTRS and PSI-held reports in export provenance |
| `src/lib/coverage.ts` plus proposed planner module | Full-condition eligibility, proximity policies and candidate selection |
| `src/lib/scenario.ts` | Connect material, thickness and flow inputs to evidence selection |
| `server/analyze.ts`, grounding/evidence modules | Server-validated analysis specs and explanations of computed results |
| Proposed `scripts/export-analysis.ts` | Standalone reproduction bundles and checksums |
| Proposed `benchmarks/*` | Frozen questions, reference evidence, splits, runs and scoring |
| `src/pages/Data.tsx`, `Findings.tsx`, `ScenarioLab.tsx` | Functional controls added to current pages before redesign |
| `scripts/check-data.mjs`, CI | Schema migration checks, generated-data parity and export reproduction |

Use workers or lazy loading for repeated bootstrap calculations if measured performance requires it. Cache by immutable analysis identity; cap computation explicitly. No need for a graph database until a demonstrated query requires one.

## 16. Delivery sequence and release gates

| Milestone | Scope | Exit gate |
|---|---|---|
| M0 — Accurate baseline | A; minimal quantity/identity fixes from B; review SAME fresh/aged denominators | Counts agree and distinguish observations from experiments; baseline checks pass; changes are documented |
| M1 — First defensible analysis | One reviewed dataset slice from C; one template from D; sensitivity from E; export from F; reviewed F8 package as an early follow-on | A user computes and independently reproduces one comparison, including exclusions and uncertainty |
| M2 — Reusable research workbench | Remaining B; three initial templates and optional fourth smoke template; all eight findings exported; benchmark baseline | Independent reference agreement; invalid comparisons blocked; benchmark failures visible |
| M3 — Mission decisions and missing evidence | G, H; targeted enrichment from I | A/B mission evidence and proposed tests are explainable and reproducible |
| M4 — Research release | Broader review, versioned public data package, larger benchmark; optional K | Release documentation and licenses checked; deployment matches the released data and code |

Do not add all workstream estimates together as a precise calendar promise: they overlap, share foundations and depend on source review. A planning allowance for M0–M2 is approximately 8–15 focused engineering days plus scientific review; the full roadmap can take several weeks or more. Re-estimate after the first reconciled dataset.

If only 24–48 hours remain, aim for a narrow M1: accurate counts, one source-reviewed comparison, a small sensitivity report and one reproducible package. Do not rush general modelling or a broad schema migration merely to claim more features.

Keep domain logic, source review and functional UI tasks separately trackable so teammates can work independently if the team chooses. Resolve data contracts before dividing implementation.

## 17. Acceptance measures

These are proposed release targets, not current achievements or NASA judging thresholds.

| Measure | Target |
|---|---|
| Result provenance | Every displayed analytical value resolves to inputs, transformations and version |
| Missing-data behavior | Every excluded/unknown required field has a reason; no silent imputation |
| Reproducibility | Eight findings plus at least three template comparisons reproduce from exported packages; F8 preserves paired observations and distinct experiment counts |
| Source review | Every selected headline finding has documented endpoint semantics and reviewed extraction cases; unresolved cells remain labelled |
| Statistical behavior | Pairing, censoring and supported session grouping handled explicitly; undefined results stay undefined |
| Denominator correctness | Source rows, observations and independent experiments reported separately |
| Comparison validity | All fixed adversarial eligibility cases reject incompatible evidence |
| AI evaluation | Per-category held-out results, failures and source support published; no unsupported safety verdict in the fixed release suite |
| Reuse | A new person completes a reproduction task without an AI key or the application server |
| Performance | Suggested target: ordinary filtering under 250 ms and a full resampled comparison under 2 s on a declared reference laptop, measured rather than promised |

Track enrichment as useful fields recovered with evidence and analyses newly enabled. Track reconciliation as reviewed matches/disagreements, not “errors fixed.” Track coverage under a named policy, not a universal safety percentage.

## 18. What to defer

- Whole-cabin fire simulation without validated transport and combustion models.
- A universal safe/unsafe material ranking.
- A larger chatbot or knowledge graph without measured retrieval/answer improvements.
- A composite confidence score that obscures missing conditions.
- More decorative animations before analytical correctness and reuse.
- Mass ingestion without a specific question, provenance and review capacity.
- Claims that competitors lack a feature or that the roadmap guarantees an award.

## 19. The demonstration this roadmap should enable

One coherent demonstration is more convincing than a tour of unrelated features:

1. Select a mission atmosphere and a specific material/form.
2. Inspect genuinely relevant tests and identify missing context.
3. Open a comparison of an observed endpoint.
4. Inspect the NASA cells and reconciled publication evidence.
5. Tighten the quality policy and see whether the result changes.
6. Compare an alternative atmosphere without inventing a safety verdict.
7. Propose a test that fills a clearly named evidence gap.
8. Download the complete analysis and reproduce it independently.

**Recommended first build:** the baseline corrections (including SAME/SAME-R observation identity), a source-reviewed BASS-II comparison with data-quality sensitivity, and its standalone reproduction package. If BASS-II context proves insufficient for the intended comparison, use the paired Saffire-II example first rather than forcing a result. Follow with a reviewed F8 package and flight/material sensitivity; the new workbook and reports make this a concrete next extension rather than a speculative data acquisition task. This creates an end-to-end capability before extending the same machinery to the rest of the Atlas.
