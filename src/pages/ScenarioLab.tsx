import { lazy, Suspense, useMemo, useState } from "react";
import { INVESTIGATIONS } from "../data/investigations";
import { BriefDialog } from "../components/BriefDialog";
import { BaselineDiff } from "../components/BaselineDiff";
import { CoverageChart } from "../components/CoverageChart";
import { GravityIllustration } from "../components/GravityIllustration";
import { AnalysisCard } from "../components/AnalysisCard";
import { InsightCard } from "../components/InsightCard";
import { Limitations } from "../components/Limitations";
import { RankedList } from "../components/RankedList";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { SummaryStrip } from "../components/SummaryStrip";
import { buildBrief, buildCsv, downloadText } from "../lib/brief";
import { compareRankings } from "../lib/compare";
import { DownloadIcon } from "../components/icons";
import { leadInsight, scenarioLimitations } from "../lib/limitations";
import { rankInvestigations } from "../lib/ranking";
import { DEFAULT_SCENARIO, type Scenario } from "../lib/scenario";

const DataExplorer = lazy(() => import("../components/DataExplorer"));

export function ScenarioLab() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [baseline, setBaseline] = useState<Scenario | null>(null);
  const ranked = useMemo(() => rankInvestigations(scenario), [scenario]);
  const limits = useMemo(() => scenarioLimitations(scenario, ranked), [scenario, ranked]);
  const insight = useMemo(() => leadInsight(scenario, ranked), [scenario, ranked]);
  const shifts = useMemo(() => (baseline ? compareRankings(rankInvestigations(baseline), ranked) : null), [baseline, ranked]);
  const [brief, setBrief] = useState<string | null>(null);
  const exportBrief = () => setBrief(buildBrief(scenario, ranked, limits));

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Mission scenario lab</p>
          <h1>Turn combustion evidence into <span>fire-safety insight.</span></h1>
          <p className="muted">Define your environment. Examine what NASA's research can tell you.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={exportBrief}><DownloadIcon /> Export evidence brief</button>
          <button className="btn" onClick={() => downloadText(`ember-data-${scenario.environment}.csv`, buildCsv(scenario, ranked), "text/csv")} title="Ranked investigations with each condition range and its NASA source, for modelling">
            <DownloadIcon /> Data (.csv)
          </button>
        </div>
      </header>
      <div className="trust-strip small">
        <span>{INVESTIGATIONS.length} investigation profiles · {INVESTIGATIONS.filter((i) => Object.values(i.conditions).some((r) => r?.source === "psi-table")).length} with ranges from NASA run tables</span>
        <span>Scores are transparent: 25 question + 75 conditions, same fuel listed first</span>
        <a href="#credibility">How far can you trust this? →</a>
      </div>
      <div className="lab-grid">
        <ScenarioPanel scenario={scenario} onChange={setScenario} onSaveBaseline={() => setBaseline(scenario)} hasBaseline={baseline != null} />
        <div className="lab-main">
          <SummaryStrip scenario={scenario} relevant={ranked.length} total={INVESTIGATIONS.length} />
          {shifts && <BaselineDiff shifts={shifts} onClear={() => setBaseline(null)} />}
          <InsightCard insight={insight} />
          <AnalysisCard scenario={scenario} />
          <GravityIllustration scenario={scenario} />
          <CoverageChart scenario={scenario} onProbe={(key, value) => setScenario({ ...scenario, [key]: value, environment: "custom" })} />
          <RankedList ranked={ranked} scenario={scenario} />
          <Suspense fallback={<section className="card"><p className="muted">Loading NASA run tables…</p></section>}>
            <DataExplorer scenario={scenario} ranked={ranked} />
          </Suspense>
          <Limitations items={limits} />
        </div>
      </div>
      {brief && <BriefDialog text={brief} filename={`ember-brief-${scenario.environment}.md`} onClose={() => setBrief(null)} />}
    </main>
  );
}
