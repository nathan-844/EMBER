import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Workspace } from "./Workspace";

export type Route = "home" | "lab" | "findings" | "compare" | "research" | "mission" | "data" | "credibility";

type Props = {
  route: Route;
  onNavigate: (route: Route) => void;
  recordCount: number;
  children: ReactNode;
};

export function AppShell({ route, onNavigate, recordCount, children }: Props) {
  if (route !== "home") return <Workspace route={route} onNavigate={onNavigate} recordCount={recordCount}>{children}</Workspace>;

  // The landing page has the navigation across the top, with the story below it.
  return (
    <div className="frame frame-home">
      <TopBar route={route} onNavigate={onNavigate} />
      {children}
    </div>
  );
}
