# Data and assumption change log

Every change to how EMBER reads, classifies or counts NASA data, newest first. NASA's files are
never edited: the stored tables in `src/data/tables` keep each cell as written, with the SHA-256 of
the NASA file in `src/data/table-manifest.json`. A change here is a change to EMBER's reading of
those cells, and each entry says what moved and by how much.

The state before a milestone is its baseline commit; check it out to reproduce the old numbers.

## M0: accurate baseline (2026-11-15, baseline commit `e08de4d`)

No NASA value was changed, added or removed. Finding results F1–F7 are numerically identical. F8's
result is identical (46 of 48 runs, median 1.5 times); it now also reports the two flights
separately and lists the runs it leaves out.

### Changed scientific assumptions

1. **A test row is an observation, not always a separate experiment.**
   Before: every row labelled `test` was described as one run, so 1,912 test rows read as 1,912
   experiments. Now: SAME and SAME-R rows carry a reviewed experiment identity (sample type plus
   NASA's SAME test number; a number ending in "a" is the same run's smoke measured again after
   ageing). The 1,912 test rows observe 1,854 distinct experiments: 58 rows are second
   measurements (16 in SAME, 42 in SAME-R).
   Basis: NASA's own labels ("61" and "61a") and descriptions ("aged", "after secondary aging").
   Checked: every aged row has exactly one fresh row with the same sample type and number, and the
   same inlet velocity, heater setting and sample temperature.
   Limit: only SAME and SAME-R are reviewed. The other 1,758 test rows are still taken as one
   experiment each, and rows that are identical in every column (flagged in the audit) are not merged.

2. **SAME-R results rows are supplemental observations, not asides.**
   Before: the 109 SAME-R rows of NASA's results workbook were classed `aside`, the same kind as
   footnotes and blank lines, to avoid counting each test twice. Now: they are a kind of their own,
   `supplement` (measurements of a test another table lists). They are still never counted as
   tests. Asides fall from 137 to 28; nothing else moves.

3. **The two SAME-R files disagree on two runs, and EMBER does not resolve it.**
   Found while linking the files: NASA's run table (PSI-101-0) has a row "Teflon 57" that the
   results workbook lacks, and the workbook has "Kapton 112" that the run table lacks. The run table
   also uses the number 57 under two materials, which is why identity includes the sample type.
   Handling: both rows are kept as written; the run-table row stays a test, the workbook row stays
   an unmatched supplement, and the audit lists both as unresolved. Neither is relabelled. EMBER
   cannot tell from the files which is right.

4. **A cell with several values is never one exact value.**
   Before: the browser copy of the atlas kept only the highest value of a multi-valued cell, so
   "21.5 - 21.7" was matched as exactly 21.7. Now: each multi-valued cell is typed as a `list`,
   a `range` or a `trajectory` (start then end, as in "22.1 to 22.0"), the span is kept, and a row
   is "near" a scenario only when its whole span is inside the window.
   Affects three test rows (PSI-98-0 row 2, PSI-99-0 rows 9 and 10) and 24 session or matrix rows.
   Effect on nearby-test counts, over the 7 presets and a grid of 335 other scenarios: one solid
   test fewer at 27% O₂ (a 21.9–22.0% row whose top end alone was inside the window). No preset changes.
   Unchanged on purpose: finding F6 asks how high solid tests reach, so it still uses the top of a
   range, as its method states. The gap map still draws each listed value as a point.

5. **Display rounding no longer decides a match.**
   Before: values were rounded to two decimals before matching against the oxygen and pressure
   windows. Now: matching uses the stored value; rounding happens only when a value is shown.
   Effect over the same scenarios: one gas test fewer in four grid scenarios, where a converted
   value just outside a window edge had rounded onto it. No preset changes.

6. **A zero diameter means "not in this sheet", and the rule now says so.**
   The rule's effect is unchanged: in the SAME/SAME-R sheet a particle diameter or geometric spread
   written as 0 is read as no value. Two things about it were wrong and are corrected.
   Scope: its description said it applied to rows where every result is 0. That is true of 20 rows
   (all SAME DBP runs); three more SAME-R Kapton rows (tests 75, 85, 114) have a moment recorded but
   a diameter of 0. On all 23, the particle count that the diameter is divided by is itself 0 or an
   Excel error, and the three Kapton descriptions say the particle counter did not record ("no
   Ptrak"). A test checks that no row with a usable particle count has a zero diameter.
   Meaning: the flag was named and described as "not measured". That overstated it. The workbook's
   separate "DBP" sheet holds nonzero raw particle-counter readings for the DBP runs, and NASA's
   SAME final report says moment-instrument results for all five materials are in its Table 1. So
   the DBP runs were measured; this sheet just holds no reduced diameter for them. The flag is now
   `zero-placeholder`, and the texts say "the sheet holds no value".
   Consequence for F8: its 8 excluded DBP runs are missing from the comparison because their
   reduced diameters are not in the sheet EMBER reads, not because NASA has no data for them.
   Not done: the "DBP" sheet and the report's Table 1 are not imported or compared.

7. **Uncertainty intervals assume independent runs, and now say so.**
   The intervals and tests on F1–F8 treat each run (or each fresh/aged pair) as independent. Runs
   made in one session share hardware and conditions, so the intervals may be too narrow. Session
   grouping has not been assessed; each finding's method now states the assumption.

8. **"NA" in a cell means no measurement** (introduced with the SAME workbook, recorded here for
   completeness). It occurs only in that sheet's mass-loss column, 20 times.

### Added without changing any reading

- Each value says how it was obtained when not read as written (`converted`, `invalid`, `bound`,
  `placeholder`), and each row says why oxygen, pressure or flow is absent (`blank` cell, or
  `not-in-table`: the NASA table has no such column, which does not mean the experiment did not record it).
- `src/data/counts.json`: every count the app and docs show, from one build step, with a snapshot id.
- The evidence brief, the scenario CSV and the atlas download name carry the snapshot id.
- F8 lists the 10 runs it leaves out by id, with the reason.
- `scripts/sync-same-results.py` reads the workbook from memory (no temporary path), pins its
  dependency in `scripts/requirements.txt`, and stops if a formula cell has no saved value. The
  values are the ones Excel last calculated and saved; they are not recalculated.

### Corrected documentation

README audit count (37 → 43), the feature guide's atlas totals, the data card's table and row
counts and "six findings", and the old data plan's comparisons with other teams (removed; they had
not been re-checked). A test now fails when a count quoted in these documents differs from `counts.json`.
