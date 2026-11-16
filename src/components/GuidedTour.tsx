import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  /** CSS selector of the element to point at; the first visible match is used. */
  target: string;
  title: string;
  body: string;
}

export const LAB_TOUR: TourStep[] = [
  {
    target: "#habitat",
    title: "Describe your habitat",
    body: "Pick a preset, such as NASA's 8.2 psia / 34% O₂ exploration atmosphere, or set oxygen, pressure, gravity, airflow and fuel yourself. Leave anything you don't know blank: it earns no points rather than a guess.",
  },
  {
    target: '[aria-labelledby="answer-tile"]',
    title: "The short answer",
    body: "How much of your scenario NASA's tests cover, and the first gap that matters. For a Moon base: no solid-material test in PSI goes above 22.2% oxygen.",
  },
  {
    target: '[aria-labelledby="ranked-tile"]',
    title: "Ranked NASA evidence",
    body: "Every investigation scored against your inputs out of 100. Open it to see why each scored what it did, its rank range if the scoring weights move ±20%, its NASA PSI record and a NASA photo.",
  },
  {
    target: '[aria-labelledby="gap-tile"]',
    title: "Where NASA tested",
    body: "Every row of NASA's run tables, oxygen against pressure, with your scenario marked. The empty space around it is the gap.",
  },
  {
    target: '[aria-labelledby="partial-tile"]',
    title: "Moon and Mars",
    body: "PSI holds no partial-gravity runs yet, so this quotes what NASA's technical reports have found at lunar and Martian gravity, each checked against the PDF.",
  },
  {
    target: '[aria-labelledby="ask-tile"]',
    title: "Ask EMBER",
    body: "An AI answer in which every quote must appear word for word in its source and every number must trace to it. Claims that fail are shown as rejected, with the reason.",
  },
  {
    target: '[aria-labelledby="equipment-tile"]',
    title: "What the research informs",
    body: "Links to detection, suppression, ventilation and material decisions, each quoting NASA's record, with the published result where there is one.",
  },
  {
    target: 'a[href="#credibility"]',
    title: "How far to trust it",
    body: "The Credibility page lists every check EMBER runs, with totals, and what is still not established. Click a box on the dashboard any time for the full detail.",
  },
];

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** A step-by-step spotlight over the page. Esc closes; arrow keys move between steps. */
export function GuidedTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = [...document.querySelectorAll(step.target)].find(visible);
    setRect(el ? el.getBoundingClientRect() : null);
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step]);

  useEffect(() => { if (open) setI(0); }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = [...document.querySelectorAll(step.target)].find(visible);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    measure();
    const t = window.setTimeout(measure, reduce ? 0 : 450);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    card.current?.focus();
    return () => { window.clearTimeout(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open) return null;
  const pad = 6;
  const W = window.innerWidth, H = window.innerHeight, CW = 360, gap = 14;
  const narrow = W < 640;
  const ch = cardH || 240;
  const clampTop = (t: number) => Math.max(16, Math.min(t, H - ch - 16));
  let cardStyle: React.CSSProperties = {};
  if (rect && !narrow) {
    if (H - rect.bottom >= ch + gap + 16) cardStyle = { top: rect.bottom + gap, left: Math.max(16, Math.min(rect.left, W - CW - 16)) };
    else if (rect.top >= ch + gap + 16) cardStyle = { top: rect.top - gap - ch, left: Math.max(16, Math.min(rect.left, W - CW - 16)) };
    else if (W - rect.right >= CW + gap + 16) cardStyle = { top: clampTop(rect.top), left: rect.right + gap };
    else if (rect.left >= CW + gap + 16) cardStyle = { top: clampTop(rect.top), left: rect.left - gap - CW };
    else cardStyle = { top: H - ch - 16, left: Math.max(16, Math.min(rect.left, W - CW - 16)) };
  }
  const last = i === steps.length - 1;

  return createPortal(
    <div className="tour" role="presentation">
      <div className="tour-block" onClick={onClose} />
      {rect && (
        <div className="tour-spot" aria-hidden
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      )}
      <div ref={card} className={`tour-card ${narrow ? "is-sheet" : ""}`} style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1}>
        <p className="eyebrow">Tour · {i + 1} of {steps.length}</p>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-progress" aria-hidden>{steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
        <div className="tour-actions">
          <button type="button" className="link-btn" onClick={onClose}>{last ? "Close" : "Skip tour"}</button>
          <span>
            {i > 0 && <button type="button" className="btn" onClick={() => setI(i - 1)}>Back</button>}{" "}
            <button type="button" className="btn btn-primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "Done" : "Next"}</button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
