# EMBER — Fire Safety Research

EMBER is a research prototype for the 2026 NASA Space Apps challenge
**Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data**.

It ranks NASA microgravity combustion investigations (BASS, Saffire, FLEX, ACME, SAME, …)
against a crew-environment scenario and is explicit about what the evidence can and
cannot establish.

## Features

- **Scenario lab** – pick a preset (ISS, lunar habitat, pressurized rover, Mars habitat,
  spacesuit) or set oxygen, pressure, gravity, airflow and fuel yourself. Any input can be
  left *unspecified*.
- **Ranges from NASA run tables** – oxygen, pressure and airflow ranges for 14 profiles are read
  from 21 NASA PSI experimental tables (2,001 source rows, SHA-256 per file). The few remaining
  hand-written ranges are labelled *curated* everywhere they appear.
- **Transparent ranking** – 25 points for addressing the safety question (10 for adjacent
  research) plus 15 points per matching condition (75 max). Unknown ranges earn nothing and
  ties share a rank. Every score can be expanded to see why.
- **Honest headline** – the insight card states how many of your conditions the top profile
  matches and names the ones it does not (gravity first). It never claims coverage from a
  single matching condition.
- **Robustness probes** – each scenario is re-ranked under small input changes, single-input
  removals and four alternative point schemes, and the app reports whether the top match holds.
- **Grounded AI analysis (optional)** – Claude writes a short synthesis from a server-built
  evidence package. EMBER treats the model as an untrusted author: a claim is kept only if every
  excerpt appears word for word in the source it cites and every number appears in those sources
  or your scenario. Rejected claims are shown with the reason, and a receipt counts how many
  excerpts are NASA text versus EMBER's own summaries.
- **Parameter coverage** – shows where curated condition ranges exist against your scenario.
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
2. asks Gemini (`gemini-3.5-flash` → `gemini-3.8-flash` → `gemini-3.1-flash-lite`, 45 s each, overridable
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
