import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PSI_SNAPSHOT } from "../data/psi";
import { TopBar } from "./TopBar";
import type { Route } from "./AppShell";

type Slots = { rail: HTMLElement | null; side: HTMLElement | null };
const SlotContext = createContext<Slots>({ rail: null, side: null });

/** Puts its children in the left rail. */
export function Rail({ children }: { children: ReactNode }) {
  const { rail } = useContext(SlotContext);
  return rail ? createPortal(children, rail) : null;
}

/** Puts its children in the right-hand column beside the main panel. */
export function Side({ children }: { children: ReactNode }) {
  const { side } = useContext(SlotContext);
  return side ? createPortal(children, side) : null;
}

const NAV: { route: Route; label: string; also?: Route[] }[] = [
  { route: "lab", label: "Explore" },
  { route: "findings", label: "Findings" },
  { route: "mission", label: "Analyze", also: ["compare", "research"] },
  { route: "data", label: "Data" },
  { route: "credibility", label: "Credibility" },
];

const TOOLS: { route: Route; label: string; hint: string }[] = [
  { route: "mission", label: "Check a material", hint: "Do its fire tests apply in your habitat’s air?" },
  { route: "compare", label: "Compare two materials", hint: "BASS-II carbon monoxide" },
  { route: "research", label: "Comparison workbench", hint: "Your own comparison, checked" },
];

type Props = { route: Route; onNavigate: (route: Route) => void; recordCount: number; children: ReactNode };

/**
 * Every page except the landing page: the top bar, a left rail for page controls, one large central panel,
 * and an optional column on the right. Pages fill the rail and the right column with <Rail> and <Side>.
 */
export function Workspace({ route, onNavigate, recordCount, children }: Props) {
  const [rail, setRail] = useState<HTMLElement | null>(null);
  const [side, setSide] = useState<HTMLElement | null>(null);
  const analyze = route === "mission" || route === "compare" || route === "research";

  return (
    <SlotContext.Provider value={{ rail, side }}>
      <div className="frame">
        <TopBar route={route} onNavigate={onNavigate} />
        <aside className="ws-rail">
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
            </div>
          )}

          <div className="ws-rail-slot" ref={setRail} />
        </aside>

        <div className="ws-centre">{children}</div>

        <aside className="ws-side" ref={setSide} />

        <footer className="ws-foot">
          <a className="status-dot" href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer" title="Records stored from the NASA PSI repository">NASA PSI · synced {PSI_SNAPSHOT.fetchedOn}</a>
          <span>Research prototype · {recordCount} NASA investigations. Not a NASA product.</span>
        </footer>
      </div>

      <nav className="tabbar" aria-label="Main, short">
        {NAV.map((n) => (
          <button key={n.route} type="button" aria-current={route === n.route || n.also?.includes(route) ? "page" : undefined} onClick={() => onNavigate(n.route)}>{n.label}</button>
        ))}
      </nav>
    </SlotContext.Provider>
  );
}
