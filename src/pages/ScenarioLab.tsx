import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { EARTH_LINKS } from "../data/applications";
import { getInvestigation, INVESTIGATIONS } from "../data/investigations";
import manifest from "../data/table-manifest.json";
import { BriefDialog } from "../components/BriefDialog";
import { BaselineDiff } from "../components/BaselineDiff";
import { Tile, TileDialog } from "../components/Bento";
import { CoverageChart } from "../components/CoverageChart";
import { EarthPanel } from "../components/EarthPanel";
import { EquipmentPanel } from "../components/EquipmentPanel";
import { GravityIllustration } from "../components/GravityIllustration";
import { AnalysisCard, AskForm } from "../components/AnalysisCard";
import { useAnalysis } from "../components/useAnalysis";
import { InsightCard } from "../components/InsightCard";
import { Limitations } from "../components/Limitations";
import { RankedList } from "../components/RankedList";
import { RobustnessBar } from "../components/RobustnessBar";
import { QuickScenario, ScenarioPanel } from "../components/ScenarioPanel";
import { GRAVITY_TEXT, SummaryStrip } from "../components/SummaryStrip";
import { buildBrief, buildCsv, downloadText } from "../lib/brief";
import { compareRankings } from "../lib/compare";
import { equipmentGroups, upcomingFor } from "../lib/equipment";
import { DownloadIcon } from "../components/icons";
import { leadInsight, scenarioLimitations } from "../lib/limitations";
import { rankInvestigations } from "../lib/ranking";
import { probeRobustness } from "../lib/robustness";
import { DEFAULT_SCENARIO, gravityRegime, oxygenPartialPressure, PRESETS, type Scenario } from "../lib/scenario";

// These read every stored NASA run table, so they load on demand.
const GapPreview = lazy(() => import("../components/GapPreview"));
const GapMapPanel = lazy(() => import("../components/DataExplorer").then((m) => ({ default: m.GapMapPanel })));
const NearbyStat = lazy(() => import("../components/Nearby").then((m) => ({ default: m.NearbyStat })));
const NearbyPanel = lazy(() => import("../components/Nearby").then((m) => ({ default: m.NearbyPanel })));
const TablesPanel = lazy(() => import("../components/DataExplorer").then((m) => ({ default: m.TablesPanel })));

const QUESTION_LABEL = { prevention: "Prevention", detection: "Detection", suppression: "Suppression" } as const;
const FUEL_LABEL = { solid: "Solid material", liquid: "Liquid", gas: "Gas" } as const;
const TABLE_COUNT = manifest.tables.length;
/** Tables that actually feed the ranked oxygen, pressure and airflow ranges. */
const RANKED_TABLES = new Set(INVESTIGATIONS.flatMap((i) => Object.values(i.conditions).filter((r) => r?.source === "psi-table").map((r) => r!.table))).size;
const TABLE_ROWS = manifest.tables.reduce((n, t) => n + t.rows, 0);

type TileId = "answer" | "ranked" | "gap" | "limits" | "robust" | "conditions" | "coverage" | "near" | "tables" | "ai" | "equipment" | "earth";

const VERDICT_TEXT = { accepted: "all claims passed the check", partial: "some claims rejected", rejected: "answer rejected" } as const;

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

const Stat = ({ value, unit, children }: { value: ReactNode; unit?: string; children: ReactNode }) => (
  <>
    <p className="tile-stat">{value}{unit && <small> {unit}</small>}</p>
    <p className="tile-text">{children}</p>
  </>
);

const Loading = () => <p className="muted small">Loading NASA run tables…</p>;

export function ScenarioLab() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [baseline, setBaseline] = useState<Scenario | null>(null);
  const [open, setOpen] = useState<TileId | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const analysis = useAnalysis(scenario);

  const ranked = useMemo(() => rankInvestigations(scenario), [scenario]);
  const limits = useMemo(() => scenarioLimitations(scenario, ranked), [scenario, ranked]);
  const insight = useMemo(() => leadInsight(scenario, ranked), [scenario, ranked]);
  const shifts = useMemo(() => (baseline ? compareRankings(rankInvestigations(baseline), ranked) : null), [baseline, ranked]);
  const robust = useMemo(() => probeRobustness(scenario), [scenario]);
  const equipment = useMemo(() => equipmentGroups(scenario, ranked), [scenario, ranked]);
  const upcoming = useMemo(() => upcomingFor(scenario).filter((u) => u.relevant), [scenario]);

  const exportBrief = () => setBrief(buildBrief(scenario, ranked, limits));
  const tile = (id: TileId) => ({ id, onOpen: () => setOpen(id) });
  const dialog = (id: TileId) => ({ open: open === id, onClose: () => setOpen((cur) => (cur === id ? null : cur)) });

  const ppo2 = oxygenPartialPressure(scenario);
  const [gTitle, gNote] = GRAVITY_TEXT[gravityRegime(scenario.gravityG)];
  // The oxygen gap already leads the answer tile; show a different limit here.
  const keyLimit = (insight?.keyFinding ? limits.find((l) => l.id !== "o2-fuel-gap") : undefined) ?? limits[0];
  const probesHeld = robust.changesHeld + robust.removalsHeld + robust.weightsHeld;
  const probesTotal = robust.changesTotal + robust.removalsTotal + robust.weightProbes.length;
  const leadName = robust.lead ? getInvestigation(robust.lead)?.name ?? robust.lead : null;
  const o2Covered = ranked.filter((r) => r.conditions.find((c) => c.key === "oxygenPct")?.status === "match").length;
  const equipLinks = equipment.reduce((n, g) => n + g.links.length, 0);
  const equipForQuestion = equipment.filter((g) => g.forQuestion).reduce((n, g) => n + g.links.length, 0);

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-text">
          <h1>Which NASA fire research applies to <span>your crew habitat?</span></h1>
          <p className="hero-lede">
            Set the cabin conditions in the scenario panel. EMBER ranks {INVESTIGATIONS.length} NASA combustion investigations against them
            with condition ranges read from {RANKED_TABLES} of {TABLE_COUNT} stored NASA run tables, and says plainly where the data stops. Click any box for the full detail.{" "}
            <a href="#credibility">How far can you trust this?</a>
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={exportBrief}><DownloadIcon /> Evidence brief</button>
          <button className="btn" onClick={() => downloadText(`ember-data-${scenario.environment}.csv`, buildCsv(scenario, ranked), "text/csv")} title="Ranked investigations with each condition range and its NASA source, for modelling">
            <DownloadIcon /> Data (.csv)
          </button>
        </div>
      </header>

      <div className="lab-grid">
        <ScenarioPanel scenario={scenario} onChange={setScenario} onSaveBaseline={() => setBaseline(scenario)} hasBaseline={baseline != null} />

        <div className="lab-main">
          <QuickScenario scenario={scenario} onChange={setScenario} />
          {shifts && <BaselineDiff shifts={shifts} onClear={() => setBaseline(null)} />}

          <section className="bento" aria-label="Results for your scenario">
            <Tile {...tile("answer")} size="2x2" tone="answer" eyebrow="The short answer" title={insight ? "What the evidence says" : "No matching research"}>
              {insight ? (
                <>
                  <p className="tile-headline">{insight.title}</p>
                  {insight.keyFinding && <p className="tile-clamp tile-text"><strong>Key finding:</strong> {insight.keyFinding}</p>}
                  <p className="tile-tags">
                    <span className={`badge ${insight.fullCoverage ? "badge-ok" : "badge-warn"}`}>
                      {insight.fullCoverage ? "All specified conditions recorded" : `${insight.gaps.length} condition${insight.gaps.length === 1 ? "" : "s"} not covered`}
                    </span>
                  </p>
                </>
              ) : (
                <p className="tile-text">No profile addresses this question. Try including adjacent research.</p>
              )}
            </Tile>

            <article className="tile tile-2x2 tile-ask" aria-labelledby="ask-tile">
              <p className="tile-eyebrow">Ask EMBER · AI with every quote and number checked</p>
              <h3 className="tile-title" id="ask-tile">Ask a question about this scenario</h3>
              <AskForm analysis={analysis} compact onSubmit={() => setOpen("ai")} />
              <div className="ask-foot">
                {analysis.result && !analysis.busy ? (
                  <button type="button" className="link-btn ask-open" onClick={() => setOpen("ai")}>
                    Open the last answer
                    {analysis.result.report ? ` · ${analysis.result.report.receipt.acceptedClaims} of ${analysis.result.report.receipt.claims} claims kept, ${VERDICT_TEXT[analysis.result.report.verdict]}` : ""}
                  </button>
                ) : (
                  <p className="tile-text muted">Every quote must appear word for word in its source and every number must trace to it; findings must quote NASA, and safety conclusions are refused. This checks the sources, not the reasoning. Claims that fail are shown as rejected, with the reason.</p>
                )}
              </div>
            </article>

            <Tile {...tile("ranked")} size="2x2" eyebrow="Ranked evidence" title={`Best matches of ${ranked.length}`}>
              <ol className="mini-rank">
                {ranked.slice(0, 7).map((r) => (
                  <li key={r.investigation.id}>
                    <span className="mini-name">{r.investigation.name}{r.group === "other" && <em> · other fuel</em>}</span>
                    <span className="mini-bar" aria-hidden><span style={{ width: `${r.total}%` }} /></span>
                    <span className="mini-score">{r.total}</span>
                  </li>
                ))}
              </ol>
              <p className="tile-text muted">Score out of 100: 25 for the safety question, 75 for conditions.</p>
            </Tile>

            <Tile {...tile("gap")} size="2x2" eyebrow="Where NASA tested" title="Gap map">
              <Suspense fallback={<Loading />}><GapPreview scenario={scenario} /></Suspense>
            </Tile>

            <Tile {...tile("limits")} tone="warn" eyebrow="Limits" title="What it can't tell you">
              <Stat value={limits.length}>{keyLimit ? keyLimit.text : "No limits flagged for this scenario."}</Stat>
            </Tile>

            <Tile {...tile("robust")} eyebrow="Robustness" title="Does the top match hold?">
              {leadName ? (
                <Stat value={`${probesHeld}/${probesTotal}`}>probes keep <strong>{leadName}</strong> on top when inputs or weights shift.</Stat>
              ) : (
                <p className="tile-text">No ranking to test.</p>
              )}
            </Tile>

            <Tile {...tile("conditions")} eyebrow="Your conditions" title="Oxygen and gravity">
              <Stat value={ppo2 == null ? "—" : ppo2.toFixed(2)} unit="psia O₂">partial pressure. Gravity: <strong>{gTitle}</strong>. {gNote}.</Stat>
            </Tile>

            <Tile {...tile("coverage")} eyebrow="Parameter coverage" title="Tested at your oxygen?">
              {scenario.oxygenPct == null ? (
                <p className="tile-text">Set an oxygen level to compare it with each study's range.</p>
              ) : (
                <Stat value={`${o2Covered}/${ranked.length}`}>ranked profiles have an oxygen range that includes {scenario.oxygenPct}%.</Stat>
              )}
            </Tile>


            <Tile {...tile("near")} eyebrow="Measured nearby" title="Tests near your conditions">
              <Suspense fallback={<Loading />}><NearbyStat scenario={scenario} /></Suspense>
            </Tile>

            <Tile {...tile("tables")} size="2x1" eyebrow="NASA run tables" title="Browse the raw data">
              <Stat value={TABLE_ROWS.toLocaleString("en-US")} unit="rows">from {TABLE_COUNT} NASA PSI tables. See what each study varied and measured; download rows.</Stat>
            </Tile>

            <Tile {...tile("equipment")} eyebrow="Equipment" title="What it informs">
              <Stat value={equipLinks}>
                links to detection, suppression, ventilation and material decisions{equipForQuestion ? `; ${equipForQuestion} for ${QUESTION_LABEL[scenario.question].toLowerCase()}` : ""}.
                {upcoming.length > 0 && ` ${upcoming.length} upcoming stud${upcoming.length === 1 ? "y" : "ies"} would close a gap.`}
              </Stat>
            </Tile>

            <Tile {...tile("earth")} eyebrow="On Earth" title="Ground uses">
              <Stat value={EARTH_LINKS.length}>uses on Earth stated by NASA, from smoke detectors to wildfire models.</Stat>
            </Tile>
          </section>
        </div>
      </div>

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
      <TileDialog {...dialog("earth")} title="Fire safety on Earth">
        <EarthPanel />
      </TileDialog>

      {brief && <BriefDialog text={brief} filename={`ember-brief-${scenario.environment}.md`} onClose={() => setBrief(null)} />}
    </main>
  );
}
