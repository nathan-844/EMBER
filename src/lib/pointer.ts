// Mouse-reactive surfaces for the polish layer (src/polish.css).
//
// Cards get a soft light that follows the cursor (--mx, --my), and a few tiles tilt slightly
// toward it (--rx, --ry). Only for a fine pointer that can hover; touch screens and
// prefers-reduced-motion get the static look. One listener on the document, one frame per move.

const GLOW = ".panel-soft, .rail-card, .stage, .stage-note, .stage-actions, .chat-card, .f-tile, .more-list button, .land-steps li, .land-stats > div, .finding, .top-bar, .tile-dialog-inner";
const TILT = ".f-tile, .land-steps li, .land-stats > div";
const MAX_TILT = 5; // degrees

export function startPointer(): () => void {
  if (typeof window === "undefined") return () => {};
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches) return () => {};

  let glowEl: HTMLElement | null = null;
  let tiltEl: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;

  const clearTilt = () => {
    if (!tiltEl) return;
    tiltEl.style.removeProperty("--rx");
    tiltEl.style.removeProperty("--ry");
    tiltEl.classList.remove("is-tilting");
    tiltEl = null;
  };

  const update = () => {
    frame = 0;
    const e = last;
    if (!e) return;
    const target = e.target instanceof Element ? e.target : null;

    // The innermost glowing surface under the cursor gets the light.
    const g = target?.closest<HTMLElement>(GLOW) ?? null;
    if (g !== glowEl) { glowEl?.classList.remove("is-lit"); glowEl = g; g?.classList.add("is-lit"); }
    if (g) {
      const r = g.getBoundingClientRect();
      g.style.setProperty("--mx", `${e.clientX - r.left}px`);
      g.style.setProperty("--my", `${e.clientY - r.top}px`);
    }

    const t = reduce.matches ? null : target?.closest<HTMLElement>(TILT) ?? null;
    if (t !== tiltEl) clearTilt();
    if (t) {
      tiltEl = t;
      const r = t.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      t.style.setProperty("--ry", `${(px * MAX_TILT * 2).toFixed(2)}deg`);
      t.style.setProperty("--rx", `${(-py * MAX_TILT * 2).toFixed(2)}deg`);
      t.classList.add("is-tilting");
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    last = e;
    if (!frame) frame = requestAnimationFrame(update);
  };
  const onLeave = () => { glowEl?.classList.remove("is-lit"); glowEl = null; clearTilt(); };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  document.documentElement.classList.add("pointer-fx");

  return () => {
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    document.documentElement.classList.remove("pointer-fx");
    cancelAnimationFrame(frame);
  };
}
