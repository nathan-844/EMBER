import type { ReactNode } from "react";
import { PSI_SNAPSHOT } from "../data/psi";
import { DATA_STEP, STORY, storyIndex, storyNext, storyStep, type StoryRoute } from "../lib/story";
import { FlameIcon } from "./icons";

export type Route = "home" | "lab" | "findings" | "compare" | "research" | "mission" | "data" | "credibility";

type Props = {
  route: Route;
  onNavigate: (route: Route) => void;
  recordCount: number;
  children: ReactNode;
};

/** Compare and the workbench belong to the "Move to the Moon" step. */
const storyRouteOf = (route: Route): StoryRoute => (route === "compare" || route === "research" ? "mission" : route);

const ANALYZE: { route: Route; label: string }[] = [
  { route: "mission", label: "Change the air" },
  { route: "compare", label: "Compare two materials" },
  { route: "research", label: "Comparison workbench" },
];

const TABS: { route: Route; label: string }[] = [
  { route: "home", label: "Start" },
  { route: "lab", label: "Answer" },
  { route: "findings", label: "Findings" },
  { route: "mission", label: "Moon" },
  { route: "credibility", label: "Proof" },
];

export function AppShell({ route, onNavigate, recordCount, children }: Props) {
  const current = storyRouteOf(route);
  const index = storyIndex(current);
  const step = storyStep(current);
  const next = storyNext(current);
  return (
    <>
      <div className="frame">
        <aside className="side">
          <div className="side-card">
            <a className="brand" href="#home" aria-label="EMBER home" onClick={() => onNavigate("home")}>
              <span className="brand-mark"><FlameIcon size={20} /></span>
              <span className="brand-name">EMBER</span>
            </a>
            <span className="side-phone-tag">Fire safety evidence<br />for crews beyond Earth</span>
            <p className="brand-tag">Fire safety evidence for crews beyond Earth</p>
            <p className="side-label">The story, in five steps</p>
            <nav className="story-nav" aria-label="Main">
              {STORY.map((s, i) => (
                <div key={s.route}>
                  <button type="button" aria-current={current === s.route ? "page" : undefined} className={index > i ? "is-done" : undefined} onClick={() => onNavigate(s.route)}>
                    <span className="step-n" aria-hidden="true">{i + 1}</span>
                    <span className="step-text">{s.label}<small>{s.hint}</small></span>
                  </button>
                  {s.route === "mission" && current === "mission" && (
                    <div className="side-sub">
                      {ANALYZE.map((a) => (
                        <button key={a.route} type="button" aria-current={route === a.route ? "true" : undefined} onClick={() => onNavigate(a.route)}>{a.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" aria-current={current === "data" ? "page" : undefined} onClick={() => onNavigate("data")}>
                <span className="step-n" aria-hidden="true">+</span>
                <span className="step-text">{DATA_STEP.label}<small>{DATA_STEP.hint}</small></span>
              </button>
            </nav>
          </div>
          <div className="side-card side-foot-card">
            <div className="side-foot">
              <a className="status-dot" href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer" title="Records stored from the NASA PSI repository">NASA PSI data · synced {PSI_SNAPSHOT.fetchedOn}</a>
              <span>Research prototype · {recordCount} NASA investigations. It does not predict fire behaviour and is not a NASA product.</span>
            </div>
          </div>
        </aside>

        <div className="frame-main">
          {current !== "home" && (
            <div className="story-bar" role="note" aria-label="Where you are in the story">
              <span className="story-chip">{current === "data" ? "Beyond the story" : `Step ${index + 1} of ${STORY.length}`} · {step.label}</span>
              <p className="story-plain"><strong>In plain words:</strong> {step.plain}</p>
              {current !== "data" && (
                <span className="story-dots" aria-hidden="true">
                  {STORY.map((s, i) => <span key={s.route} className={i === index ? "on" : i < index ? "past" : undefined} />)}
                </span>
              )}
            </div>
          )}
          {children}
          <aside className="story-next" aria-label="Next step">
            <div>
              <p className="next-eyebrow">{next.eyebrow}</p>
              <p className="next-title">{next.title}</p>
            </div>
            <a href={next.href}>{next.action} →</a>
          </aside>
        </div>
      </div>

      <nav className="tabbar" aria-label="Main, short">
        {TABS.map((t) => (
          <button key={t.route} type="button" aria-current={current === storyRouteOf(t.route) ? "page" : undefined} onClick={() => onNavigate(t.route)}>{t.label}</button>
        ))}
      </nav>
    </>
  );
}
