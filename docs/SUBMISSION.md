# Space Apps submission: text ready to paste

Deadline: **Sunday 15 November 2026, 11:59 p.m.** in your Local Event's time zone. On your team
page open the **Project** tab, press **Edit**, fill the fields, then press **Submit**. Saving is
not submitting.

Before submitting, check: every teammate is registered for the same Local Event and appears on
the team's Members tab; both links below open in a private browser window with no login.

---

## Project name

EMBER: Fire Safety Research

## High-level summary

A Moon base may breathe 30% oxygen at reduced pressure. EMBER answers one question for the people
designing it: which of NASA's microgravity fire experiments apply to my habitat, and where does the
evidence stop? It reads every row of NASA's combustion tables into one traceable dataset (2,163
rows from 23 tables, plus 5 samples from NASA's Saffire IV-VI paper), computes eight findings from those rows by code, ranks 20 investigations
against a crew habitat you describe, and lets you ask questions that an AI answers only from NASA's
own text, with every quote and number checked before it is shown. It also says plainly what the
data cannot tell you: NASA's archived solid-material tests stop at 22.2% oxygen, and none were run
in lunar gravity.

## Link to project demo

(30-second video, public, no login; captions burned in, no sound)
https://ember-fire-safety.vercel.app/ember-demo-30s.mp4

If you prefer YouTube, upload `media/ember-demo-30s.mp4` as Public or Unlisted and use that link.

## Link to final project

https://ember-fire-safety.vercel.app

Source code: https://github.com/nathan-844/EMBER

## Detailed project description

**What it does.** You describe a crew environment (oxygen, pressure, gravity, airflow, fuel) or
pick a preset such as the ISS, a lunar habitat or NASA's 8.2 psia / 34% oxygen exploration
atmosphere. EMBER then:

- **Summarizes** NASA's results as eight measured findings, each computed by code from the rows it
  cites, with its method, its uncertainty and what it does not claim. Example: in Saffire-II the
  ground test burned further than the same sample in orbit in 5 of 8 cases.
- **Ranks** 20 NASA investigations (BASS, Saffire, FLEX, ACME, SAME and others) against your
  scenario. Every score opens to show which conditions matched and which did not.
- **Interprets** with an AI that is treated as an untrusted author. It answers from an evidence
  package built on the server; a claim is shown only if every quote appears word for word in the
  source it cites and every number can be traced. Claims that state a safety conclusion are
  rejected, and rejected claims are shown with the reason.
- **Shows the gaps.** A map of every test against your conditions, and a Mission page that takes a
  material from one atmosphere to another (for example ISS to lunar habitat) and shows which tests
  still apply, which are only related, and which new tests would fill the gap.
- **Lets you check everything.** Each number links to the NASA cell it came from. Every comparison
  downloads as a ZIP that reruns the calculation with Node alone: no server, no network, no AI key.

**How it works.** A React and TypeScript web app with a small server function for the AI. A build
pipeline turns NASA's stored tables into one schema (the Fire Test Atlas); the findings, an audit
of the data and all counts are generated from it, and a CI check fails if the committed data
differs from a fresh rebuild. More than 580 automated tests cover the ranking, the data pipeline, the claim
checker and the reproduction packages.

**What we found in NASA's data.** Reading every cell turned up 43 data-quality issues in 16 of the
23 tables (oxygen written as "3400%", thickness "037 mm", gas fractions that do not sum to 1, a
test identifier used twice). Each is listed with the cells as NASA wrote them. Nothing in NASA's
files is changed.

**How well the AI does.** We wrote 30 questions with the answer each should give, then asked each
twice through the live pipeline. 57 of the 60 answers were correct, 3 were partly right (right direction, missing the number asked for), none were wrong, and none stated a safety verdict; the grading was done by an AI assistant, not an expert. The benchmark also exposed a bug in our own claim checker, which was hiding correct refusals; we fixed it and say so. The results, including every answer that was
not right, are on the Credibility page.

**Why it matters.** Fire is one of the few hazards that can end a mission in minutes, and the
atmospheres planned for the Moon are richer in oxygen than any spacecraft cabin NASA has routinely
flown. EMBER lets a designer see in a minute which evidence covers their case and which does not,
instead of reading 24 investigation records and their tables. The same evidence informs fire
safety on Earth in submarines, aircraft and mines, which the app quotes from NASA's own records.

**What it does not claim.** EMBER selects and compares evidence. It does not predict whether a
material will burn, it is not a safety certification, and no combustion expert has reviewed its
findings. It is a research prototype and is not affiliated with or endorsed by NASA.

## NASA data

- **NASA Physical Sciences Informatics (PSI)** repository, Combustion Science: 24 investigation
  records and 23 experimental tables, stored unmodified with their SHA-256 hashes, DOIs and
  licences. https://psi.nasa.gov/physci/repo/
- **NASA Technical Reports Server (NTRS)**: the Saffire IV-VI test conditions from "Preliminary
  Results from the Saffire VI Experiment" (NTRS 20240002981), the BASS-II report
  (NASA/TM-20210011385, NTRS 20210011385), "Fire on the Moon" (NTRS 20210020516), the exploration
  atmosphere report (NTRS 20150021491) and the Artemis surface habitat paper (NTRS 20220000245), among 16
  NTRS reports quoted for published results. Every quote is checked against the PDF.
- **NASA SAME and SAME-R final reports and results workbook**, held in their PSI records.
- **NASA Image and Video Library**: ten public-domain photos of the experiments and hardware.
- NASA Glenn's FM2 page, NASA's SoFIE page and "Physical Sciences on the Moon" for context on
  planned experiments.

## Space Agency Partner data and other references

No Space Agency Partner data was used.

Tools and libraries: React, TypeScript, Vite, Vitest, esbuild, tsx, @vercel/functions, Playwright
and ffmpeg (demo video), Python with openpyxl (reading NASA's results workbook), pdftotext
(checking quotes against NASA's PDFs). Fonts: Inter and IBM Plex Mono (Google Fonts). Hosting:
Vercel. Code licence: MIT.

## Use of artificial intelligence

- **In the product:** Google Gemini writes the optional evidence answers. Every claim is checked
  against the cited source text by EMBER's own code before it is shown; nothing the model writes is
  shown unchecked, and recorded answers are labelled as recorded. The measured findings are
  computed by code, never written by a model.
- **Building EMBER:** the team used AI coding assistants (Anthropic's Claude through Claude Code,
  and OpenAI's Codex) to help write and review code, tests and documentation. The check of
  BASS-II's gas readings against NASA's report and the grading of the AI answer benchmark were done
  by an assistant, not a person, and are labelled that way in the app. The team chose the
  challenge, scope and scientific framing and reviewed the work.
- No AI-generated images, video or audio are used. All photos are NASA's.
