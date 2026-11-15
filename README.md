# EMBER - Fire Safety Research

EMBER is a research prototype for the 2026 NASA Space Apps challenge
**Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data**.

**Live demo: https://ember-fire-safety.vercel.app** (presets replay recorded AI answers instantly;
edit any value for a live, rate-limited Gemini analysis).

It ranks NASA microgravity combustion investigations (BASS, Saffire, FLEX, ACME, SAME, …)
against a crew-environment scenario and is explicit about what the evidence can and
cannot establish.

## Features

- **Markdown evidence-brief export** and a **CSV data export** (each
  condition range with its NASA table, column and row count) for modelling.
- **Scenario lab** - pick a preset environment (ISS, lunar habitat, pressurized rover, Mars habitat,
  spacesuit) or set oxygen, pressure, gravity, airflow and fuel yourself. The nature of the question
  **must** be specified (prevention, detection or suppression). Any input can be
  left *unspecified*.
- **Quick Overview** - presents a key insight as to which of NASA's test best cover the scenario you
  set and what it leaves out. Your condition as well as what can not be established (flow direction etc.)
  are also provided.
- **Ask EMBER** - type a question about your scenario, or pick a suggested one, and the answer goes
  through the same evidence package and the same check. The question is treated as a question, never as
  instructions; numbers typed only in a question are not accepted (set them in the scenario instead).
  Suggested questions on the presets replay recorded answers instantly.
- **Grounded AI analysis (optional)** - a *Google Gemini* analysis of the whole scenario, on request.
  EMBER treats the model as an untrusted author: a claim is kept only if every
  excerpt appears word for word in the source it cites and every number appears in those sources
  or your scenario. Findings, measured data, comparisons and equipment implications must quote NASA
  text, not only EMBER's summaries, and any claim stating a safety conclusion (that something will
  not burn, is safe, or needs no detection, suppression or ventilation) is rejected however good its
  quotes. This checks sources and wording, not reasoning.
- **Ranked Evidence** - 25 points for addressing the safety question (10 for adjacent
  research) plus up to 15 points per condition (75 max): 15 inside a range measured in a NASA
  table, 10 inside a curated estimate, two thirds of that just
  outside a range, so a near miss on measured data is worth as much as a match inside an
  estimate; equal scores list NASA-measured data first. Unknown ranges earn
  nothing. With a fuel type set, fuel is a grouping rather than just points: every study of that
  fuel is listed first and other fuels follow as labelled analogue evidence, because a droplet or
  gas-flame study at the right oxygen is not evidence about how solid cabin materials burn. Ranks
  and ties count within each group. Every score can be expanded to see why.
- **BRE as a solid emulator** - NASA built BRE to emulate burning solids, and it is the only PSI
  data at NASA's candidate exploration atmospheres (its PSI-20 objectives name 10.2 psia at 26.5% O₂
  and 8.2 psia at 34%). For a solid-fuel scenario it earns two thirds of the fuel points and is listed
  with the solid studies, labelled as an emulator, so it leads the Moon-habitat and rover cases.
- **Inverse flames and partial gravity** - CFI-G (PSI-159) and Flame Design (PSI-10) fed up to 85%
  O₂ through the burner. That is the burner stream, not the surrounding atmosphere, so it is shown in
  the profile caveats, limitations and gap map but never ranked on. For partial-gravity scenarios
  EMBER names ACME's E-FIELD Flames (PSI-22) as the closest analogue already in PSI, quoting the
  challenge: its electric field mimics partial gravity on gas-jet flames, not materials.
- **Gap map of joint test conditions** - every NASA run-table row drawn as oxygen against pressure
  from the same row, shaped and coloured by fuel type, with your scenario marked and the distance
  to the nearest solid-material run stated. Tables without a pressure column use the curated cabin
  pressure (hollow marks); rows that list several levels without pairing them are left out and
  counted.
- **Limitations** - scenario-specific statements of what the evidence cannot establish
  (partial gravity, oxygen outside tested ranges, joint-condition coverage, …).
- **Key finding by fuel type** - for a Moon-base atmosphere (30% O₂) the app states that no
  solid-material test in the PSI data goes above 22.2% oxygen; only droplet and gas-flame studies reach
  30%. It then adds what NASA has published outside PSI: Saffire V and VI burned cotton, SIBAL cloth
  and PMMA in orbit at 26.2-31.0% oxygen and 54.1-70.7 kPa (NASA NTRS 20240002981, Table 1). These
  runs are drawn on the gap map as open diamonds and named in the finding, but they are not PSI run
  tables and are never scored in the ranking.
- **Ventilation in elevated oxygen** - NASA's BRE record reports flames that kept burning with no
  airflow in elevated-oxygen atmospheres but went out in 21% O₂; EMBER raises this for any
  scenario above 21.5% O₂ (NASA calls the result preliminary).
- **Robustness** - each scenario is re-ranked under small input changes, single-input
  removals and four alternative point schemes, and the app reports whether the top match holds.
- **Your Conditions** - calculates the O₂ psia given the oxygen and pressure parameters provided by you
  and determines how gravity affects the evidence.
- **Parameter coverage** - shows where curated condition ranges exist against your scenario.
- **Ranges from NASA run tables** - oxygen, pressure and airflow ranges for 14 profiles are read
  from 14 of the 21 stored NASA PSI experimental tables (1,527 source rows used; every stored file
  has its SHA-256). The few remaining hand-written ranges are labelled *curated* everywhere they
  appear.
- **Data explorer for modellers** - for each ranked investigation, which ranked conditions and
  settings varied between runs, which results were recorded (burn length, spread rate,
  extinction diameter, weight-loss rate…), what was held fixed in every run, and the rows
  themselves. A tidy CSV export gives every filled cell with its NASA table, SHA-256, source row,
  the value as NASA wrote it, the parsed numbers, a harmonised value in one unit per quantity
  (psia, m/s, vol %, s, mm, K, mg/s) and, for ranked conditions, the value in EMBER's unit. A flags
  column marks values for review without changing or dropping them: outliers beyond 3×IQR of their
  column, values outside physical limits and BASS-II's uncalibrated fan and air-display readings.
  Column roles are judged from NASA's headers.
- **Models built on the flight data** - PSI also holds five NASA-funded ground studies that model
  or re-analyse flight data (SPICE, BASS, SAME, FLEX and cool-flame data: PSI-60, 62, 115, 117 and
  142). The data explorer lists them under the investigation they build on.
- **What this research informs** - links investigations to next-generation detection,
  suppression, ventilation and material or atmosphere decisions (e.g. BASS-II's models for
  detection and suppression design, BASS's ISS-type inert extinguishing agent, FLEX's CO₂/He/SF₆
  suppressants, SAME smoke particle sizes, BRE burning in NASA's candidate exploration
  atmospheres). Each link quotes the NASA PSI record word for word (tested) and says whether NASA
  states the use or it is EMBER's reading, plus what is not covered. *Evidence on the way* lists
  SoFIE, FM2 and LUCI and flags the ones that would close a gap in your scenario.
- **Ground Uses on Earth** - six NASA-stated ground uses of the same research (smoke detectors for
  submarines and labs; mines, aircraft and submarines; less harmful suppressants; wildfire and
  building-fire models; cone-calorimeter material testing), each quoted from the PSI record's
  Earth-benefits text and tested. It says that no PSI combustion record covers fine water mist.
- **Credibility page** - a self-assessment structured on the eight NASA-STD-7009B factors,
  backed by a recorded test run and a SHA-256 fingerprint of the curated data.

## Getting started

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the test suite |
| `npm run build` | Type-check and build for production |
| `npm run sync:psi` | Refresh the NASA PSI record snapshot (needs access to psi.nasa.gov) |
| `npm run sync:tables` | Download the PSI experimental tables (`-- --from DIR` imports an earlier download, hash-checked) |
| `npm run data:normalize` | Rebuild condition ranges from the stored tables |
| `npm run record:demo` | Record live Gemini answers for the presets (needs a key; `-- --asks --missing` records only the missing suggested questions) |
| `npm run recheck:recorded` | Re-check every recorded answer against today's evidence and checker rules (run after data, ranking or checker changes) |
| `npm run video:record` | Record the 30-second demo video and screenshots |
| `npm run verify:report` | Run tests and record `src/data/verify-report.json` for the credibility page |

## AI analysis (Google Gemini)

```bash
cp .env.example .env.local   # then set GEMINI_API_KEY (Google AI Studio)
npm run dev
```

**Analyze scenario** runs on the Vite dev/preview server (`server/analyze.ts`); the key never
reaches the browser. For each request the server:

1. rebuilds the ranking and an evidence package from the scenario alone (browser-sent evidence is
   ignored): NASA PSI objectives and publications, run-table ranges, the 3 NASA run-table rows
   nearest the scenario for each top investigation (`server/rows.ts`), and EMBER's limitations;
2. asks Gemini (`gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3.8-flash`, 45 s each, overridable
   with `GEMINI_MODEL`; busy, rate-limited or retired models fall through) for JSON claims of six
   kinds: Reported finding, Measured data, Comparison, Research gap, Equipment implication (must
   quote NASA text), Interpretation;
3. checks every claim (`src/lib/grounding.ts`): each excerpt must appear word for word in the
   source it cites; every number in the claim and its implication must appear in those sources,
   the scenario or the Earth reference values (0 g, 1 g, 21% O₂, 14.7 psia); a Comparison must cite
   two investigations; Measured data must quote a run-table row; findings, measured data,
   comparisons and equipment implications must quote NASA text, not only EMBER's own summaries; and
   any claim or summary stating a safety conclusion (will not burn or ignite, safe, fire-safe,
   non-flammable, or no detection, suppression or ventilation needed) is rejected;
4. if anything failed, sends the checker's findings back once and keeps the better answer.

Rejected claims are shown with the reason, and a receipt counts NASA versus EMBER excerpts. The
check shows the basis is auditable; it does not prove a claim follows from its excerpt.

Live answers use Gemini 3's low thinking level (about 10-30 s; `GEMINI_THINKING` changes it).
`npm run record:demo` records the presets at the model's default level through the same pipeline
into `src/data/recorded-analyses.json`; without a key (or with `EMBER_AI_OFF=1`, or on a static
host) the app replays those, labelled **Recorded**. Edited scenarios need a live key.

## Demo video and screenshots

```bash
npm run build
npm run preview:demo
npm run video:record        # media/ember-demo-30s.mp4 (+ .srt) and media/shot-*.png
```

Needs Playwright with Chromium and ffmpeg with libass.

## Data status

All 20 profiles in `src/data/investigations.ts` are linked to their NASA Physical Science
Informatics (PSI) investigation records (BASS-II → PSI-25, Saffire-I → PSI-98, FLEX → PSI-69,
…). `npm run sync:psi` fetches the Combustion Science records from the PSI repository search
and stores them in `src/data/psi-snapshot.json` (accession, title, dates, hardware,
objectives, publications) with the date and a SHA-256 of the response. Tests check that every
link resolves to a Combustion Science record with a matching acronym.

`npm run sync:tables` stores each investigation's experimental tables in `src/data/tables` and
`npm run data:normalize` converts only columns whose unit is stated (vol %, mole fraction, atm,
bar, mmHg, cm/s). Uncalibrated instrument readings (BASS-II "Air display") and free text are not
used; inverse-flame burner oxidizer streams are shown separately but not used for ranking; values outside physical limits are dropped and
counted. Ranges are min-max envelopes per condition, not joint test points. Gravity and fuel
type stay curated. The current tables were imported on 2026-11-14 from a hash-checked download
made on 2026-11-02, because PSI's per-investigation API returned HTTP 500 that day.

## Not claimed

EMBER does not predict flammability, flame spread, extinction or fire risk, and the AI analysis
is told not to either. Match points select evidence; they are not confidence or probability. It is not a NASA product and not a
safety certification.

## Data credits

All experimental data comes from NASA's [Physical Science Informatics (PSI)](https://psi.nasa.gov/physci/repo/)
repository: investigation records (titles, objectives, hardware, publications) and the experimental
tables attached to each investigation, stored unmodified in `src/data/tables` with their SHA-256.
Check each record's licence before reusing its data. The one exception is the Saffire IV-VI test
conditions and results in `src/data/ntrs-saffire.ts`, copied from Tables 1 and 2 of NASA's paper
[Preliminary Results from the Saffire VI Experiment](https://ntrs.nasa.gov/citations/20240002981)
(Urban et al., ICES-2024-365, NTRS 20240002981); pressures are published in kPa and converted to psia
by EMBER only for plotting. Every stored value was checked against those tables on 2026-11-15; the
PDF's SHA-256 is recorded in that file. Context on partial-gravity flammability comes
from NASA Glenn's [FM2 page](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/).
Earth applications quote each record's "Research Impacts/Earth Benefits" text. Upcoming studies
cite NASA's [SoFIE page](https://science.nasa.gov/biological-physical/investigations/sofie/) and the
[Flame in Freefall challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)
(LUCI and FM2); partial-gravity wording also follows NASA's
[Physical Sciences on the Moon](https://science.nasa.gov/lunar-science/focus-areas/physical-sciences/).
EMBER is a Space Apps research prototype and is not affiliated with or endorsed by NASA.

## How AI was used

- **In the product:** Google Gemini writes the optional evidence synthesis. Every claim is checked
  against the cited source text by `src/lib/grounding.ts`; nothing the model writes is shown
  unchecked, and recorded answers are labelled as recorded.
- **Building EMBER:** the team used AI coding assistants (Anthropic's Claude, through Claude Code)
  to help write and review code, tests and documentation. Some commits made with an assistant
  carry a `Co-Authored-By` line; not all do, so the commit history is not a complete record of
  where an assistant helped. The team chose the challenge, scope and scientific framing and reviewed all work.

## License

Code: MIT (see `LICENSE`). NASA PSI data in `src/data` is NASA's; check each record's terms before
reuse.
