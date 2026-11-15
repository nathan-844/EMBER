# EMBER in depth

The [README](../README.md) gives the short version. This page explains how each part of EMBER
works, where its numbers come from, and what it deliberately leaves out.

- [Scenario lab](#scenario-lab)
- [How the ranking works](#how-the-ranking-works)
- [Ask EMBER and the grounding check](#ask-ember-and-the-grounding-check)
- [Special cases: BRE, inverse flames and partial gravity (inside *Ranked Evidence*)](#special-cases-bre-inverse-flames-and-partial-gravity-inside-ranked-evidence)
- [Gap map](#gap-map)
- [Findings, limitations and robustness](#findings-limitations-and-robustness)
- [Data explorer and CSV for modelers (inside *Nasa Run Tables*)](#data-explorer-and-csv-for-modelers-inside-nasa-run-tables)
- [What the research informs](#what-the-research-informs)
- [Credibility page](#credibility-page)
- [Where the data comes from](#where-the-data-comes-from)
- [All scripts](#all-scripts)
- [Demo video and screenshots](#demo-video-and-screenshots)

## Scenario lab

Pick a preset environment (ISS, lunar habitat, NASA's 8.2 psia / 34% O₂ exploration atmosphere,
the Artemis surface habitat at 10.2 psia / 26.5% O₂, pressurized rover, Mars habitat, spacesuit) or set
oxygen, pressure, gravity, airflow and fuel yourself. The two exploration presets link the NASA
document that states their values (NTRS 20150021491 and 20220000245); their AI answers are not
recorded yet, so they need a live key. The safety question (prevention, detection or
suppression) must be chosen; any other input can be left *unspecified*.

- **Quick overview** - the top match for your scenario, how many of your conditions it covers, and
  which it does not (gravity first). It never claims coverage from a single matching condition.
- **Your conditions** - calculates the O₂ partial pressure (psia) from your oxygen and pressure, and what your
  gravity setting means for the evidence.
- **Parameter coverage** - where condition ranges exist against your scenario.
- **Exports** - a Markdown evidence brief, and a CSV of each condition range with its NASA table,
  column and row count. A scenario can also be saved as a comparison baseline.

## How the ranking works

- 25 points for addressing the safety question (10 for adjacent research).
- Up to 15 points per condition (75 max): 15 inside a range measured in a NASA run table, 10 inside a
  curated estimate, and two thirds of that just outside a range. A near miss on measured data is worth
  as much as a match inside an estimate.
- Unknown ranges earn nothing. Equal scores list NASA-measured data first.
- With a fuel type set, fuel groups the list rather than just adding points: every study of that fuel
  is listed first and other fuels follow as labelled analogue evidence, because a droplet or gas-flame
  study at the right oxygen is not evidence about how solid cabin materials burn. Ranks and ties count
  within each group.
- Every score can be expanded to see why.

Oxygen, pressure and airflow ranges for 14 profiles are read from 14 of the 21 stored NASA PSI
experimental tables (1,527 source rows used). The few remaining hand-written ranges are labelled
*curated* everywhere they appear.

## Ask EMBER and the grounding check

Type a question about your scenario, pick a suggested one, or ask for an analysis of the whole
scenario. The question is treated as a question, never as instructions; numbers typed only in a
question are not accepted (set them in the scenario instead).

The AI runs on the server (`server/analyze.ts`); the key never reaches the browser. For each
request the server:

1. rebuilds the ranking and an evidence package from the scenario alone (browser-sent evidence is
   ignored): NASA PSI objectives and publications, run-table ranges, the 3 NASA run-table rows nearest
   the scenario for each top investigation (`server/rows.ts`), and EMBER's limitations;
2. asks Gemini (`gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3.8-flash`, 45 s each,
   overridable with `GEMINI_MODEL`; busy, rate-limited or retired models fall through) for JSON claims
   of six kinds: Reported finding, Measured data, Comparison, Research gap, Equipment implication,
   Interpretation;
3. checks every claim (`src/lib/grounding.ts`):
   - each excerpt must appear word for word in the source it cites;
   - every number in the claim and its implication must appear in those sources, the scenario or the
     Earth reference values (0 g, 1 g, 21% O₂, 14.7 psia);
   - a Comparison must cite two investigations, and Measured data must quote a run-table row;
   - findings, measured data, comparisons and equipment implications must quote NASA text, not only
     EMBER's own summaries;
   - any claim or summary stating a safety conclusion (will not burn or ignite, safe, fire-safe,
     non-flammable, or no detection, suppression or ventilation needed) is rejected;
4. if anything failed, sends the checker's findings back once and keeps the better answer.

Rejected claims are shown with the reason, and a receipt counts NASA versus EMBER excerpts. The check
covers sources, numbers and wording; it does not prove a claim follows from its excerpt.

Live answers use Gemini 3's low thinking level (about 10-30 s; `GEMINI_THINKING` changes it). The
public site limits each visitor to 6 live answers per 10 minutes.

### Recorded answers

`npm run record:demo` records answers for the unedited presets through the same pipeline into
`src/data/recorded-analyses.json`: the whole-scenario analysis for every preset and safety question,
and with `-- --asks` every suggested question too (`--missing` records only what is not stored yet).
Answers whose summary fails the check are not stored. Without a key (or with `EMBER_AI_OFF=1`, or on a
static host) the app replays these, labelled **Recorded**, and hides suggestions that have none.
Edited scenarios need a live key.

`npm run recheck:recorded` re-checks every recorded answer against today's evidence and checker
rules. Run it after any change to data, ranking or checker rules: claims that no longer pass are
marked rejected with the reason, and answers whose summary fails or that discuss a ranking that has
changed are removed so they can be re-recorded.

## Special cases: BRE, inverse flames and partial gravity (inside *Ranked Evidence*)

- **BRE as a solid emulator** - NASA built BRE to emulate burning solids, and it is the only PSI data
  at NASA's candidate exploration atmospheres (its PSI-20 objectives name 10.2 psia at 26.5% O₂ and
  8.2 psia at 34%). For a solid-fuel scenario it earns two thirds of the fuel points and is listed with
  the solid studies, labelled as an emulator, so it leads the Moon-habitat and rover cases.
- **Inverse-flame burner oxygen** - CFI-G (PSI-159) and Flame Design (PSI-10) fed up to 85% O₂
  through the burner. That is the burner stream, not the surrounding atmosphere, so it appears in the
  profile caveats, limitations and gap map but is never ranked on.
- **Partial-gravity analogue** - for partial-gravity scenarios EMBER names ACME's E-FIELD Flames
  (PSI-22) as the closest analogue already in PSI, quoting the challenge text: its electric field
  mimics partial gravity on gas-jet flames, not materials. It is not a measurement at your gravity.

## Gap map

- Every NASA run-table row drawn as oxygen against pressure from the same row, shaped and coloured by
  fuel type, with your scenario marked and the distance to the nearest solid-material run stated.
  Tables without a pressure column use the curated cabin pressure (hollow marks); rows that list
  several levels without pairing them are left out and counted.

## Findings, limitations and robustness

- **Key finding by fuel type** - for a Moon-base atmosphere (30% O₂) the app states that no
  solid-material test in the PSI data goes above 22.2% oxygen; only droplet and gas-flame studies
  reach 30%. It then adds what NASA has published outside PSI: Saffire V and VI burned cotton, SIBAL
  cloth and PMMA in orbit at 26.2-31.0% oxygen and 54.1-70.7 kPa (NASA NTRS 20240002981, Table 1).
  These runs are drawn on the gap map as open diamonds and named in the finding, but they are not PSI
  run tables and are never scored.
- **Ventilation in elevated oxygen** - NASA's BRE record reports flames that kept burning with no
  airflow in elevated-oxygen atmospheres but went out in 21% O₂. EMBER raises this for any scenario
  above 21.5% O₂ (NASA calls the result preliminary).
- **Limitations** - scenario-specific statements of what the evidence cannot establish (partial
  gravity, oxygen outside tested ranges, joint-condition coverage, flow direction, …).
- **Robustness** - each scenario is re-ranked under small input changes, single-input removals and
  four alternative point schemes, and the app reports whether the top match holds.
- **Rank ranges** - every ranked row shows its best and worst rank when each of the seven point
  weights moves up or down 20% (all 128 combinations), e.g. "Rank 2–6 if weights move ±20%".
- **Partial-gravity results** - PSI holds no lunar or Mars gravity runs, so a tile quotes what NASA
  reports on NTRS have found (Urban et al. 2025, Ruff 2021, Zayac et al. 2024, Ferkul et al. 2025 and
  2026): some materials burn at lower oxygen in lunar gravity than Earth tests suggest, others the
  reverse; how the tests were run; and FM2 still to come. Filtered to lunar or Martian gravity, never
  scored.

## Fire Test Atlas, audit and measured findings

**Fire Test Atlas** (*Data* page). Every row of the 21 stored NASA PSI tables plus the five Saffire
IV-VI samples from NTRS 20240002981, in one schema: 2,006 records, 1,875 of them individual tests.
Each value keeps the NASA header and cell it came from. Units are converted only where NASA states
them, outcomes come only from a table's own outcome column, and a material dictionary normalises
about 100 NASA labels (inferred materials are marked, with the reason). The page filters by fuel,
investigation, outcome and text, opens any record to show NASA's cells as written, and offers the
whole atlas as CSV. Schema and rules: [DATA.md](DATA.md).

**Data audit** (*Data* page). 37 issues in 14 of the 21 tables: 20 likely errors (oxygen written
"3400%", thickness "037 mm", fuel labels that count up row by row, gas fractions that do not sum
to 1, a FLEX identifier used twice, headers that lost their subscripts or the µ), 2 missing values
and 15 quirks (footnotes inside the test table, identical rows, RAMPED flows). Each lists example
cells exactly as NASA wrote them and what EMBER does. Nothing in NASA's files is changed. The
tables were not compared with their source papers.

**Measured findings** (*Findings* page). Six findings computed by code from atlas rows:

| | Finding | Tests |
|---|---|---|
| F1 | FLEX: the lower the oxygen, the more of the droplet is left when the flame goes out | 154 |
| F2 | FLEX: none of 17 droplet flames at 30-34% O2 and about 10.4 psia went out early | 46 |
| F3 | Saffire-II: the 1-g ground test burned further than orbit in 5 of 8 samples | 8 |
| F4 | BASS-II: PMMA slab burns raised CO about 17 times more than SIBAL fabric | 118 |
| F5 | CFI-G: all 7 cool flames at n-butane, 2 bar and about 39% O2 | 179 |
| F6 | Only 2 solid tests reach the exploration atmosphere; both burned | 145 |

Each finding shows a chart, a table view, its method, what else differs between the tests, the
rows left out and why, what it does not claim, and every cited NASA row. The sentence is generated
from the computed numbers. Tests check that every number in a claim is one of the finding's
numbers, that the cited rows alone reproduce them, and that each headline number matches a recount
from NASA's raw cells. The AI may cite a finding (`finding:F2`); the grounding check verifies the
quote and numbers like any other source.

**Tests near your scenario** (scenario lab tile). Counts individual tests within 5 points of oxygen
and 2.5 psi of the scenario, per fuel type, with how they ended and the closest test. Tests whose
table records no pressure are listed separately as oxygen-only matches. The window is a stated
choice, not a physical threshold.

## Data explorer and CSV for modelers (inside *Nasa Run Tables*)

For each ranked investigation: which ranked conditions and settings varied between runs, which
results were recorded (burn length, spread rate, extinction diameter, weight-loss rate…), what was
held fixed in every run, and the rows themselves. Column roles are judged from NASA's headers.

The tidy CSV export gives every filled cell with:

- its NASA table, SHA-256 and source row;
- the value and unit as NASA wrote them, and the parsed numbers;
- a harmonised value in one unit per quantity (psia, m/s, vol %, s, mm, K, mg/s);
- for ranked conditions, the value in EMBER's unit;
- a flags column that marks values for review without changing or dropping them: outliers beyond
  3×IQR of their column, values outside physical limits, and BASS-II's uncalibrated fan and
  air-display readings.

**Models built on the flight data** - PSI also holds five NASA-funded ground studies that model or
re-analyse flight data (SPICE, BASS, SAME, FLEX and cool-flame data: PSI-60, 62, 115, 117 and 142).
The explorer lists them under the investigation they build on.

## What the research informs

- **Next-generation equipment** - links investigations to detection, suppression, ventilation and
  material or atmosphere decisions (e.g. BASS-II's models for detection and suppression design,
  BASS's ISS-type inert extinguishing agent, FLEX's CO₂/He/SF₆ suppressants, SAME smoke particle
  sizes, BRE burning in NASA's candidate exploration atmospheres). Each link quotes the NASA PSI record
  word for word (tested), says whether NASA states the use or it is EMBER's reading, and says what is
  not covered. Where NASA has published a result, it is quoted under the objective from an NTRS
  report (e.g. BRE flames self-extinguished below ~25% O₂; SAME smoke particles mostly 200–400 nm;
  BASS-II's negative oxygen margin of 2.4% against the 1-g test).
- **Evidence on the way** - lists SoFIE, FM2 and LUCI and flags the ones that would close a gap in
  your scenario.
- **Fire safety on Earth** - six NASA-stated ground uses of the same research (smoke detectors for
  submarines and labs; mines, aircraft and submarines; less harmful suppressants; wildfire and
  building-fire models; cone-calorimeter material testing), each quoted from the PSI record's
  Earth-benefits text. It says that no PSI combustion record covers fine water mist.

## Credibility page

A self-assessment structured on the eight NASA-STD-7009B factors, backed by a recorded test run
(`npm run verify:report`) and a SHA-256 fingerprint of the curated data. It is not a formal NASA
credibility assessment.

A **verification scoreboard** lists every check with its count and total: tests, PSI quotes found word
for word, NTRS quotes found in their PDFs, PSI record links, recorded AI claims whose verdict
reproduces, run-table hashes and the hand-checked Saffire values. It says how each is run (re-run on
every report, recorded by a sync run, or by hand). The AI answer-accuracy benchmark is listed as not
run, because it needs a live key.

## Where the data comes from

All 20 profiles in `src/data/investigations.ts` are linked to their NASA Physical Science
Informatics (PSI) investigation records (BASS-II → PSI-25, Saffire-I → PSI-98, FLEX → PSI-69, …).
`npm run sync:psi` fetches the Combustion Science records from the PSI repository search and stores
them in `src/data/psi-snapshot.json` (accession, title, dates, hardware, objectives, publications)
with the date and a SHA-256 of the response. Tests check that every link resolves to a Combustion
Science record with a matching acronym.

`npm run sync:tables` stores each investigation's experimental tables in `src/data/tables`, and
`npm run data:normalize` converts only columns whose unit is stated (vol %, mole fraction, atm, bar,
mmHg, cm/s):

- uncalibrated instrument readings (BASS-II "Air display") and free text are not used;
- inverse-flame burner oxidizer streams are shown separately but not used for ranking;
- values outside physical limits are dropped and counted;
- ranges are min-max envelopes per condition, not joint test points;
- gravity and fuel type stay curated.

The current tables were imported on 2026-11-14 from a hash-checked download made on 2026-11-02,
because PSI's per-investigation API returned HTTP 500 that day.

The Saffire IV-VI test conditions and results in `src/data/ntrs-saffire.ts` are copied from Tables 1
and 2 of NASA's paper
[Preliminary Results from the Saffire VI Experiment](https://ntrs.nasa.gov/citations/20240002981)
(Urban et al., ICES-2024-365, NTRS 20240002981). Pressures are published in kPa and converted to psia
by EMBER only for plotting. Every stored value was checked against those tables on 2026-11-15; the
PDF's SHA-256 is recorded in that file.

Published results quoted from 14 other NTRS reports live in `src/data/ntrs-evidence.ts`.
`npm run sync:ntrs` downloads each PDF, extracts its text with pdftotext, finds every quote in it and
records the PDF's SHA-256, the page and a hash of the quote in `src/data/ntrs-manifest.json`; a test
fails if a quote is edited without running it again.

## All scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the test suite |
| `npm run build` | Type-check and build for production |
| `npm run sync:psi` | Refresh the NASA PSI record snapshot (needs access to psi.nasa.gov) |
| `npm run sync:tables` | Download the PSI experimental tables (`-- --from DIR` imports an earlier download, hash-checked) |
| `npm run data:normalize` | Rebuild condition ranges from the stored tables |
| `npm run data:atlas` | Rebuild the Fire Test Atlas, the audit and the measured findings |
| `npm run data:all` | Rebuild all derived data, the API bundles and the verify report |
| `npm run data:check` | Rebuild the derived data and fail if a committed file differs (run by CI) |
| `npm run record:demo` | Record live Gemini answers for the presets (needs a key; `-- --asks --missing` records only the missing suggested questions) |
| `npm run sync:ntrs` | Check every NTRS quote against its PDF and rewrite the manifest (needs pdftotext and access to ntrs.nasa.gov) |
| `npm run recheck:recorded` | Re-check every recorded answer against today's evidence and checker rules |
| `npm run video:record` | Record the 30-second demo video and screenshots |
| `npm run verify:report` | Run tests and record `src/data/verify-report.json` for the credibility page |

## Demo video and screenshots

```bash
npm run build
npm run preview:demo
npm run video:record        # media/ember-demo-30s.mp4 (+ .srt) and media/shot-*.png
```

Needs Playwright with Chromium and ffmpeg with libass.
