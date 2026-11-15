# EMBER data guide

How EMBER turns NASA's tables into the Fire Test Atlas, the audit and the measured findings, and how to rebuild all of it.

## The chain

```
NASA PSI tables (src/data/tables/*.json, SHA-256 of each NASA file in table-manifest.json)
NASA NTRS 20240002981, Tables 1–2 (src/data/ntrs-saffire.ts, PDF SHA-256 recorded)
        │  src/lib/atlas/specs.ts      one extraction rule per table
        │  src/lib/atlas/materials.ts  material dictionary
        ▼
Fire Test Atlas      src/data/atlas/atlas.json, atlas.csv, atlas-rows.json
        │  src/lib/atlas/audit.ts
        ├──────────▶ Data audit         src/data/atlas/audit.json
        │  src/lib/findings/*.ts
        ▼
Measured findings    src/data/findings.json, findings-rows.json
```

| Command | What it does |
|---|---|
| `npm run data:all` | Rebuilds everything above, the API bundles and the verify report |
| `npm run data:atlas` | Atlas, audit and findings only |
| `npm run data:check` | Rebuilds and fails if any committed data file differs (CI runs this) |
| `npm test` | Checks every atlas value against its NASA cell, and every finding against NASA's raw cells |

## Atlas schema

One record per NASA source row (2,009 PSI rows, 8 of them PSI-142's dataset index, which are not tests) plus the 5 Saffire IV–VI samples from the NTRS paper.

| Field | Meaning |
|---|---|
| `id` | Table id and source row (`PSI-69-0:r12`), or `NTRS-20240002981:VI-2` |
| `source` | Table, PSI accession, SHA-256 of NASA's file and the row number in it |
| `rowKind` | `test` (one run), `session` (a per-day summary), `matrix` (FLEX-2's test matrix), `aside` (footnote, blank or non-test line, with the reason) |
| `fuelClass` | solid, liquid, gas or aerosol |
| `material` | Normalised name, form and stated dimensions, plus the raw label; `basis` says whether the name is stated or inferred, with the reason |
| `o2Pct`, `o2PctEnd` | Ambient oxygen in %, at the start and end where NASA gives both |
| `burnerO2Pct` | Inverse flames only: oxygen fed through the burner, kept apart from ambient oxygen |
| `pressurePsi`, `flowCms`, `flowDirection`, `diluent` | As recorded, converted only from a unit NASA states |
| `outcome` | From the table's own outcome column only, with the rule used |
| `measures` | Every measured result and set-up quantity the table records |
| `flags` | Data-quality notes (see below) |

Every value carries `col` and `raw`: the NASA header and cell it came from, exactly as written.

`atlas.csv` is the same data, one line per record, without per-value lineage. `atlas-rows.json` is the compact copy the app loads.

## Rules

- **Units.** A value is converted only when NASA states its unit in the header or the cell (mole fraction → %, atm/bar/mmHg → psia). Values outside physical limits are kept as raw text and not used.
- **Outcomes.** Read only from tables that record one: FLEX `Test end` (Extinction → extinguished, Disruption → disrupted, Completion → burned-out), CFI-G `Hot ignition` with `Self-ext or flow term`, Saffire burn length and burn time. All other tests are `not-recorded`.
- **Materials.** `src/lib/atlas/materials.ts` maps each NASA label to a normalised name. BASS-II rods and films and BASS spheres that do not name a material are marked **inferred** PMMA, with the NASA source for the inference. Labels that count up row by row (`40% CH5`, `CH6`…) get no name.
- **Nothing is corrected.** A problem in NASA's file becomes a flag and an audit entry; the raw cell is always kept.

## Flags

Defined with plain-language text in `FLAG_TEXT` (`src/lib/atlas/specs.ts`): `out-of-range`, `leading-zero`, `not-numeric`, `negative-reading`, `ramped`, `censored`, `spreadsheet-error`, `header-subscript-lost`, `header-encoding`, `header-typo`, `unit-doubtful`, `cell-unit-converted`, `unit-mismatch`, `o2-end-implausible`, `length-width-swapped`, `material-blank`, `label-fill-down`, `label-typo`.

## Audit

`audit.json` lists every issue with its table, count, example cells as NASA wrote them, and how EMBER handles it. Kinds: **error** (very likely a mistake in the file), **gap** (something a reader needs that is not recorded), **note** (a quirk that trips up a naive reader). Besides the flags, it cross-checks gas fractions that should sum to 1, oxygen before and after a burn, identical rows, repeated identifiers, and the same material across tables.

The tables have **not** been compared with their source papers.

## Findings

Each finding in `src/lib/findings/` is a function of atlas rows that returns its claim (generated from its numbers), the rows used, the rows left out with reasons, its method, its confounders and what it does not claim. Tests check that every number in a claim is one of the finding's numbers, that the cited rows alone reproduce them, and that each headline number matches a recount from NASA's raw cells.

## Joint coverage

`src/lib/coverage.ts` counts individual tests within 5 points of oxygen and 2.5 psi of a scenario, per fuel class. The window is a stated choice, not a physical threshold. Tests whose table records no pressure are reported separately as oxygen-only matches.

## Limits

- All tests ran in microgravity; the atlas holds no partial-gravity data.
- Only 5 of 384 solid-material tests record pressure.
- Many tables record no outcome (BASS, BASS-II, SPICE, ACME Flame Design).
- Measurement uncertainty is not in NASA's tables and is not propagated.
- Each PSI record states its licence and DOI (`src/data/psi-snapshot.json`); 23 of 24 are CC0-1.0 and PSI-10 states none.
