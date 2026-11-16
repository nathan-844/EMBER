import type { ReactNode } from "react";
import { FlameIcon } from "./icons";
import { Workspace } from "./Workspace";

export type Route = "home" | "lab" | "findings" | "compare" | "research" | "mission" | "data" | "credibility";

type Props = {
  route: Route;
  onNavigate: (route: Route) => void;
  recordCount: number;
  children: ReactNode;
};

const REPO = "https://github.com/nathan-844/EMBER";

const TOP_NAV: { route: Route; label: string }[] = [
  { route: "lab", label: "Explore" },
  { route: "findings", label: "Findings" },
  { route: "mission", label: "Analyze" },
  { route: "data", label: "Data" },
  { route: "credibility", label: "How we know" },
];

export function AppShell({ route, onNavigate, recordCount, children }: Props) {
  if (route !== "home") return <Workspace route={route} onNavigate={onNavigate} recordCount={recordCount}>{children}</Workspace>;

  // The landing page has the navigation across the top, with the story below it.
  return (
    <div className="frame frame-home">
      <header className="top-bar">
        <a className="brand" href="#home" aria-label="EMBER home">
          <span className="brand-mark"><FlameIcon size={18} /></span>
          <span className="brand-name">EMBER</span>
        </a>
        <nav className="top-nav" aria-label="Main">
          {TOP_NAV.map((n) => <button key={n.route} type="button" onClick={() => onNavigate(n.route)}>{n.label}</button>)}
        </nav>
        <a className="pill pill-soft" href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
        <button type="button" className="pill pill-dark" onClick={() => onNavigate("lab")}>Launch EMBER</button>
      </header>
      {children}
    </div>
  );
}
