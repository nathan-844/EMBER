import { useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";

interface TipState {
  x: number;
  y: number;
  value: string;
  label: string;
}

/**
 * One tooltip per chart. `bind(value, label)` makes a mark hoverable and focusable; the tooltip
 * shows the same text that the table view and the mark's accessible name carry, so it never gates.
 */
export function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const place = (el: Element, value: string, label: string) => {
    const box = ref.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    setTip({ x: r.left + r.width / 2 - box.left, y: r.top - box.top, value, label });
  };
  const bind = (value: string, label: string) => ({
    tabIndex: 0,
    role: "img" as const,
    "aria-label": `${label}: ${value}`,
    onPointerEnter: (e: PointerEvent<Element>) => place(e.currentTarget, value, label),
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent<Element>) => place(e.currentTarget, value, label),
    onBlur: () => setTip(null),
  });
  const node: ReactNode = tip ? (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="presentation">
      <strong>{tip.value}</strong>
      <span>{tip.label}</span>
    </div>
  ) : null;
  return { ref, bind, node };
}
