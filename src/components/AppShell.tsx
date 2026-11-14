import type { ReactNode } from "react";
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
          <span className="status-dot">Local evidence</span>
        </nav>
      </header>
      <div className="crumbs">
        <span>NASA PSI evidence / Human space exploration</span>
        <span>Research prototype · {recordCount} investigation profiles</span>
      </div>
      {children}
    </>
  );
}
