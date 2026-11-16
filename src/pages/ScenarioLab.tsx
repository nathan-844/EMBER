import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { EARTH_LINKS } from "../data/applications";
import { getInvestigation, INVESTIGATIONS } from "../data/investigations";
import { COUNTS } from "../lib/snapshot";
import { BriefDialog } from "../components/BriefDialog";
import { BaselineDiff } from "../components/BaselineDiff";
import { TileDialog } from "../components/Bento";
import { Rail, Side } from "../components/Workspace";
import { PSI_SNAPSHOT } from "../data/psi";
import { saffireRunsAbove } from "../data/ntrs-saffire";
import { tableOxygenSpan } from "../lib/landing";
import atlasCsvUrl from "../data/atlas/atlas.csv?url";
import rawAudit from "../data/atlas/audit.json";
import type { AuditFile } from "../lib/atlas/audit";
import { CoverageChart } from "../components/CoverageChart";
import { EarthPanel } from "../components/EarthPanel";
import { EquipmentPanel } from "../components/EquipmentPanel";
import { DesignQuestions } from "../components/DesignQuestions";
import { designQuestionsFor } from "../data/design-questions";
import { GravityIllustration } from "../components/GravityIllustration";
import { GuidedTour, LAB_TOUR } from "../components/GuidedTour";
import { PartialGravityPanel, partialGravityCount } from "../components/PartialGravityPanel";
import { AnalysisCard, AskForm } from "../components/AnalysisCard";
import { useAnalysis } from "../components/useAnalysis";
import { InsightCard } from "../components/InsightCard";
import { Limitations } from "../components/Limitations";
import { RankedList } from "../components/RankedList";
import { RobustnessBar } from "../components/RobustnessBar";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { GRAVITY_TEXT, SummaryStrip } from "../components/SummaryStrip";
import { buildBrief, buildCsv, downloadText } from "../lib/brief";
import { compareRankings } from "../lib/compare";
import { equipmentGroups, upcomingFor } from "../lib/equipment";
import { DownloadIcon, InfoIcon } from "../components/icons";
import { leadInsight, oxygenGapForFuel, scenarioLimitations } from "../lib/limitations";

import { rankInvestigations } from "../lib/ranking";
import { probeRobustness } from "../lib/robustness";
import { DEFAULT_SCENARIO, gravityRegime, PRESETS, ppo2VsEarth, presetScenario, type EnvironmentId, type Scenario } from "../lib/scenario";
import { OxygenComparison } from "../components/OxygenComparison";

// These read every stored NASA run table, so they load on demand.
const GapMapPanel = lazy(() => import("../components/DataExplorer").then((m) => ({ default: m.GapMapPanel })));
const NearbyPanel = lazy(() => import("../components/Nearby").then((m) => ({ default: m.NearbyPanel })));
const TablesPanel = lazy(() => import("../components/DataExplorer").then((m) => ({ default: m.TablesPanel })));

const QUESTION_LABEL = { prevention: "Prevention", detection: "Detection", suppression: "Suppression" } as const;
const FUEL_LABEL = { solid: "Solid material", liquid: "Liquid", gas: "Gas" } as const;
const TABLE_COUNT = COUNTS.sources.psiTables;
const TABLE_ROWS = COUNTS.rows.psi;

type TileId = "answer" | "ranked" | "gap" | "limits" | "robust" | "conditions" | "coverage" | "near" | "tables" | "ai" | "equipment" | "earth" | "partial" | "design";

const FUEL_PLAIN = { solid: "solid-material", liquid: "fuel-droplet", gas: "gas-flame" } as const;
const FUEL_NOUN = { solid: "solid materials", liquid: "fuel droplets", gas: "gas flames" } as const;
const FUEL_SHORT = { solid: "Solids", liquid: "Fuel droplets", gas: "Gas flames" } as const;
const AUDIT = rawAudit as unknown as AuditFile;
const SPANS = (["solid", "liquid", "gas"] as const).map((fuel) => ({ fuel, span: tableOxygenSpan(fuel) })).filter((x) => x.span != null);

const BriefIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7zM10 12h5M10 16h5" /></svg>
);
const PlayIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></svg>
);

/** Oxygen range of each fuel type's NASA run tables, with the habitat marked and the gap filled in. */
function OxygenStage({ scenario, gapPts }: { scenario: Scenario; gapPts: number | null }) {
  const o2 = scenario.oxygenPct;
  const scale = Math.max(45, Math.ceil(((o2 ?? 0) + 5) / 5) * 5);
  const pct = (v: number) => `${(v / scale) * 100}%`;
  const ticks = [0, 10, 20, 30, 40].filter((t) => t <= scale);
  const label = SPANS.map(({ fuel, span }) => `${FUEL_NOUN[fuel]} ${span!.min} to ${span!.max} percent`).join(", ");
  return (
    <div className="o2-stage" role="img" aria-label={`Oxygen tested in NASA PSI run tables: ${label}.${o2 != null ? ` Your habitat is at ${o2} percent.` : ""}${gapPts != null ? ` That is ${gapPts} points above the highest test of its fuel type.` : ""}`}>
      <div className="o2-stage-head" aria-hidden="true">{o2 != null && <span className="o2-flag" style={{ left: pct(o2) }}>Your habitat · {o2}%</span>}</div>
      <div className="o2-stage-rows">
        {o2 != null && <span className="o2-line" style={{ left: pct(o2) }} aria-hidden="true" />}
        {SPANS.map(({ fuel, span }) => {
          const mine = scenario.fuel === fuel;
          return (
            <div key={fuel} className="o2-lane">
              <span className={mine ? "o2-span mine" : "o2-span"} style={{ left: pct(span!.min), width: pct(span!.max - span!.min) }}>
                <span title={`${span!.min}–${span!.max}% O₂`}>{FUEL_SHORT[fuel]}</span>
              </span>
              {mine && gapPts != null && o2 != null && (
                <span className="o2-gap-pill" style={{ left: pct(span!.max), width: pct(o2 - span!.max) }}><span>no test · {gapPts} pts</span></span>
              )}
            </div>
          );
        })}
      </div>
      <div className="o2-ticks" aria-hidden="true">
        {ticks.map((t) => <span key={t} style={{ left: pct(t) }}>{t === 0 ? "0% O₂" : t}</span>)}
      </div>
    </div>
  );
}

/** The scenario as a row of plain chips, so the answer always says what it answers. */
function ScenarioGlance({ scenario }: { scenario: Scenario }) {
  const v = (n: number | null, unit: string) => (n == null ? "unspecified" : `${n} ${unit}`);
  const items: [string, string][] = [
    ["Environment", PRESETS.find((p) => p.id === scenario.environment)?.label ?? scenario.environment],
    ["Question", QUESTION_LABEL[scenario.question]],
    ["Oxygen", scenario.oxygenPct == null ? "unspecified" : `${scenario.oxygenPct}%`],
    ["Pressure", v(scenario.pressurePsi, "psia")],
    ["Gravity", v(scenario.gravityG, "g")],
    ["Airflow", v(scenario.airflowMs, "m/s")],
    ["Fuel", scenario.fuel ? FUEL_LABEL[scenario.fuel] : "unspecified"],
  ];
  return (
    <dl className="glance" aria-label="Scenario being answered">
      {items.map(([k, val]) => (
        <div key={k} className={val === "unspecified" ? "glance-item is-unset" : "glance-item"}>
          <dt>{k}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}

const Loading = () => <p className="muted small">Loading NASA run tables…</p>;

export function ScenarioLab() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [baseline, setBaseline] = useState<Scenario | null>(null);
  const [open, setOpen] = useState<TileId | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const [editing, setEditing] = useState(false);
  // #tour (linked from the landing page) opens the lab with the tour running.
  useEffect(() => {
    if (window.location.hash !== "#tour") return;
    history.replaceState(null, "", "#lab");
    setTour(true);
  }, []);
  const analysis = useAnalysis(scenario);

  const ranked = useMemo(() => rankInvestigations(scenario), [scenario]);
  const limits = useMemo(() => scenarioLimitations(scenario, ranked), [scenario, ranked]);
  const insight = useMemo(() => leadInsight(scenario, ranked), [scenario, ranked]);
  const shifts = useMemo(() => (baseline ? compareRankings(rankInvestigations(baseline), ranked) : null), [baseline, ranked]);
  const robust = useMemo(() => probeRobustness(scenario), [scenario]);
  const equipment = useMemo(() => equipmentGroups(scenario, ranked), [scenario, ranked]);
  const upcoming = useMemo(() => upcomingFor(scenario).filter((u) => u.relevant), [scenario]);

  const exportBrief = () => setBrief(buildBrief(scenario, ranked, limits));
  const dialog = (id: TileId) => ({ open: open === id, onClose: () => setOpen((cur) => (cur === id ? null : cur)) });

  // Lead with the result in plain words when the scenario sits above every test of its fuel type.
  const o2Gap = useMemo(() => oxygenGapForFuel(scenario), [scenario]);
  const plain = o2Gap && o2Gap.sameFuel[0].conditions.oxygenPct?.source === "psi-table" ? { lead: `NASA’s ${FUEL_PLAIN[o2Gap.fuel]} tests stop at ${o2Gap.maxForFuel}% oxygen.`, you: `Your habitat is at ${scenario.oxygenPct}%.` } : null;

  const ppo2 = ppo2VsEarth(scenario);
  const [gTitle] = GRAVITY_TEXT[gravityRegime(scenario.gravityG)];
  // The oxygen gap already leads the answer tile; show a different limit here.
  const keyLimit = (insight?.keyFinding ? limits.find((l) => l.id !== "o2-fuel-gap") : undefined) ?? limits[0];
  const probesHeld = robust.changesHeld + robust.removalsHeld + robust.weightsHeld;
  const probesTotal = robust.changesTotal + robust.removalsTotal + robust.weightProbes.length;
  const leadName = robust.lead ? getInvestigation(robust.lead)?.name ?? robust.lead : null;
  const o2Covered = ranked.filter((r) => r.conditions.find((c) => c.key === "oxygenPct")?.status === "match").length;
  const equipLinks = equipment.reduce((n, g) => n + g.links.length, 0);
  const pgCount = partialGravityCount(scenario);
  const design = useMemo(() => designQuestionsFor(scenario), [scenario]);
  const designApplies = design.filter((x) => x.applies);

  const presetLabel = PRESETS.find((p) => p.id === scenario.environment)?.label ?? "Custom habitat";
  const gapPts = o2Gap && scenario.oxygenPct != null ? +(scenario.oxygenPct - o2Gap.maxForFuel).toFixed(1) : null;
  const saffireAbove = o2Gap?.fuel === "solid" ? saffireRunsAbove(o2Gap.maxForFuel) : [];
  const otherFuelWords = o2Gap ? [...new Set(o2Gap.otherFuel.flatMap((i) => i.fuelTypes))].filter((f) => f !== o2Gap.fuel).map((f) => FUEL_NOUN[f]) : [];
  const chips = [
    scenario.oxygenPct == null ? null : `${scenario.oxygenPct}% O₂`,
    scenario.pressurePsi == null ? null : `${scenario.pressurePsi} psia`,
    scenario.gravityG == null ? null : `${scenario.gravityG} g`,
    scenario.airflowMs == null ? null : `${+(scenario.airflowMs * 100).toFixed(1)} cm/s`,
    scenario.fuel ? FUEL_LABEL[scenario.fuel] : null,
  ].filter(Boolean) as string[];
  const more: { id: TileId; label: string; stat: ReactNode }[] = [
    { id: "gap", label: "Where NASA tested", stat: "Every run-table row, oxygen against pressure" },
    { id: "limits", label: "What it can’t tell you", stat: `${limits.length} limit${limits.length === 1 ? "" : "s"} for this scenario` },
    { id: "robust", label: "Does the top match hold?", stat: leadName ? `${probesHeld} of ${probesTotal} probes keep ${leadName} on top` : "No ranking to test" },
    { id: "conditions", label: "Your oxygen and gravity", stat: ppo2 ? `${ppo2.kpa.toFixed(1)} kPa O₂ partial pressure · ${gTitle}` : gTitle },
    { id: "coverage", label: "Tested at your oxygen?", stat: scenario.oxygenPct == null ? "Set an oxygen level first" : `${o2Covered} of ${ranked.length} profiles include ${scenario.oxygenPct}%` },
    { id: "near", label: "Tests near your conditions", stat: "Single NASA tests close to your oxygen and pressure" },
    { id: "partial", label: "Moon and Mars results", stat: pgCount ? `${pgCount} NASA statements on partial gravity` : "Shown when gravity is between 0 and 1 g" },
    { id: "design", label: "Questions to ask of your design", stat: `${designApplies.length} of ${design.length} apply to this habitat` },
    { id: "equipment", label: "What the research informs", stat: `${equipLinks} links to equipment decisions${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}` },
    { id: "tables", label: "NASA run tables", stat: `${TABLE_ROWS.toLocaleString("en-US")} rows from ${TABLE_COUNT} tables` },
    { id: "earth", label: "Uses on Earth", stat: `${EARTH_LINKS.length} ground uses stated by NASA` },
  ];

  return (
    <main className="explore">
      <Rail>
        <section className="rail-card" id="habitat" aria-labelledby="habitat-h">
          <h2 className="rail-title" id="habitat-h">Your habitat</h2>
          <label className="sr-only" htmlFor="env-rail">Starting point</label>
          <select id="env-rail" className="pill-select" value={scenario.environment} onChange={(e) => setScenario(presetScenario(e.target.value as EnvironmentId, scenario))}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            {scenario.environment === "custom" && <option value="custom">Custom</option>}
          </select>
          <div className="chips">{chips.map((c) => <span key={c} className="chip-soft">{c}</span>)}</div>
          <button type="button" className="pill pill-dark" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? "Done editing" : "Edit conditions"}</button>
          {editing && <ScenarioPanel scenario={scenario} onChange={setScenario} onSaveBaseline={() => setBaseline(scenario)} hasBaseline={baseline != null} />}
        </section>

        <section className="rail-card rail-ask" aria-labelledby="ask-tile">
          <p className="rail-eyebrow">AI, every claim source-checked</p>
          <h2 className="rail-title" id="ask-tile">Ask EMBER</h2>
          <AskForm analysis={analysis} compact onSubmit={() => setOpen("ai")} />
          {analysis.result && !analysis.busy && (
            <button type="button" className="pill pill-accent pill-block" onClick={() => setOpen("ai")}>
              Open the last answer
              {analysis.result.report ? ` · ${analysis.result.report.receipt.acceptedClaims} of ${analysis.result.report.receipt.claims} claims kept` : ""}
            </button>
          )}
          <p className="rail-note">Every quote must appear word for word in its source and every number must trace to it. Claims that fail are shown as rejected, with the reason.</p>
        </section>
      </Rail>

      <Side>
        <section className="side-head" aria-labelledby="psi-h">
          <div className="side-head-row">
            <div>
              <h2 id="psi-h">NASA PSI data</h2>
              <p className="muted">Synced {PSI_SNAPSHOT.fetchedOn} · {TABLE_COUNT} tables</p>
            </div>
            <a className="round-btn dark" href={atlasCsvUrl} download={`ember-fire-test-atlas-${COUNTS.snapshot.id}.csv`} aria-label="Download the Fire Test Atlas (CSV)" title="Download the Fire Test Atlas (CSV)"><DownloadIcon size={16} /></a>
          </div>
          <dl className="side-stats">
            <div><dt>{COUNTS.observations.testRows.toLocaleString("en-US")}</dt><dd>NASA test rows</dd></div>
            <div><dt>{INVESTIGATIONS.length}</dt><dd>Studies ranked</dd></div>
            <div><dt>{AUDIT.totals.issues}</dt><dd>Data issues logged</dd></div>
          </dl>
        </section>

        <section className="panel-soft gap-card" aria-labelledby="gap-h">
          <p className="muted">Oxygen</p>
          <h2 id="gap-h">{gapPts != null ? "Evidence gap" : "Inside the tested range"}</h2>
          {gapPts != null && o2Gap ? (
            <>
              <p className="small">Distance from NASA’s highest {FUEL_PLAIN[o2Gap.fuel]} test to your habitat’s air.</p>
              <p className="big-num">{gapPts}<span>points O₂</span></p>
              {saffireAbove.length > 0 && (
                <p className="muted small">
                  {saffireAbove.length} Saffire sample{saffireAbove.length === 1 ? "" : "s"} published outside PSI went higher, up to {Math.max(...saffireAbove.map((r) => r.oxygenPct))}% O₂. EMBER shows them but does not score them.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="big-num">{o2Covered}<span>of {ranked.length} profiles</span></p>
              <p className="muted small">{scenario.oxygenPct == null ? "Set an oxygen level to compare it with each study’s range." : `have an oxygen range that includes ${scenario.oxygenPct}%.`}</p>
            </>
          )}
        </section>

        <section className="panel-soft rank-card" aria-labelledby="ranked-tile">
          <div className="section-head">
            <h2 id="ranked-tile">Closest studies</h2>
            <span className="tag tag-grey">Score / 100</span>
          </div>
          <ol className="pill-bars">
            {ranked.slice(0, 5).map((r, i) => (
              <li key={r.investigation.id}>
                <span className={i === 0 ? "pill-bar lead" : "pill-bar"} style={{ width: `${Math.max(r.total, 34)}%` }}>
                  <span className="pill-bar-name">{r.investigation.name}{r.group === "other" && <em> · other fuel</em>}</span>
                  <span className="pill-bar-score">{r.total}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="muted small">25 points for the safety question, 75 for conditions. A score selects evidence; it is not a probability.</p>
          <button type="button" className="text-link" onClick={() => setOpen("ranked")}>See all {ranked.length} matches and why each scored what it did</button>
        </section>
      </Side>

      <section className="stage" aria-label="Results for your scenario">
        <div className="stage-bar">
          <h1>{presetLabel} · oxygen coverage</h1>
          <div className="segmented" role="group" aria-label="Safety question">
            {(Object.keys(QUESTION_LABEL) as (keyof typeof QUESTION_LABEL)[]).map((q) => (
              <button key={q} type="button" aria-pressed={scenario.question === q} onClick={() => setScenario({ ...scenario, question: q })}>{QUESTION_LABEL[q]}</button>
            ))}
          </div>
        </div>

        <div className="stage-answer" aria-labelledby="answer-tile">
          <h2 className="sr-only" id="answer-tile">The short answer</h2>
          {insight ? (
            <p className="stage-headline">{plain ? <>{plain.lead} <span>{plain.you}</span></> : insight.title}</p>
          ) : (
            <p className="stage-headline">No NASA profile addresses this question. <span>Try including adjacent research.</span></p>
          )}
          {insight && (
            <p className="stage-sub">
              {plain && <span>Closest study: <strong>{insight.title}</strong></span>}
              <span className={`badge ${insight.fullCoverage ? "badge-ok" : "badge-warn"}`}>
                {insight.fullCoverage ? "All specified conditions recorded" : `${insight.gaps.length} condition${insight.gaps.length === 1 ? "" : "s"} not covered`}
              </span>{" "}
              <button type="button" className="text-link" onClick={() => setOpen("answer")}>Read the full answer</button>
            </p>
          )}
        </div>

        <OxygenStage scenario={scenario} gapPts={gapPts} />

        {shifts && <BaselineDiff shifts={shifts} onClear={() => setBaseline(null)} />}

        <div className="stage-foot">
          <div className="stage-note">
            {o2Gap && otherFuelWords.length > 0 ? (
              <>
                <p className="stage-note-title">The tests that reach {scenario.oxygenPct}% burned {otherFuelWords.join(" or ")}, not {FUEL_NOUN[o2Gap.fuel]}</p>
                <p className="muted small">That is analogue evidence. {scenario.gravityG != null && scenario.gravityG > 0 && scenario.gravityG < 1 ? "No stored PSI test ran in partial gravity." : "Open the map to see every row."}</p>
              </>
            ) : (
              <>
                <p className="stage-note-title">{keyLimit ? "The first limit that matters" : "No limits flagged"}</p>
                {keyLimit && <p className="muted small">{keyLimit.text}</p>}
              </>
            )}
            <button type="button" className="pill pill-accent" onClick={() => setOpen("gap")}>See the map of every test</button>
          </div>
          <div className="icon-grid" role="group" aria-label="Downloads and help">
            <button type="button" className="round-btn" aria-label="Download ranked data as CSV" title="Download ranked data as CSV" onClick={() => downloadText(`ember-data-${scenario.environment}.csv`, buildCsv(scenario, ranked), "text/csv")}><DownloadIcon size={16} /></button>
            <button type="button" className="round-btn" aria-label="Open the evidence brief" title="Open the evidence brief" onClick={exportBrief}><BriefIcon /></button>
            <button type="button" className="round-btn" aria-label="What this cannot tell you" title="What this cannot tell you" onClick={() => setOpen("limits")}><InfoIcon size={16} /></button>
            <button type="button" className="round-btn" aria-label="Take the one-minute tour" title="Take the one-minute tour" onClick={() => setTour(true)}><PlayIcon /></button>
          </div>
        </div>
      </section>

      <section className="panel-soft more-list" aria-labelledby="more-h">
        <div className="section-head">
          <h2 id="more-h">More about this habitat</h2>
          <a className="text-link" href="#credibility">How far can you trust this?</a>
        </div>
        <ul>
          {more.map((m) => (
            <li key={m.id} aria-labelledby={`${m.id}-tile`}>
              <button type="button" onClick={() => setOpen(m.id)} aria-haspopup="dialog">
                <span className="more-label" id={`${m.id}-tile`}>{m.label}</span>
                <span className="more-stat">{m.stat}</span>
                <span className="more-chev" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <TileDialog {...dialog("answer")} title="The short answer" lede="How well NASA's tests cover the scenario you set, and what they cannot tell you.">
        <ScenarioGlance scenario={scenario} />
        <InsightCard insight={insight} />
        <SummaryStrip scenario={scenario} relevant={ranked.length} total={INVESTIGATIONS.length} />
        <Limitations items={limits} />
      </TileDialog>
      <TileDialog {...dialog("ranked")} title="The evidence behind it" lede="Every investigation scored against your conditions. Open any row to see why it scored what it did.">
        <RankedList ranked={ranked} scenario={scenario} showRobustness={false} />
      </TileDialog>
      <TileDialog {...dialog("gap")} title="Where NASA actually tested" lede="Every NASA run-table row, oxygen against pressure from the same row.">
        <Suspense fallback={<Loading />}><GapMapPanel scenario={scenario} /></Suspense>
      </TileDialog>
      <TileDialog {...dialog("limits")} title="What this evidence cannot establish">
        <Limitations items={limits} open />
      </TileDialog>
      <TileDialog {...dialog("robust")} title="Ranking robustness" lede="The scenario re-ranked under small input changes, input removals and alternative point schemes.">
        <RobustnessBar scenario={scenario} initialOpen />
      </TileDialog>
      <TileDialog {...dialog("conditions")} title="Your conditions">
        <ScenarioGlance scenario={scenario} />
        <SummaryStrip scenario={scenario} relevant={ranked.length} total={INVESTIGATIONS.length} />
        <OxygenComparison scenario={scenario} />
        <GravityIllustration scenario={scenario} open />
      </TileDialog>
      <TileDialog {...dialog("coverage")} title="Parameter coverage" lede="Where each study's condition ranges sit against your scenario. Click a probe value to try it.">
        <CoverageChart scenario={scenario} onProbe={(key, value) => setScenario({ ...scenario, [key]: value, environment: "custom" })} />
      </TileDialog>
      <TileDialog {...dialog("near")} title="Measured near your scenario" lede="Individual NASA tests near your oxygen and pressure, counted from the Fire Test Atlas.">
        <Suspense fallback={<Loading />}><NearbyPanel scenario={scenario} /></Suspense>
      </TileDialog>
      <TileDialog {...dialog("ai")} title="Ask EMBER" lede="Ask about this scenario. EMBER checks each claim the model writes against the evidence it was given, and shows what it rejected and why.">
        <AnalysisCard analysis={analysis} />
      </TileDialog>
      <TileDialog {...dialog("tables")} title="NASA run tables" lede="The raw test conditions, so you can see the gaps yourself and take the rows into your own models.">
        <Suspense fallback={<Loading />}><TablesPanel ranked={ranked} /></Suspense>
      </TileDialog>
      <TileDialog {...dialog("equipment")} title="What this research informs">
        <EquipmentPanel scenario={scenario} ranked={ranked} />
      </TileDialog>
      <TileDialog {...dialog("partial")} title="Partial gravity: what NASA has reported" lede="Lunar and Mars gravity results from NASA technical reports, quoted word for word and checked against each PDF.">
        <PartialGravityPanel scenario={scenario} />
      </TileDialog>
      <TileDialog {...dialog("design")} title="Questions to ask of your design" lede="Design questions raised by NASA's evidence. Questions, not rules: open each to see the evidence behind it.">
        <DesignQuestions scenario={scenario} />
      </TileDialog>
      <TileDialog {...dialog("earth")} title="Fire safety on Earth">
        <EarthPanel />
      </TileDialog>

      <GuidedTour steps={LAB_TOUR} open={tour} onClose={() => setTour(false)} />
      {brief && <BriefDialog text={brief} filename={`ember-brief-${scenario.environment}.md`} onClose={() => setBrief(null)} />}
    </main>
  );
}
