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
- **Transparent ranking** – 25 points for addressing the safety question (10 for adjacent
  research) plus 15 points per matching condition (75 max). Unknown ranges earn nothing and
  ties share a rank. Every score can be expanded to see why.
- **Robustness probes** – each scenario is re-ranked under small input changes and
  single-input removals, and the app reports whether the top match holds.
- **Parameter coverage** – shows where curated condition ranges exist against your scenario.
- **Limitations** – scenario-specific statements of what the evidence cannot establish
  (partial gravity, oxygen outside tested ranges, joint-condition coverage, …).
- **Baseline comparison** and **Markdown evidence-brief export**.
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
| `npm run verify:report` | Run tests and record `src/data/verify-report.json` for the credibility page |

## Data status

Profiles in `src/data/investigations.ts` are curated from the challenge description and
public NASA mission summaries. Numeric ranges are sparse and approximate on purpose, and
each one states its basis. **No profile is yet linked to a verified NASA PSI accession.**
To link one, look the investigation up on <https://psi.nasa.gov>, fill in `psi.accession`,
`psi.doi`, `psi.url` and `psi.verifiedOn`, and replace approximate ranges with values from
the PSI run tables. Then run `npm run verify:report`.

## Not claimed

EMBER does not predict flammability, flame spread, extinction or fire risk. Match points
select evidence; they are not confidence or probability. It is not a NASA product and not a
safety certification.
