# EMBER - Fire Safety Research

EMBER is a research prototype for the 2026 NASA Space Apps challenge
**Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data**.

You describe a crew environment (oxygen, pressure, gravity, airflow, fuel) and EMBER shows which of
NASA's microgravity combustion experiments (BASS, Saffire, FLEX, ACME, SAME, …) apply to it, and
where the evidence runs out.

**Live demo: https://ember-fire-safety.vercel.app**

## What you can do

- **Set a scenario** - start from a preset (ISS, lunar habitat, pressurized rover, Mars habitat,
  spacesuit) or enter your own conditions, and choose a safety question: prevention, detection or
  suppression.
- **See the best-matching NASA research** - 20 investigations are ranked against your scenario, and
  every score can be opened to see why.
- **Ask EMBER** - ask a question in plain English and get an AI answer in which every claim is
  checked against NASA's own text.
- **See the gaps** - a gap map of every NASA test run and plain statements of what the evidence
  cannot tell you.
- **Read the measured findings** - eight results computed by code from NASA's own test rows (for
  example: in Saffire-II, the ground test burned further than the same sample did in orbit in 5 of
  8 cases). Each shows its rows, method, limits and what it does not claim.
- **Browse the Fire Test Atlas** - every NASA source row (2,163 from 23 PSI tables, including NASA's
  SAME/SAME-R results workbook, plus 5 Saffire IV-VI samples) in one schema: 1,912 test rows that
  observe 1,854 distinct experiments, with each value traced to the cell it came from, and a CSV download.
- **Compare tests yourself** - a source-checked comparison of carbon monoxide from two BASS-II
  materials, and a workbench with templates for Saffire-II, FLEX and smoke ageing. Each shows the
  rows used and left out, and how the result moves under stricter rules.
- **Check a mission's evidence** - list your materials, set two atmospheres and see which NASA
  tests apply to each, then list the tests that would fill the gaps within a budget.
- **Reproduce any result** - every comparison and all eight findings download as a ZIP that reruns
  the numbers with Node alone: no server, no network, no AI key.
- **Read the data audit** - 43 data-quality issues EMBER found in NASA's tables, each with the
  cells as written and how it is handled.
- **See tests near your scenario** - a count of individual NASA tests near your oxygen and pressure
  together, per fuel type.
- **Explore the raw data** - the NASA run tables behind each investigation, with CSV export for
  modelling.
- **Check the credibility** - a self-assessment against NASA's model-credibility standard, backed by
  the test suite, and a score for the AI: 57 of 60 graded answers correct, with the rest listed.

## How it stays honest

- Condition ranges come from NASA's PSI run tables wherever possible; hand-written estimates are
  labelled *curated* and score less.
- The AI is treated as an untrusted author. A claim is shown only if every quote appears word for word
  in the source it cites and every number can be traced. Claims that state a safety conclusion are
  rejected.
- The AI is scored: 30 fixed questions, each asked twice live and read against an answer written
  beforehand. 59 of the 60 answers came from `gemini-3.1-flash-lite` and one from the fallback
  `gemini-3.5-flash`. The grading was done by an AI assistant, not an expert, and says so.
- Findings are computed by code, never written by a model. Each sentence is generated from the
  computed numbers, and tests recheck every headline number against NASA's raw cells.
- Nothing in NASA's files is corrected. Problems become flags and audit entries, and the raw cell
  is always kept.
- All derived data rebuilds from the stored NASA tables with one command (`npm run data:all`), and
  CI fails if the committed data differs from a fresh rebuild.
- Comparisons list every row left out and why, block ones that do not make sense, and never turn
  a missing or off-scale reading into a number.
- EMBER selects evidence. It does not predict whether something will burn.

The full detail of the ranking, the AI check, the data pipeline and the more specialised features is
in **[docs/FEATURES.md](docs/FEATURES.md)**. The atlas schema, rules and audit are described in
**[docs/DATA.md](docs/DATA.md)**. What EMBER's checks do and do not establish is in
**[docs/M0-BASELINE.md](docs/M0-BASELINE.md)**, and every change to how NASA's data is read is logged in
**[docs/CHANGELOG.md](docs/CHANGELOG.md)**. The comparison, workbench and mission pages are described
in [docs/FEATURES.md](docs/FEATURES.md#compare-workbench-and-mission).

## Getting started

```bash
npm install
npm run dev
```

To turn on live AI answers, copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` (from
Google AI Studio). Without a key, the presets replay recorded answers.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the test suite |
| `npm run build` | Type-check and build for production |
| `npm run benchmark` | Run the 60-case analysis benchmark |

The other scripts (data sync, AI recording, demo video) are listed in
[docs/FEATURES.md](docs/FEATURES.md#all-scripts).

## Not claimed

EMBER does not predict flammability, flame spread, extinction or fire risk, and the AI is told not
to either. Match points select evidence; they are not confidence or probability. The comparisons
describe what NASA's tests recorded; they do not rank materials by safety, and the test planner
lists coverage, not predicted results. No combustion or fire-safety expert has reviewed the
findings or comparisons. It is not a NASA product and not a safety certification.

## Data credits

All experimental data comes from NASA's [Physical Science Informatics (PSI)](https://psi.nasa.gov/physci/repo/)
repository: investigation records and their experimental tables, stored unmodified in
`src/data/tables` with their SHA-256. Each PSI record's DOI and licence are stored with it (23 of 24 are CC0-1.0; PSI-10 states none).

The Saffire IV-VI values come from NASA's paper
[Preliminary Results from the Saffire VI Experiment](https://ntrs.nasa.gov/citations/20240002981)
(Urban et al., ICES-2024-365, NTRS 20240002981). Further context comes from NASA Glenn's
[FM2 page](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/),
NASA's [SoFIE page](https://science.nasa.gov/biological-physical/investigations/sofie/),
[Physical Sciences on the Moon](https://science.nasa.gov/lunar-science/focus-areas/physical-sciences/)
and the [Flame in Freefall challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

EMBER is a Space Apps research prototype and is not affiliated with or endorsed by NASA.

## How AI was used

- **In the product:** Google Gemini writes the optional evidence synthesis. Every claim is checked
  against the cited source text by `src/lib/grounding.ts`; nothing the model writes is shown
  unchecked, and recorded answers are labelled as recorded.
- **Building EMBER:** the team used AI coding assistants (Anthropic's Claude, through Claude Code,
  and OpenAI's Codex) to help write and review code, tests and documentation. The check of BASS-II's
  gas readings against NASA's report on the Compare page was done by an assistant. Some commits made with an assistant
  carry a `Co-Authored-By` line; not all do, so the commit history is not a complete record of
  where an assistant helped. The team chose the challenge, scope and scientific framing and reviewed all work.

## License

Code: MIT (see `LICENSE`). NASA PSI data in `src/data` is NASA's: 23 of the 24 PSI records it
comes from state CC0-1.0, and PSI-10 (Flame Design) states no licence, so check that one before reuse.
