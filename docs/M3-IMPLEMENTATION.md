# M3 — Mission decisions and missing evidence

M3 adds a mission applicability view at `#mission`. Users define a material inventory, compare atmospheres A and B, set explicit tolerance windows and select a measured endpoint. Material name and form are categorical gates; stated vs inferred identities, thickness, flow direction, gravity regime, gas mixture, endpoint and continuous condition windows affect each row's classification. Every included observation exposes its source locator, source cells, measures and reasons. Rows are grouped as documented, partial, analogue, outside, or excluded. Wider/narrower window sensitivity, A→B transitions, selected-dimension Pareto sets and design questions keep evidence limitations visible.

Thickness is recovered additively from existing PSI geometry measures, explicit material-label geometry and Saffire VI's source labels (cm converted to mm). It does not change the legacy Atlas or findings. No pressure or numeric gravity is inferred from profile envelopes. Missing means not available in the captured source record, not never performed. Discrete levels and ranges are not interpolated; every reported value must fit the selected window. A material name does not guarantee formulation equivalence. Partial gravity is a distinct regime, not a measured g value. Selected diluents require explicit recorded composition. Equal oxygen partial pressure does not collapse oxygen fraction, total pressure, diluent and flow into an equivalence claim.

The test planner generates explicit target combinations over user-entered oxygen, pressure and flow levels. Candidate tests have assumed positive costs and explicit feasibility (`unknown`, `assumed-feasible`, `infeasible`). A deterministic greedy marginal target-coverage/cost rule produces an auditable order within budget; ID breaks ties. It is not optimal design, expected information gain, an outcome predictor, a risk score, or a safety certification. Proposed target coverage is kept separate from measured results. Mission specifications can be copied/restored or linked; changes to A/B do not silently replace proposed targets.

The application exports an offline ZIP containing the mission spec, included/excluded observation decisions and source values, raw table strings, source manifests, expected output, bundled engine and a SHA-256-checked Node 22 reproduction runner. Reproduction recalculates from the preserved extraction; it does not independently extract original PDFs/workbooks or prove source authenticity. A Scenario Lab link transfers a complete atmosphere and material conditions into the mission workspace; the original ranked investigation score remains untouched.

## Verification

- 30 focused M3 tests pass, including perturbations for each gate, missing/range semantics, Pareto tradeoffs, planner accounting/feasibility, snapshot and malformed-input validation, scenario-link conversion, and exact reproduction in a separate Node process.
- Full suite: 579 tests pass when local sockets are permitted. The default sandbox blocked localhost sockets in the server tests; the same suite passed after rerunning with approval.
- `npm run build` and `npm run typecheck` pass. Vite reports existing large chunks; Mission itself is split into a 78 KB JS chunk.
- Browser check confirmed changing PMMA thickness changes observed eligibility, generated target grid returns its coverage/cost table, and mission ZIP downloads.
- Example default selection has one documented microgravity PMMA slab observation for A and none for partial-gravity B. This reflects the strict windows and available source rows, not material safety.

## Limits

There is no independent human scientific sign-off, exact formulation/assembly model, validated similarity-window policy, numeric partial-gravity run dataset, or test-apparatus feasibility database in this M3. Candidate costs are user assumptions. This does not independently evaluate AI retrieval or improve the earlier benchmark. Preserve the competition submission snapshot and verify organizer rules before treating post-deadline changes as eligible.
