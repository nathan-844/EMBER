# M2 — Reusable research workbench

Implemented locally on the M1 baseline (`195afd4`), November 15, 2026. Entry point: `#research` (Workbench). BASS-II remains at `#compare`; Findings links to the all-eight reproduction package.

## Delivered scope

| M2 release gate | Implementation and evidence |
|---|---|
| Three initial templates | Existing BASS-II CO comparison plus paired Saffire-II extent and conditional FLEX extinction-diameter comparisons |
| Optional fourth template | SAME/SAME-R fresh/aged count-mean diameter ratios, with flight/material filters and whole-pair resampling |
| Atlas v2 semantics | Additive `atlas-research-v2` view in each package: quantity kind, source label identity, reviewed run identity, paired endpoint relationships, explicit unknowns and source lineage |
| All eight findings exported | Browser ZIP includes raw source-cell tables, source metadata, executable engine and a runner that rebuilds and verifies all eight findings, plus the selected comparison |
| Independent reference agreement | Saffire pairs checked against a hand-transcribed ordinal reference; FLEX reconstructed directly from raw source columns; smoke ratios reconstructed directly from workbook row labels/cells |
| Invalid comparisons blocked | Reversed/nonfinite windows, overlapping FLEX cohorts, missing required context, empty selections and duplicate identities are blocked or excluded with reasons |
| Benchmark baseline and visible failures | 60 structured deterministic cases, split 30 development/30 evaluation, with expected/actual values, source references, categories, latency and downloadable results |

This is the M2 engineering baseline, not completion of the broader live-AI/usability/scientific-review program in workstream J. The UI states that live AI, recorded AI, keyword-retrieval comparisons and citation entailment have not been assessed. The evaluation split is versioned but not a blind external holdout. No scientific confidence percentage is assigned.

## Template definitions

**Saffire-II:** pair NASA's ground and orbit extent columns within each sample row. Categories are no spread, partial and complete; no physical distance is inferred from the ordinal categories. Exclude the composite sample because the columns refer to different component endpoints. Default: eight pairs, ground further in five, three ties, orbit further in zero. The estimate is the ground-further fraction among non-tied pairs; an exact two-sided sign test gives 0.0625. Ground/orbit apparatus equivalence is unknown. Material and quality filters operate on whole pairs. Duplicate source/sample identities are blocked.

**FLEX:** restrict to visible-flame extinction observations with valid positive initial diameter and compatible extinction diameter. Match selected fuel and diluent class; filter pressure and initial diameter; compare disjoint starting-oxygen cohorts. The outcome is extinction/initial diameter, and the effect is median(A) minus median(B). Defaults: methanol, nitrogen only, 12–16 psia, 0–10 mm initial diameter, 12–16% versus 20–22% O2; 18 versus eight observations, difference 0.22279227406014374, exploratory 95% interval 0.058997245455092884–0.36249212846347606. Completed/disrupted runs are outside this conditional endpoint: this is not extinction probability. Missing diluent composition cannot silently become nitrogen-only. Per-row conditions expose remaining differences.

**Smoke ageing:** retain whole fresh/aged pairs identified by flight, material and run labels, with matching heater/flow context. Preserve the distinction between count-mean and mass-based size. Compute the median of within-pair aged/fresh ratios, not a ratio of group medians. Default: 48 pairs (96 observations), 46 increases; eight SAME and 40 SAME-R pairs. Median ratio 1.4992220710944886; exploratory 95% interval 1.2826467472188874–1.642801395201421. Filter flight/material without splitting pairs. The ledger also lists fresh-only runs with no aged observation, as well as invalid/ambiguous pairs. It does not infer detector placement or cabin-fire growth rates.

FLEX/smoke intervals use 2,000 seeded percentile bootstrap replicates (seed 20261115). These median statistics have no undefined replicates once eligible groups are nonempty. Degenerate comparisons retain descriptive results without an interval. Observation/pair independence is an assumption; session identities remain unreviewed. Calibration and transfer uncertainty are not modeled. The quality sensitivity table recomputes results after excluding questionable values; informational conversion flags alone do not invalidate a measurement.

## Additive Atlas migration

`src/lib/atlas/research.ts` preserves original Atlas v1 measurements and adds a research view rather than silently changing existing findings. It retains scalar/range/list/trajectory/bound/unknown distinctions through JSON serialization. Bound thresholds retain their source-unit basis; they are not substituted into calculations. Reported measurement uncertainty and numeric gravity remain null when unknown.

Unique source test/sample labels are separated from snapshot row positions. Duplicate labels are not advertised as stable keys. SAME run/aged/supplement relations use existing reviewed experiment links. Saffire rows explicitly link their paired ground/orbit endpoints. Campaign is the investigation; sessions are unknown. Material dimensions, inference basis, conditions, endpoints, raw values and extraction-rule version remain attached. The package source registry supplies DOI/license/record versions, hashes and workbook sheet/cached-formula metadata. This does not claim that every physical experiment's identity or apparatus has been independently reviewed.

All eight committed findings reproduce unchanged. Their original definitions and rounding remain the baseline; the stricter M1 BASS policy remains a distinct user analysis. The v1 normalizer uses ten significant figures. Independent full-precision workbook checks allow 1e-8 absolute ratio tolerance for this rounding; package recomputation uses exact equality, not that tolerance.

## Reproduction and benchmark commands

Download a comparison or all eight findings, extract the ZIP, then run:

```sh
node reproduce.mjs
```

Node.js 22+ is the only requirement. No npm install, app server, internet or AI key. The runner verifies payload hashes, rebuilds the Atlas from stored raw table cells and bundled NTRS transcription, verifies the research-v2 view and compares all findings plus the optional comparison exactly. It writes `reproduced-results.json`. Source workbook/PDF bytes are not bundled: calculation/normalization reproduction is supported, not independent PDF extraction or formula recalculation. Unknown source licenses remain unknown. Legacy finding exclusions retain their existing aggregate reasons; the included engine/raw cells reconstruct the selection.

From the repository:

```sh
npm run benchmark
npm run benchmark -- research/m2/benchmark-results.json
npm test
npm run build
```

The benchmark records snapshot/hash identity and run timestamp, with a null model because no model generates these results. References include raw cell probes, hand-calculated synthetic statistics, source metadata, frozen baseline denominators and adversarial eligibility cases. Passing these cases does not establish natural-language answer quality or citation entailment.

## Validation

- Full regression suite: 549 tests across 30 files pass, including 23 new M2 tests.
- All 60 benchmark cases pass; expected/actual values and failures are visible rather than filtered out.
- Isolated Node execution reproduces all-eight, Saffire, FLEX and smoke packages. Existing M1 package tests continue to pass.
- Production TypeScript/Vite/API build passes. Existing large-chunk warnings remain; workbench and export engine load lazily.
- Browser checks: all templates load; overlapping FLEX oxygen cohorts visibly block the comparison/export; a SAME-only shared link reloads as eight pairs/16 observations; all-eight browser download passes Python standard-library ZIP/CRC validation and reproduces exactly with Node.

## Remaining research limits

Independent domain review, session/campaign clustering, full source-publication reconciliation outside M1's BASS slice, original workbook/PDF redistribution and extraction verification, live/recorded/retrieval AI comparisons with adjudicated answers, a genuinely held-out evaluation, and the planned usability study remain subsequent research/release work. No award outcome, material safety verdict or deployment is implied by this implementation.
