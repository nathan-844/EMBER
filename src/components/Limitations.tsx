import type { Limitation } from "../lib/limitations";
import { InfoIcon } from "./icons";

/** Collapsed by default; the summary keeps the count visible next to the answer. */
export function Limitations({ items, open = false }: { items: Limitation[]; open?: boolean }) {
  return (
    <section className="card warm limits-card" aria-labelledby="limits-title">
      <details className="fold" open={open}>
        <summary>
          <h3 id="limits-title" className="with-icon"><InfoIcon /> What this evidence cannot establish</h3>
          <span className="badge badge-warn">{items.length} limit{items.length === 1 ? "" : "s"}</span>
          <span className="disclose" aria-hidden />
        </summary>
        <ul className="limits">
          {items.map((l) => (
            <li key={l.id} className={l.id === "o2-fuel-gap" ? "key-limit" : undefined}>
              {l.text}
              {l.source && <> <a className="small" href={l.source.href} target="_blank" rel="noreferrer">Source: {l.source.label}</a></>}
            </li>
          ))}
        </ul>
        <p className="small muted">
          Challenge context: <a href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" target="_blank" rel="noreferrer">Space Apps · Flame in Freefall</a>
        </p>
      </details>
    </section>
  );
}
