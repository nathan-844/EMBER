import type { ReactNode } from "react";
import { PSI_SNAPSHOT } from "../data/psi";
import { FlameIcon, ShieldIcon, SlidersIcon } from "./icons";

export type Route = "lab" | "credibility";

type Props = {
  route: Route;
  onNavigate: (route: Route) => void;
  recordCount: number;
  children: ReactNode;
};

export function AppShell({ route, onNavigate, recordCount, children }: Props) {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#lab" onClick={() => onNavigate("lab")}>
          <span className="brand-mark"><FlameIcon size={17} /></span>
          <span className="brand-name">EMBER</span>
          <span className="brand-sub">FIRE<br />SAFETY<br />RESEARCH</span>
        </a>
        <nav className="nav" aria-label="Main">
          <button aria-current={route === "lab" ? "page" : undefined} onClick={() => onNavigate("lab")}>
            <SlidersIcon /> Scenario lab
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
