# EMBER Fire Test Atlas: data card

**Version:** atlas-v1 · **Built:** 2026-11-15 · **Maintainers:** the EMBER team (NASA Space Apps 2026, Flame in Freefall)

## What it is

One record for every row of NASA's microgravity combustion test tables, in one schema, with the NASA cell behind every value. It exists so that fire-safety researchers and modellers can work with all of the tests at once without re-reading 21 differently shaped spreadsheets.

| File | Contents |
|---|---|
| `atlas.csv` | One line per record: source, fuel class, material, oxygen, pressure, flow, diluents, outcome, flags and every measured result |
| `atlas.json` | The same records with full lineage: for each value, NASA's header, the raw cell, the unit and any flags |
| `audit.json` | 37 data-quality issues found in NASA's tables, with example cells and how each is handled |
| `findings.json` | Six findings computed from the atlas, with their rows, method, confounders and limits |

## Sources

- **NASA Physical Science Informatics (PSI)**, combustion science: 22 experimental tables from 20 investigation records (PSI-10, 20, 21, 22, 23, 25, 26, 39, 47, 68, 69, 98, 99, 100, 101, 102, 106, 107, 142, 159). 2,009 rows. The SHA-256 of each NASA file is in `src/data/table-manifest.json`. First downloaded 2026-11-02; every file re-downloaded live from PSI on 2026-11-15 with identical SHA-256. PSI-142's table indexes datasets in published papers (DOI and figure), so none of its 8 rows is counted as a test. One more table, PSI-101-1, is the sheet "Reduced data sheet" of NASA's SAME and SAME-R results workbook (`PSI-101_Analyzed Data_SAME, SAME-R_Results.xlsx`, SHA-256 recorded; stored by `scripts/sync-same-results.py`): its 45 SAME flight tests are SAME's tests (SAME's own 8-row table is a test matrix), and its 109 SAME-R rows add measured particle sizes to the tests PSI-101-0 already lists, without counting them twice. 2,163 PSI rows in all.
- **NASA NTRS 20240002981**, *Preliminary Results from the Saffire VI Experiment* (Urban et al., ICES-2024-365), Tables 1 and 2: 5 samples from Saffire IV–VI. Values checked against the PDF on 2026-11-15; the PDF's SHA-256 is in `src/data/ntrs-saffire.ts`.

## Size

2,006 records: 1,875 individual tests, 103 per-day session summaries, 8 test-matrix rows and 20 non-test lines (footnotes, blank lines). By fuel: 1,230 gas, 384 solid, 370 liquid, 2 aerosol. 623 tests have a recorded outcome.

## How it was made

Code only, no manual edits and no language model: `npm run data:atlas` in the [EMBER repository](https://github.com/nathan-844/EMBER) rebuilds every file from the stored NASA tables. One extraction rule per table (`src/lib/atlas/specs.ts`) names the NASA column behind each field. Tests check every value against its NASA cell and every finding against a recount from the raw cells. CI fails if the committed files differ from a fresh rebuild. Full rules: [DATA.md](DATA.md).

## What to know before using it

- **Microgravity only.** There is no partial-gravity (Moon or Mars) test in these sources.
- **Missing is common, and stays missing.** Only 5 of 384 solid-material tests record pressure. Many tables record no outcome. Blank means NASA's table does not say; nothing is filled in.
- **Units** are converted only where NASA states the unit. Pressure is psia, oxygen is % by volume or mole, flow is cm/s.
- **Outcomes** come only from a table's own outcome column, by the rule recorded on each record.
- **Inferred materials** (BASS-II rods and films, BASS spheres) are marked `inferred`; filter on `materialBasis` to exclude them.
- **Inverse flames** record oxygen fed through the burner in `burnerO2Pct`, never in `o2Pct`.
- **Data-quality flags** mark values that look wrong in NASA's files. The raw cell is always kept; see `audit.json`.
- **Not checked against the source papers.** The audit is internal consistency only.
- **Measurement uncertainty** is not in NASA's tables and is not included.

## Not for

Predicting flammability, flame spread, extinction or fire risk, or certifying anything as safe. The atlas records what was tested and what was measured.

## Licence and credit

The code that builds the atlas is MIT licensed. The underlying data is NASA's: each PSI investigation record states its licence and DOI (stored in `src/data/psi-snapshot.json`): 23 of the 24 Combustion Science records are CC0-1.0, and PSI-10 (Flame Design) states none, so check that one before reuse. Cite a study by its PSI DOI (for example FLEX, 10.60555/mbq8-0451). Please credit NASA PSI and NTRS as the data source and EMBER for the harmonised form. EMBER is not affiliated with or endorsed by NASA.
