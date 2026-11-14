import { useMemo, useState } from "react";
import { INVESTIGATIONS } from "../data/investigations";
import { CoverageChart } from "../components/CoverageChart";
import { InsightCard } from "../components/InsightCard";
import { Limitations } from "../components/Limitations";
import { RankedList } from "../components/RankedList";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { SummaryStrip } from "../components/SummaryStrip";
import { leadInsight, scenarioLimitations } from "../lib/limitations";
import { rankInvestigations } from "../lib/ranking";
import { DEFAULT_SCENARIO, type Scenario } from "../lib/scenario";

export function ScenarioLab() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [baseline, setBaseline] = useState<Scenario | null>(null);
  const ranked = useMemo(() => rankInvestigations(scenario), [scenario]);
  const limits = useMemo(() => scenarioLimitations(scenario, ranked), [scenario, ranked]);
  const insight = useMemo(() => leadInsight(scenario, ranked), [scenario, ranked]);

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Mission scenario lab</p>
        <h1>Turn combustion evidence into <span>fire-safety insight.</span></h1>
        <p className="muted">Define your environment. Examine what NASA's research can tell you.</p>
      </header>
      <div className="lab-grid">
        <ScenarioPanel scenario={scenario} onChange={setScenario} onSaveBaseline={() => setBaseline(scenario)} hasBaseline={baseline != null} />
        <div className="lab-main">
          <SummaryStrip scenario={scenario} relevant={ranked.length} total={INVESTIGATIONS.length} />
          <InsightCard insight={insight} />
          <CoverageChart scenario={scenario} onProbe={(key, value) => setScenario({ ...scenario, [key]: value, environment: "custom" })} />
          <RankedList ranked={ranked} scenario={scenario} />
          <Limitations items={limits} />
        </div>
      </div>
    </main>
  );
}
