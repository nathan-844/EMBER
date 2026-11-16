import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PSI_SNAPSHOT } from "../data/psi";
import rawFindings from "../data/findings.json";
import { ChartIcon, FlameIcon, ShieldIcon, SlidersIcon, TableIcon } from "./icons";
import type { Route } from "./AppShell";

const FINDING_COUNT = (rawFindings as { findings: unknown[] }).findings.length;

type Slots = { rail: HTMLElement | null; side: HTMLElement | null };
const SlotContext = createContext<Slots>({ rail: null, side: null });

/** Puts its children in the left rail, under the navigation. */
export function Rail({ children }: { children: ReactNode }) {
  const { rail } = useContext(SlotContext);
  return rail ? createPortal(children, rail) : null;
}

/** Puts its children in the right-hand column beside the main panel. */
export function Side({ children }: { children: ReactNode }) {
  const { side } = useContext(SlotContext);
  return side ? createPortal(children, side) : null;
}

const AnalyzeIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h7M4 17h7M17 4v6M14 7h6M14 17h6" />
  </svg>
);

const NAV: { route: Route; label: string; icon: ReactNode; also?: Route[] }[] = [
  { route: "lab", label: "Explore", icon: <SlidersIcon /> },
  { route: "findings", label: "Findings", icon: <ChartIcon /> },
  { route: "mission", label: "Analyze", icon: <AnalyzeIcon />, also: ["compare", "research"] },
  { route: "data", label: "Data", icon: <TableIcon /> },
  { route: "credibility", label: "How we know", icon: <ShieldIcon /> },
];

const TOOLS: { route: Route; label: string; hint: string }[] = [
  { route: "mission", label: "Change the air", hint: "Which tests still apply from A to B" },
  { route: "compare", label: "Compare two materials", hint: "BASS-II carbon monoxide" },
  { route: "research", label: "Comparison workbench", hint: "Your own comparison, checked" },
];

type Props = { route: Route; onNavigate: (route: Route) => void; recordCount: number; children: ReactNode };

/**
 * Every page except the landing page: a left rail with the navigation, one large central panel,
 * and an optional column on the right. Pages fill the rail and the right column with <Rail> and <Side>.
 */
export function Workspace({ route, onNavigate, recordCount, children }: Props) {
  const [rail, setRail] = useState<HTMLElement | null>(null);
  const [side, setSide] = useState<HTMLElement | null>(null);
  const analyze = route === "mission" || route === "compare" || route === "research";

  return (
    <SlotContext.Provider value={{ rail, side }}>
      <div className="frame">
        <aside className="ws-rail">
          <div className="rail-card rail-nav-card">
            <a className="brand" href="#home" aria-label="EMBER home" onClick={() => onNavigate("home")}>
              <span className="brand-mark"><FlameIcon size={18} /></span>
              <span className="brand-name">EMBER</span>
            </a>
            <nav className="rail-nav" aria-label="Main">
              {NAV.map((n) => {
                const on = route === n.route || n.also?.includes(route);
                return (
                  <button key={n.route} type="button" aria-current={on ? "page" : undefined} onClick={() => onNavigate(n.route)}>
                    {n.icon}
                    <span>{n.label}</span>
                    {n.route === "findings" && !on && <span className="rail-count">{FINDING_COUNT}</span>}
                    {on && <span className="rail-chev" aria-hidden="true">›</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          {analyze && (
            <div className="rail-card">
              <p className="rail-eyebrow">Three ways to analyze</p>
              <h2 className="rail-title">Tools</h2>
              <div className="rail-list">
                {TOOLS.map((t) => (
                  <button key={t.route} type="button" className={route === t.route ? "rail-pill on" : "rail-pill"} aria-current={route === t.route ? "page" : undefined} onClick={() => onNavigate(t.route)}>
                    <strong>{t.label}</strong>
                    <span>{t.hint}</span>
                  </button>
                ))}
              </div>
              <p className="rail-note">Counts are test rows, not independent experiments. How much evidence exists says nothing about whether a material is safe.</p>
            </div>
          )}

          <div className="ws-rail-slot" ref={setRail} />

          <p className="rail-foot">
            <a className="status-dot" href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer" title="Records stored from the NASA PSI repository">NASA PSI · synced {PSI_SNAPSHOT.fetchedOn}</a>
            <span>Research prototype · {recordCount} NASA investigations. Not a NASA product.</span>
          </p>
        </aside>

        <div className="ws-centre">{children}</div>

        <aside className="ws-side" ref={setSide} />
      </div>

      <nav className="tabbar" aria-label="Main, short">
        {NAV.map((n) => (
          <button key={n.route} type="button" aria-current={route === n.route || n.also?.includes(route) ? "page" : undefined} onClick={() => onNavigate(n.route)}>{n.label}</button>
        ))}
      </nav>
    </SlotContext.Provider>
  );
}
