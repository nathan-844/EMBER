import { useLayoutEffect, useRef, useState } from "react";
import { FlameIcon } from "./icons";
import type { Route } from "./AppShell";

const REPO = "https://github.com/nathan-844/EMBER";

const TOP_NAV: { route: Route; label: string; also?: Route[] }[] = [
  { route: "lab", label: "Explore" },
  { route: "findings", label: "Findings" },
  { route: "mission", label: "Analyze", also: ["compare", "research"] },
  { route: "data", label: "Data" },
  { route: "credibility", label: "Credibility" },
];

/** The navigation bar across the top of every page, with a glass pill that slides to the item you point at. */
export function TopBar({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  const current = TOP_NAV.findIndex((n) => route === n.route || n.also?.includes(route));
  const [hover, setHover] = useState<number | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover ?? (current >= 0 ? current : null);

  useLayoutEffect(() => {
    const measure = () => {
      const b = shown == null ? null : buttons.current[shown];
      setPill(b ? { left: b.offsetLeft, width: b.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    // Web fonts can change button widths after first paint.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [shown]);

  return (
    <header className="top-bar">
      <a className="brand" href="#home" aria-label="EMBER home" onClick={(e) => { e.preventDefault(); onNavigate("home"); }}>
        <span className="brand-mark"><FlameIcon size={18} /></span>
        <span className="brand-name">EMBER</span>
      </a>
      <nav className="top-nav" aria-label="Main" onPointerLeave={() => setHover(null)}>
        <span
          className={`nav-glass${hover != null ? " is-hover" : ""}${shown === current ? " is-current" : ""}`}
          aria-hidden="true"
          style={pill ? { left: pill.left, width: pill.width, opacity: 1 } : { opacity: 0 }}
        />
        {TOP_NAV.map((n, i) => (
          <button
            key={n.route}
            ref={(el) => { buttons.current[i] = el; }}
            type="button"
            aria-current={i === current ? "page" : undefined}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => onNavigate(n.route)}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <a className="pill pill-soft" href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
      {route === "home" && <button type="button" className="pill pill-dark" onClick={() => onNavigate("lab")}>Launch EMBER</button>}
    </header>
  );
}
