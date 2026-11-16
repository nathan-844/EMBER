// Scroll reveal and count-up for the polish layer (src/polish.css).
//
// Sections fade up as they scroll into view, and headline numbers count up from zero the first
// time they are seen. Content is only hidden once this script has run (html.motion), so the page
// still reads in full without JavaScript, in print, and under prefers-reduced-motion.

const REVEAL = [
  ".landing > section",
  ".landing > .land-top .land-stats > div",
  ".land-steps li",
  ".stage-foot > *",
  ".more-list",
  ".f-tile",
  ".findings-list > *",
  ".ws-centre > main.page > *",
  ".ws-side > *",
  ".ws-rail-slot > *",
].join(",");

const COUNT = ".land-stats dt, .big-num";
const seen = new WeakSet<Element>();

function countUp(el: Element) {
  // Only a leading plain number (with optional thousands commas and decimals) is animated; the rest of the element is left alone.
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const text = node.textContent ?? "";
  const m = text.match(/^(\s*)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(.*)$/s);
  if (!m) return;
  const [, lead, intPart, frac = "", tail] = m;
  const target = Number(intPart.replace(/,/g, "") + frac);
  if (!Number.isFinite(target) || target === 0) return;
  const decimals = frac ? frac.length - 1 : 0;
  const commas = intPart.includes(",");
  const fmt = (v: number) => {
    const s = v.toFixed(decimals);
    return commas ? Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s;
  };
  const start = performance.now();
  const dur = 1100;
  let written = text;
  const tick = (now: number) => {
    // If React has re-rendered this number meanwhile, stop and leave its value alone.
    if (node.textContent !== written) return;
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 4);
    written = t < 1 ? lead + fmt(target * eased) + tail : text; // end on the exact original text
    node.textContent = written;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function startReveal(): () => void {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  document.documentElement.classList.add("motion");

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        e.target.querySelectorAll(COUNT).forEach(countUp);
        if (e.target.matches(COUNT)) countUp(e.target);
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  const scan = () => {
    let i = 0;
    document.querySelectorAll(REVEAL).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      // Stagger siblings that arrive together, capped so long lists do not drag.
      (el as HTMLElement).style.setProperty("--reveal-delay", `${Math.min(i++, 6) * 0.06}s`);
      el.classList.add("reveal");
      io.observe(el);
    });
    // Numbers outside any revealed section (the Explore stats, for example) still count up once.
    document.querySelectorAll(COUNT).forEach((el) => {
      if (seen.has(el) || el.closest(".reveal")) return;
      seen.add(el);
      io.observe(el);
    });
  };

  let queued = false;
  const mo = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  });
  mo.observe(document.body, { childList: true, subtree: true });
  scan();

  return () => { mo.disconnect(); io.disconnect(); document.documentElement.classList.remove("motion"); };
}
