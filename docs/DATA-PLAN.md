# EMBER data plan: aiming for Best Use of Data

**Goal.** Make EMBER the clearest example in Space Apps 2026 of turning NASA data into results that anyone can check. Every number shown should trace back to a NASA cell in one click, and every step in between should be visible, tested and rebuildable with one command.

**The shift.** Today EMBER uses the 21 PSI tables mainly to build **condition ranges** that rank studies. The measured **outcomes** in those tables (extinction, burn time, ignition, cool flames, CO/CO₂, burn length in µg vs 1 g) are listed in the data explorer but never analysed. The plan moves EMBER from "which study covers my scenario" to "what NASA measured, what it shows, and how you can check it".

**What the competitors do** (checked on 2026-11-15): 34 Percent has about 2,055 tests, 38 NTRS reports and a burn model tested on 25 cases; its findings are hand-written prose. FlameScope works row by row but only on ACME/CFI/SPICE plus 46 hand-transcribed BASS-II rows. JARVIS has curated ranges only. **None publishes a reusable dataset, computes findings across every table, or audits NASA's own tables.** Those three things are our opening.

---

## Status (2026-11-15)

| | Workstream | Status |
|---|---|---|
| A | Fire Test Atlas | Done |
| B | Measured findings | Done |
| C | Data audit | Done: 37 issues, Data page. Not done: comparison with the source papers |
| D | Joint coverage | Done as a count of tests near a scenario (lab tile). Not done: an alternative ranking scheme and outcome colours on the gap map |
| E | Reproducibility | Done: `npm run data:all`, `npm run data:check`, CI, `docs/DATA.md` |
| F | Make it visible | Done: Findings and Data pages, lab tile, landing page, AI cites findings, demo video. Not done: re-recording the AI answers with findings in the evidence (needs a Gemini key) |
| G | Open release | Data card written (`docs/ATLAS-DATA-CARD.md`). The GitHub release and the Zenodo DOI need the repository owner |

## Phase overview

| # | Workstream | Result | Priority |
|---|---|---|---|
| A | Fire Test Atlas | One tidy test-level dataset of every PSI row plus NTRS Saffire IV–VI | Must |
| B | Measured findings | 6 findings computed from rows, each with n, method, rows and limits | Must |
| C | Data audit | A public log of issues found in NASA's tables, each with evidence | Must |
| D | Joint coverage | Real test points near any scenario, replacing min–max envelopes | Should |
| E | Reproducibility | One command from hashed raw files to the app, with every number tested | Should |
| F | Make it visible | Findings and atlas pages, a headline, video and pitch | Must |
| G | Open release | Versioned dataset with a data card and a DOI | Should |

A → B → F is the minimum winning path. C can run alongside A from day one. D and E build on A.

---

## A. EMBER Fire Test Atlas

One row per NASA test, in one schema, with lineage for every value.

**Sources.** All 21 stored tables in `src/data/tables` (2,001 source rows) plus `src/data/ntrs-saffire.ts` (Saffire IV–VI, NTRS 20240002981).

**Schema** (`src/data/atlas/atlas.json` and `atlas.csv`):

| Field | Notes |
|---|---|
| `testId` | `PSI-69-0:r12`: table id plus source row, stable |
| `investigation`, `accession` | e.g. FLEX, PSI-69 |
| `fuelClass` | solid / liquid / gas |
| `material` | Normalized name (PMMA, SIBAL, Nomex, silicone, methanol, heptane, ethylene, …) |
| `materialRaw` | Exactly as NASA wrote it |
| `geometry` | sheet / rod / film / droplet / sphere burner / jet …, with thickness and width where stated |
| `o2Pct`, `o2PctEnd` | From mole fraction or vol % (start and end where NASA gives both) |
| `pressurePsi` | Converted only when a unit is stated; `null` plus a reason otherwise |
| `flowCms`, `flowDirection` | Opposed / concurrent / quiescent |
| `diluent` | N₂ / CO₂ / He with fractions |
| `gravity` | µg, or 1 g for ground comparisons (Saffire-II 1-g columns) |
| `outcome` | `burned` / `extinguished` / `no-ignition` / `disrupted` / `completed` / `not-recorded`, mapped by documented rules from each table's own column |
| `measures{}` | Burn time, extinction diameter, burn rate, spread rate, burn length, ΔCO, ΔCO₂, Tad, weight-loss rate, cool flame (yes/no) |
| `lineage{}` | For each field: table, SHA-256, source row, column, raw text, parser |
| `flags[]` | Approximate (`~`), parsed range, unit inferred, audit issue id |

**Tasks**
1. `scripts/build-atlas.mjs`: one extractor per table, reusing `src/lib/cells.ts` parsers and the unit rules in `normalize-conditions.mjs`. Hook it into `npm run data:normalize`.
2. A material dictionary (`src/data/atlas/materials.ts`) that maps every raw string to a normalized name. BASS-II alone has about 50 spellings, e.g. `"1/4 blac rod"`, `"4 mm thick   2 cm 2ide PMMA slab"`. Every mapping is listed and tested.
3. Outcome mapping per table, written as a short rule with a NASA quote for the column's meaning (e.g. FLEX `Test end`: Extinction / Disruption / Completion; CFI-G `Self-ext or flow term`; Saffire-II µg and 1-g burn length).
4. Tests in `src/data/atlas/atlas.test.ts`:
   - row counts per table match the manifest;
   - every non-null field has lineage;
   - every raw value round-trips;
   - no unit conversion without a stated unit;
   - a hand-checked "golden rows" fixture of about 30 rows across all tables.

**Done when** the atlas rebuilds from raw files with one command and every row and value in it is covered by tests.

---

## B. Measured findings

> **Status (2026-11-15): done.** Six findings in `src/lib/findings/`, written to `src/data/findings.json` by `npm run data:findings`. Changes from the candidates below, after checking the rows:
> - **F1** measures how much of the droplet was left when the flame went out, against oxygen. Extinction is the normal end of most FLEX burns, so "the lowest oxygen that still burns" would have been misleading.
> - **F2** is measured against the challenge's exploration atmosphere (30% O₂ or more at 10.2 psi or less, EMBER's lunar preset). The "34% / 8.2 psi" figure is not used until its NTRS source has been checked.
> - **F3** leaves out the composite PMMA + Nomex sample: NASA's Note 2 says the PMMA burned completely but the Nomex did not ignite.
> - **F5** is CFI-G cool flames, and **F6** counts solids by oxygen and pressure (only 5 of 388 solid tests record pressure).

Computed from atlas rows by code, never by the model. Each finding is a small module (`src/lib/findings/*.ts`) returning:
`{ id, claim, n, rows[], method, numbers{}, confounders[], notClaimed, chart }`.
A claim's wording is generated from the computed numbers, so the text can't drift from the data.

Candidates, checked against the stored rows on 2026-11-15:

**F1 Suppressants and the lowest oxygen that still burns (FLEX, 274 runs).**
- Methanol and heptane droplets, run with no diluent, with CO₂ added, and with He added.
- Outcomes: 186 extinction, 61 disruption, 27 completion.
- Per fuel and diluent: the lowest O₂ with sustained burning vs the highest O₂ with early extinction, plus the extinction diameter.
- This is FLEX's own stated objective: how a suppressant shifts the limiting oxygen index.
- *Limit:* droplets, not cabin solids; outcomes depend on droplet size.

**F2 FLEX already burned at near-Moon atmospheres.**
- FLEX runs at 0.30 and 0.34 O₂ mole fraction and about 530–545 mmHg (≈10.3 psi).
- These are the PSI runs closest to NASA's exploration atmospheres (30%/10.2 psi; 34%/8.2 psi).
- Report n, the outcomes and the distance from each atmosphere.
- *Limit:* liquid fuel; label it analogue evidence for solids, consistent with EMBER's fuel grouping.

**F3 Earth vs orbit for the same samples (Saffire-II, PSI-99).**
- Each sample has a µg burn length next to a 1-g burn length.
- Silicone: about 0 in µg on all 4 samples, but complete or partial burning in 1 g on 3 of them.
- SIBAL burned completely in both. Nomex about 0 in both.
- So for these samples at about 22% O₂, the Earth test was the *more severe* one. That's a nuanced, honest data point in the "is Earth screening conservative?" debate.
- *Limit:* n = 8 samples, one flow speed, one O₂ level.

**F4 What a fire does to cabin air (BASS-II, PSI-25: 120 rows with CO and CO₂ before and after).**
- ΔCO and ΔCO₂ per burn, grouped by normalized material (PMMA sheet / rod / film, SIBAL, Nomex, candle), normalized by burn duration where stated.
- Combine with Saffire VI's statement that the smoke and gases, not the heat, are the hazard.
- *Limit:* glovebox volume, not a cabin; the sensors are uncalibrated (state which).

**F5 Cool flames are rare and confined to a narrow window (CFI-G, PSI-159).**
- 7 of 179 runs report a cool flame.
- Show their O₂, pressure and fuel next to all 179 runs.
- Also: self-extinguished (SE) vs flow terminated (FT), and how the burn ended.

**F6 The highest-oxygen solid burns that exist.**
- From the atlas: every solid test, sorted by O₂.
- PSI tops out around 22.2%; the NTRS Saffire VI points go to 31%.
- Show the gap to 34% as measured data, not prose.

Optional if time allows: SAME smoke weight-loss rate by material (PSI-102), and the SPICE smoke point vs fuel flow.

**Tests.** Each finding has a snapshot test of its numbers, plus a check that recomputing from the row list gives the same result. The verify report records them.

---

## C. Data audit of NASA's tables

A public, evidence-backed list of problems found in the PSI tables, each with its cell reference and how EMBER handles it. Issues found so far:

| Table | Issue | EMBER handling |
|---|---|---|
| PSI-99 (Saffire-II) | Thickness written `037 mm` on 4 rows (missing decimal point; the paper gives 0.37 mm) | Corrected with a flag, quoting the paper |
| PSI-99 | Headers `?-g Burn Length`, `?-g Spread Length` (µ lost in encoding); `Samle Thickness` | Read as µg, with a flag |
| PSI-99 | Material blank on rows 7, 10; non-test rows ("Pre-test flow visulation data…") | Material carried down only where the paper confirms it; non-test rows excluded and counted |
| PSI-69 (FLEX) | Headers `O initial…`, `CO initial…` (subscripts lost, so CO₂ reads as CO) | Interpreted as O₂ / CO₂ using the FLEX paper |
| PSI-69 | A run with ambient pressure `0` | Excluded from pressure, kept for other fields, flagged |
| PSI-25 (BASS-II) | About 50 spellings for a few materials; typos (`blac`, `2ide`); `Air display` is an uncalibrated reading | Normalized via the dictionary; airflow from the display not used |

**Tasks.** Run a systematic pass on all 21 tables:
- unit-less numerics;
- values outside physical limits;
- duplicate rows;
- columns that conflict within a row (e.g. final O₂ > initial during a sealed burn);
- tables that disagree with their NTRS paper (spot-check about 5 papers).

Output: `src/data/atlas/audit.json`, an Audit page and a section in the brief. Phrase it as a contribution back to NASA, and avoid wording that blames anyone.

---

## D. Joint coverage, replacing envelopes

The current ranges are marginal min–max per condition. With the atlas we can measure **real joint coverage**:
- For a scenario: count atlas tests within a scaled distance in (O₂, pressure, flow), split by fuel class and outcome, and give the nearest real test for each class.
- The ranking can then use "measured tests nearby" alongside the current points, recorded as an alternative scheme in the robustness check so the current scoring stays as the baseline.
- The gap map plots atlas points coloured by outcome, not just conditions.

---

## E. Reproducibility

- `npm run data:all`: hashes the raw tables, then builds the atlas, the audit, the findings and the verify report. CI fails if any committed output differs from a fresh build.
- The credibility page links each finding to its test and its rows.
- A short `docs/DATA.md`: schema, outcome rules, the material dictionary, audit rules and known limits.

---

## F. Make it visible

> **Status (2026-11-15): item 1 done.** A Findings page (`#findings`, `src/pages/Findings.tsx`) shows each finding with:
> - its generated claim and what it does not claim;
> - a chart drawn from its own table (dumbbell, segmented bars, paired table, bar chart, matrix, oxygen strip), with tooltips on hover and focus and a table view;
> - the method, confounders and excluded rows;
> - every cited NASA row with its raw cells, loaded on demand.
>
> The page links to the atlas CSV, the landing page links to each finding (`#findings/F3`), and the nav has a Findings tab. Items 2–7 remain.

The data has to show on screen in the first 30 seconds, or local judges won't nominate us.

1. **Findings page:** six cards, each with a one-line measured claim, a small chart, n, a "Show the rows" link, and the method and limits in a drawer.
2. **Atlas page:** a filterable table of every test, colour-coded by outcome, with a CSV download and a lineage popover on each cell.
3. **Audit page:** "We checked NASA's tables: N issues found, each documented."
4. **Scenario lab:** gains "Measured near your scenario" (from D) and links to the relevant findings.
5. **Landing headline:** lead with a data claim. Options:
   - "2,001 NASA test rows. Every number traced."
   - The F2 result: "NASA has already burned fuel near Moon-base air. Here's what happened."

   Pick after B is computed.
6. **Demo video and pitch:** Landing → Findings → Show the rows → Audit → Brief export. One sentence per screen.
7. The AI analysis can cite findings by id, and the checker verifies their numbers like any other source.

---

## G. Open release

- Tag `atlas-v1`; attach `atlas.csv`, `atlas.json`, `audit.json`, the data card and a SHA-256 manifest.
- Get a Zenodo DOI from the GitHub release, so judges see a citable dataset.
- Licence: code MIT; NASA data under each record's terms (PSI tables are CC0 where stated).

---

## Order of work

1. **A1–A3 with C started in parallel:** extractors, material dictionary, outcome rules, audit entries recorded as they're found.
2. **A4 tests, then B:** F3 and F2 first (strongest story), then F1, F4, F6, F5.
3. **F1–F3 views:** Findings, Atlas and Audit pages.
4. **D, E, G**, then F4–F7 (the scenario lab, the headline, the video and the AI cite-by-id).

If time is short, stop after step 3: we'd have an atlas, measured findings and an audit, which no other team has.

## Risks

- **Overclaiming from small samples.** Every finding shows n and what it doesn't establish; wording is generated from numbers; never call anything a prediction or safety rating.
- **Misreading a column's meaning** (e.g. FLEX "Disruption"). Each outcome rule cites the NASA paper's definition; golden-row tests.
- **Correcting NASA's data wrongly.** Never overwrite a raw value; corrections live in flags with the evidence, and the raw value is always shown.
- **Slower app.** The atlas is about 2,000 rows (small); load the Atlas and Findings pages lazily as the explorer already does.
- **Time.** The order above keeps a winning result after step 3.
