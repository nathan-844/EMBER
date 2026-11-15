import { EARTH_LINKS } from "../data/applications";
import { getInvestigation } from "../data/investigations";
import { ExternalIcon } from "./icons";

/** NASA-stated applications of this PSI data to fire safety on Earth. */
export function EarthPanel() {
  return (
    <section className="card" aria-labelledby="earth-title">
      <p className="eyebrow">Fire safety on Earth</p>
      <h3 id="earth-title">Where the same research helps on the ground</h3>
      <p className="small muted">
        Each use below is quoted word for word from the "Research Impacts/Earth Benefits" section of the investigation's NASA PSI record.
      </p>
      <ul className="equip-list">
        {EARTH_LINKS.map((l) => (
          <li key={l.id}>
            <p className="equip-informs"><strong>{l.use}</strong> <span className="badge badge-ok">Stated by NASA</span></p>
            <div className="tags">
              {l.investigations.map((id) => {
                const inv = getInvestigation(id)!;
                return <a key={id} className="badge badge-psi" href={inv.psi.url ?? undefined} target="_blank" rel="noreferrer">{inv.name} · {inv.psi.accession} <ExternalIcon /></a>;
              })}
            </div>
            <details className="fold fold-inline">
              <summary><span>NASA's wording</span><span className="disclose" aria-hidden /></summary>
              <blockquote className="equip-quote">“{l.quote.text}”<cite>NASA {l.quote.accession} research impacts</cite></blockquote>
            </details>
          </li>
        ))}
      </ul>
      <p className="small muted">
        The challenge also mentions ISS fine-water-mist extinguishers. No combustion record in PSI covers water mist, so EMBER does not link one.
      </p>
    </section>
  );
}
