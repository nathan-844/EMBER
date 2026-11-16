# Plan to raise EMBER on all five judging criteria

Written 2026-11-15 against commit `7704260`. Supersedes nothing: [ELEVATION-PLAN.md](ELEVATION-PLAN.md)
is the data and functionality roadmap; this plan is about how a judge scores the result.

**Read this first.** The starting scores are one reviewer's estimate (an AI assistant reading the
app and its docs), not an official rubric. No plan can guarantee a 10 from every judge. Each
section below says what a 10 would have to look like, what work gets there, and how we would know.
Several items need people outside the team (an expert reviewer, test users, NASA contacts); those
are marked **needs people** and cannot be done by writing code.

| Criterion | Now | Biggest thing holding it back |
|---|---|---|
| Presentation | 6 | Seven destinations, text-heavy pages, no single story, an outdated demo video |
| Impact | 7 | The app ends in evidence lists, not something a designer can act on; no partial-gravity data |
| Creativity | 7.5 | The distinctive ideas are buried; the AI only writes summaries |
| Relevance | 8 | AI answers are source-checked but never scored for being right |
| Validity | 9 | No expert has reviewed it; intervals assume every run is independent |

## Phase 0: Measure first (half a day)

Nothing gets redesigned on opinion. Run the six-track test plan already agreed:

1. AI answer accuracy: 30 fixed questions, each run twice live, plus the 74 recorded answers.
2. Judge walkthrough: five timed first-visit tasks on the live site.
3. Every page at phone, tablet and desktop widths, light and dark.
4. Accessibility: keyboard, labels, headings, focus, contrast.
5. Speed: load size and time on a slow connection.
6. End-to-end functions: ZIPs, shared links, rate limit, no-key behaviour.

Also in this phase:

- Read the official 2026 challenge text and judging criteria and copy the exact wording into this
  file. The five criteria above are the usual Space Apps set; confirm them for 2026.
- Confirm the submission deadline and what may change after it. Everything below is ordered so
  that stopping after any phase still leaves a better submission.

**Done when:** one test report exists with findings ranked by severity, and the rubric in this file
is NASA's wording rather than ours.

## Phase 1: Presentation, 6 to 10 (2 to 3 days)

What a 10 looks like: a first-time visitor understands what EMBER is in ten seconds, reaches the
main result in under a minute without reading instructions, and never meets a word they have to
look up.

1. **One story.** The landing page leads with a single guided path, "ISS to the Moon in 60
   seconds": set the atmosphere, see the oxygen gap, see which tests survive the move, see the
   tests that would fill the gap. Every other feature is reachable from it but not required.
2. **Four destinations, not seven.** Proposed: *Explore* (Scenario Lab), *Findings*, *Analyze*
   (Mission, with Compare and the Workbench templates inside it), *Data*. Credibility moves to a
   link in the footer and beside every number it backs.
3. **One page pattern.** Every page puts the answer first, the controls second and the detail
   collapsed, as the rebuilt Mission page does. Compare and Workbench get the same treatment.
4. **Plain words.** Remove or explain every research term on screen ("estimand", "non-dominated",
   "bootstrap", "censored"). A short glossary opens from any term that stays.
5. **A picture on every page.** Compare, Workbench and Mission each get a chart that shows the
   result, not only a table.
6. **Fix what Phase 0 finds** at phone and tablet widths, for keyboard users, and for speed. The
   main bundle (699 kB) is split so the landing page loads without the lab.
7. **Submission material.** A new 30-second demo video that follows the one story, a seven-slide
   deck, and a project page that states the problem, the result and the limits in that order.

**Done when:** five people who have never seen EMBER each finish the five walkthrough tasks
unaided (**needs people**); Lighthouse scores for performance and accessibility are 90 or above on
the landing page and the lab; no page scrolls sideways at 375 px.

## Phase 2: Relevance 8 to 10 and Creativity 7.5 to 10 (3 to 4 days)

These two rise together, because the challenge asks for AI-powered insight and EMBER's most
original idea is how it constrains the AI.

What a 10 looks like: the AI does something a judge has not seen before, it demonstrably uses
NASA's data, and its accuracy is published with its failures.

1. **Publish the AI score.** Phase 0's results go on the Credibility page: correct answers, claims
   that follow from their quotes, correct refusals, and every failure listed. Re-runnable with one
   command.
2. **Ask a question, get a calculation.** A question in plain words ("did thicker PMMA burn
   longer?") is turned by the AI into a comparison setting, shown to the user for approval; the
   engine computes it from NASA's rows; the AI then explains the computed numbers. The AI never
   supplies a number, so it cannot invent one. This is the feature to lead the pitch with.
3. **Show the checker working.** A visible, replayable example of the checker rejecting a real AI
   claim, with the reason, on the landing page and in the lab.
4. **An evidence map you can move.** Oxygen against pressure, with gravity as a switch: drag your
   habitat and watch NASA's tests move between "matches" and "related only". It replaces three
   separate tiles and is the image people will remember.
5. **Objective checklist.** Each objective in the challenge text is listed on the landing page
   with the feature that answers it and a link, so a judge does not have to work out the mapping.

**Done when:** the AI score is public with its failures; the question-to-calculation path works for
all four comparison templates and refuses questions the data cannot answer; every challenge
objective has a named, linked feature.

## Phase 3: Impact 7 to 10 (4 to 6 days, the largest phase)

What a 10 looks like: someone outside the team can do something with EMBER's output that they
could not do before, and there is evidence that they did.

1. **Partial-gravity data.** Digitise the run tables behind the lunar and Martian gravity reports
   EMBER already quotes, with the figure, axis calibration and digitisation error kept for each
   value. Today every stored test is microgravity, so any Moon or Mars question ends in "related
   only". This is the single change that most improves the answer to the challenge's own question.
2. **A brief someone can hand over.** Mission ends in a one-page evidence brief: what was tested
   near the design, what was not, the proposed tests, and the limits. Printable, with sources.
3. **Release the Fire Test Atlas as a dataset.** A versioned public download with schema, units,
   licence notes and a citation, archived with a DOI. Other teams can then build on it, which is
   impact that outlives the event.
4. **Send NASA the audit.** The 43 data-quality issues, each with its cell, go to the PSI team as
   a report (**needs people**: you send it). A reply, or a corrected record, is the strongest
   impact evidence available.
5. **Earth use.** One worked example of the same evidence applied to a ground case NASA names
   (submarines, aircraft, mines), so the benefit is not limited to spacecraft.

**Done when:** at least one partial-gravity dataset is in the atlas with its uncertainty and
changes a Mission answer; the dataset has a DOI; the audit report has been sent.

## Phase 4: Validity 9 to 10 (2 to 3 days of work, plus waiting on people)

What a 10 looks like: the claims have been checked by someone other than the people and tools that
made them.

1. **Expert review (needs people).** One combustion or fire-safety researcher reads findings F1 to
   F8 and the BASS-II comparison. Their name, date, comments and what changed as a result go on the
   Credibility page. This is the point EMBER currently cannot earn alone.
2. **A second person checks the BASS-II cross-check** that an AI assistant did (**needs people**;
   a teammate can do it in an hour with the report open).
3. **Session grouping.** Review which runs shared a session and recompute the intervals with
   grouped resampling. Where grouping cannot be established, say so beside the interval.
4. **Independent recomputation.** Recompute all eight findings in a separate Python script that
   shares no code with the app, and test that both agree.
5. **More source reconciliation.** Check Saffire-II, FLEX and SAME values against their reports,
   as was done for BASS-II.
6. **Clean-machine rebuild.** Rebuild every derived file from fresh NASA downloads on a machine
   that has never seen the repo, including the workbook step on Windows.

**Done when:** a named expert's review is published; intervals reflect session grouping or state
that they cannot; the Python recomputation agrees on every finding.

## Phase 5: Freeze and submit (1 day)

1. Re-run all of Phase 0 and publish before and after numbers.
2. Record the demo video against the final build.
3. Connect Vercel to GitHub so the live site always matches `main`.
4. Tag the submitted commit and do not change it.

## Order of value if time runs out

1. Phase 0 and Phase 1 items 1 to 4 (story, navigation, page pattern, plain words).
2. Phase 2 items 1 and 2 (AI score, question to calculation).
3. Phase 4 items 1 and 2 (the two human checks; start the outreach on day one, because the wait
   is the long part).
4. Phase 3 item 1 (partial gravity).
5. Everything else.

## What this plan does not do

- It does not make EMBER a predictor of fire behaviour. That stays out of scope.
- It does not promise an award or a score.
- It cannot replace the outside people it asks for. Without an expert review, validity stays
  where it is however much code is written.
