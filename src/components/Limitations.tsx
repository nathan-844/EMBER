import type { Limitation } from "../lib/limitations";
import { InfoIcon } from "./icons";

export function Limitations({ items }: { items: Limitation[] }) {
  return (
    <section className="card warm">
      <h3 className="with-icon"><InfoIcon /> What this evidence cannot establish</h3>
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
    </section>
  );
}
