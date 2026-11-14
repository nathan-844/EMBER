# EMBER — Fire Safety Research

EMBER is a research prototype for the 2026 NASA Space Apps challenge
**Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data**.

**Live demo: https://ember-fire-safety.vercel.app** (presets replay recorded AI answers instantly;
edit any value for a live, rate-limited Gemini analysis).

It ranks NASA microgravity combustion investigations (BASS, Saffire, FLEX, ACME, SAME, …)
against a crew-environment scenario and is explicit about what the evidence can and
cannot establish.

## Features

- **Scenario lab** – pick a preset (ISS, lunar habitat, pressurized rover, Mars habitat,
  spacesuit) or set oxygen, pressure, gravity, airflow and fuel yourself. Any input can be
  left *unspecified*.
- **Ranges from NASA run tables** – oxygen, pressure and airflow ranges for 14 profiles are read
  from 14 of the 21 stored NASA PSI experimental tables (1,527 source rows used; every stored file
  has its SHA-256). The few remaining
  hand-written ranges are labelled *curated* everywhere they appear.
- **Transparent ranking** – 25 points for addressing the safety question (10 for adjacent
  research) plus up to 15 points per condition (75 max): 15 inside a range measured in a NASA
  table, 10 inside a curated estimate, about half that just outside a range. Unknown ranges earn
  nothing. With a fuel type set, fuel is a grouping rather than just points: every study of that
  fuel is listed first and other fuels follow as labelled analogue evidence, because a droplet or
  gas-flame study at the right oxygen is not evidence about how solid cabin materials burn. Ranks
  and ties count within each group. Every score can be expanded to see why.
- **Honest headline** – the insight card states how many of your conditions the top profile
  matches and names the ones it does not (gravity first). It never claims coverage from a
  single matching condition.
- **Robustness probes** – each scenario is re-ranked under small input changes, single-input
  removals and four alternative point schemes, and the app reports whether the top match holds.
- **Key finding by fuel type** – for a Moon-base atmosphere (30% O₂) the app states that no
  solid-material test in the data goes above 22.2% oxygen; only droplet and gas-flame studies reach
  30%.
- **Grounded AI analysis (optional)** – Google Gemini writes a short synthesis from a server-built
  evidence package. EMBER treats the model as an untrusted author: a claim is kept only if every
  excerpt appears word for word in the source it cites and every number appears in those sources
  or your scenario. Rejected claims are shown with the reason, and a receipt counts how many
  excerpts are NASA text versus EMBER's own summaries.
- **Parameter coverage** – shows where curated condition ranges exist against your scenario.
- **Gap map of joint test conditions** – every NASA run-table row drawn as oxygen against pressure
  from the same row, shaped and coloured by fuel type, with your scenario marked and the distance
  to the nearest solid-material run stated. Tables without a pressure column use the curated cabin
  pressure (hollow marks); rows that list several levels without pairing them are left out and
  counted.
- **Data explorer for modellers** – for each ranked investigation, which ranked conditions and
  settings varied between runs, which results were recorded (burn length, spread rate,
  extinction diameter, weight-loss rate…), what was held fixed in every run, and the rows
  themselves. A tidy CSV export gives every filled cell with its NASA table, SHA-256, source row,
  the value as NASA wrote it, the parsed numbers and, for ranked conditions, the value in EMBER's
  unit. Column roles are judged from NASA's headers.
- **Limitations** – scenario-specific statements of what the evidence cannot establish
  (partial gravity, oxygen outside tested ranges, joint-condition coverage, …).
- **Baseline comparison**, **Markdown evidence-brief export** and a **CSV data export** (each
  condition range with its NASA table, column and row count) for modelling.
- **Credibility page** – a self-assessment structured on the eight NASA-STD-7009B factors,
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
| `npm run record:demo` | Record live Gemini answers for the presets (needs a key) |
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
   with `GEMINI_MODEL`; busy, rate-limited or retired models fall through) for JSON claims of five
   kinds: Reported finding, Measured data, Comparison, Research gap, Interpretation;
3. checks every claim (`src/lib/grounding.ts`): each excerpt must appear word for word in the
   source it cites; every number in the claim and its implication must appear in those sources,
   the scenario or the Earth reference values (0 g, 1 g, 21% O₂, 14.7 psia); a Comparison must cite
   two investigations; Measured data must quote a run-table row;
4. if anything failed, sends the checker's findings back once and keeps the better answer.

Rejected claims are shown with the reason, and a receipt counts NASA versus EMBER excerpts. The
check shows the basis is auditable; it does not prove a claim follows from its excerpt.

Live answers use Gemini 3's low thinking level (about 10–30 s; `GEMINI_THINKING` changes it).
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
bar, mmHg, cm/s). Uncalibrated instrument readings (BASS-II "Air display"), inverse-flame burner
oxidizer streams and free text are not used; values outside physical limits are dropped and
counted. Ranges are min–max envelopes per condition, not joint test points. Gravity and fuel
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
Check each record's licence before reusing its data. Context on partial-gravity flammability comes
from NASA Glenn's [FM2 page](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/).
EMBER is a Space Apps research prototype and is not affiliated with or endorsed by NASA.

## How AI was used

- **In the product:** Google Gemini writes the optional evidence synthesis. Every claim is checked
  against the cited source text by `src/lib/grounding.ts`; nothing the model writes is shown
  unchecked, and recorded answers are labelled as recorded.
- **Building EMBER:** the team used AI coding assistants (Anthropic's Claude, through Claude Code)
  to help write and review code, tests and documentation. Commits made with an assistant carry a
  `Co-Authored-By` line. The team chose the challenge, scope and scientific framing and reviewed the work.
