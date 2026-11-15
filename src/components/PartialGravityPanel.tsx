import { useMemo } from "react";
import manifest from "../data/ntrs-manifest.json";
import { ntrsShort, ntrsSource, ntrsUrl, sourceTag, partialGravityEvidence, quotesFor, type NtrsQuote } from "../data/ntrs-evidence";
import type { Scenario } from "../lib/scenario";
import { ExternalIcon } from "./icons";

const PAGES = manifest.quotes as Record<string, { page: number | null }>;

const GROUPS: { id: string; title: string; match: (q: NtrsQuote) => boolean }[] = [
  { id: "results", title: "What the tests found", match: (q) => q.finding === "more flammable" || q.finding === "mixed" },
  { id: "method", title: "How it was tested, and its limits", match: (q) => q.finding === "method" },
  { id: "planned", title: "On the way", match: (q) => q.finding === "planned" },
];

export function NtrsQuoteBlock({ q }: { q: NtrsQuote }) {
  const s = ntrsSource(q.source);
  const page = PAGES[q.id]?.page;
  return (
    <blockquote className="equip-quote">
      “{q.text}”
      <cite>
        <a href={ntrsUrl(s.id)} target="_blank" rel="noreferrer">
          {ntrsShort(s.id)}, {s.title} <ExternalIcon />
        </a>{" "}
        · {s.kind}, {s.venue} · {sourceTag(s.id)}{page ? `, p. ${page}` : ""}
      </cite>
    </blockquote>
  );
}

/** Count for the tile: partial-gravity statements relevant to this scenario's gravity. */
export function partialGravityCount(scenario: Scenario): number {
  return partialGravityEvidence(scenario.gravityG).length;
}

/** NASA's published lunar- and Mars-gravity results, which the PSI repository does not hold yet. */
export function PartialGravityPanel({ scenario }: { scenario: Scenario }) {
  const relevant = useMemo(() => partialGravityEvidence(scenario.gravityG), [scenario.gravityG]);
  const shown = relevant.length ? relevant : quotesFor("partial-gravity");
  const level = scenario.gravityG != null && scenario.gravityG >= 0.27 ? "Martian" : "lunar";
  const sources = new Set(shown.map((q) => q.source)).size;

  return (
    <section className="card equipment" aria-labelledby="pg-title">
      <p className="eyebrow">Partial gravity · NASA technical reports, not PSI</p>
      <h3 id="pg-title">{relevant.length ? `What NASA has reported at ${level} gravity` : "What NASA has reported at partial gravity"}</h3>
      <p className="small muted">
        The PSI repository holds no lunar or Martian gravity runs yet, so no ranked study covers your gravity. These statements come from {sources} NASA
        reports on the NASA Technical Reports Server. Each is quoted word for word and checked against the PDF, whose SHA-256 and page EMBER records.
        They are shown beside the ranking and never scored in it.
      </p>
      {!relevant.length && (
        <p className="small"><strong>Your scenario is not at partial gravity.</strong> Set gravity between 0 and 1 g (the Moon is about 0.17 g, Mars 0.38 g) to filter these to your level.</p>
      )}
      {GROUPS.map((g) => {
        const items = shown.filter(g.match);
        if (!items.length) return null;
        return (
          <div key={g.id} className="pg-group">
            <h4 className="explorer-h">{g.title}</h4>
            <ul className="equip-list">
              {items.map((q) => (
                <li key={q.id}>
                  {q.finding === "mixed" && <p className="equip-informs"><span className="badge badge-warn">Not every material</span></p>}
                  <NtrsQuoteBlock q={q} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="small muted">
        <strong>EMBER's reading:</strong> the reports agree that Earth-gravity screening tests and microgravity data do not settle how a material burns at
        partial gravity, and that the effect depends on the material. That is why EMBER reports gravity as a gap rather than treating 0 g or 1 g data as covering it.
      </p>
    </section>
  );
}
