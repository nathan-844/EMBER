import { useEffect, useRef, type ReactNode } from "react";
import { PSI_SNAPSHOT } from "../data/psi";
import { ChartIcon, FlameIcon, ShieldIcon, SlidersIcon, TableIcon } from "./icons";

export type Route = "home" | "lab" | "findings" | "compare" | "research" | "mission" | "data" | "credibility";

type Props = {
  route: Route;
  onNavigate: (route: Route) => void;
  recordCount: number;
  children: ReactNode;
};

export function AppShell({ route, onNavigate, recordCount, children }: Props) {
  // On a phone the nav scrolls sideways; keep the current page's tab in view.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current, current = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && current) el.scrollLeft = Math.max(0, current.offsetLeft - el.offsetLeft - (el.clientWidth - current.offsetWidth) / 2);
  }, [route]);
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="EMBER home" onClick={() => onNavigate("home")}>
          <span className="brand-mark"><FlameIcon size={17} /></span>
          <span className="brand-name">EMBER</span>
          <span className="brand-sub">FIRE<br />SAFETY<br />RESEARCH</span>
        </a>
        <nav className="nav" aria-label="Main" ref={nav}>
          <button aria-current={route === "lab" ? "page" : undefined} onClick={() => onNavigate("lab")}>
            <SlidersIcon /> Scenario lab
          </button>
          <button aria-current={route === "findings" ? "page" : undefined} onClick={() => onNavigate("findings")}>
            <ChartIcon /> Findings
          </button>
          <button aria-current={route === "compare" ? "page" : undefined} onClick={() => onNavigate("compare")}>
            <ChartIcon /> Compare
          </button>
          <button aria-current={route === "research" ? "page" : undefined} onClick={() => onNavigate("research")}>
            <ChartIcon /> Workbench
          </button>
          <button aria-current={route === "mission" ? "page" : undefined} onClick={() => onNavigate("mission")}>
            <SlidersIcon /> Mission
          </button>
          <button aria-current={route === "data" ? "page" : undefined} onClick={() => onNavigate("data")}>
            <TableIcon /> Data
          </button>
          <button aria-current={route === "credibility" ? "page" : undefined} onClick={() => onNavigate("credibility")}>
            <ShieldIcon /> Credibility
          </button>
          <a className="status-dot" href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer" title="Records stored from the NASA PSI repository">NASA PSI · synced {PSI_SNAPSHOT.fetchedOn}</a>
        </nav>
      </header>
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>NASA PSI evidence / Human space exploration</span>
        <span>Research prototype · {recordCount} investigation profiles</span>
      </nav>
      {children}
    </>
  );
}
