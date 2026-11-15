import { useMemo } from "react";
import { AREA_LABEL } from "../data/applications";
import { getInvestigation } from "../data/investigations";
import { equipmentResults } from "../data/ntrs-evidence";
import { NtrsQuoteBlock } from "./PartialGravityPanel";
import { equipmentGroups, upcomingFor } from "../lib/equipment";
import type { RankedInvestigation } from "../lib/ranking";
import type { Scenario } from "../lib/scenario";
import { ExternalIcon } from "./icons";

/** Which next-generation detection, suppression, ventilation and material decisions the evidence informs. */
export function EquipmentPanel({ scenario, ranked }: { scenario: Scenario; ranked: RankedInvestigation[] }) {
  const groups = useMemo(() => equipmentGroups(scenario, ranked), [scenario, ranked]);
  const upcoming = useMemo(() => upcomingFor(scenario), [scenario]);

  return (
    <section className="card equipment" aria-labelledby="equipment-title">
      <p className="eyebrow">Next-generation fire-safety equipment</p>
      <h3 id="equipment-title">What this research informs</h3>
      <p className="small muted">
        Each link quotes the investigation's NASA PSI record word for word. "Stated by NASA" means NASA's text names the use;
        "EMBER's reading" means the link is our interpretation of what the study measured. Where NASA has published a result,
        it is quoted below the objective from the NASA Technical Reports Server, checked against the PDF. Studies in your current
        ranking are highlighted.
      </p>

      {groups.map((g) => (
        <details key={g.area} className="equip-group" open={g.forQuestion}>
          <summary>
            <span className="equip-area">{AREA_LABEL[g.area]}</span>
            {g.forQuestion && <span className="badge badge-ok">Your safety question</span>}
            <span className="small muted">{g.links.length} link{g.links.length === 1 ? "" : "s"}</span>
          </summary>
          <ul className="equip-list">
            {g.links.map((l) => (
              <li key={l.id}>
                <p className="equip-informs">
                  <strong>{l.informs}</strong>{" "}
                  <span className={`badge ${l.interpretation ? "badge-warn" : "badge-ok"}`}>{l.interpretation ? "EMBER's reading" : "Stated by NASA"}</span>
                </p>
                <div className="tags">
                  {l.investigations.map((id) => {
                    const inv = getInvestigation(id)!;
                    return (
                      <a key={id} className={`badge badge-psi ${l.ranked.includes(id) ? "in-rank" : ""}`} href={inv.psi.url ?? undefined} target="_blank" rel="noreferrer"
                        title={l.ranked.includes(id) ? "In your current ranking" : "Not in your current ranking"}>
                        {inv.name} · {inv.psi.accession} <ExternalIcon />
                      </a>
                    );
                  })}
                </div>
                <blockquote className="equip-quote">
                  “{l.quote.text}”
                  <cite>NASA {l.quote.accession} {l.quote.field === "earthBenefits" ? "research impacts" : "objectives"}</cite>
                </blockquote>
                {equipmentResults(l.id).map((q) => (
                  <div key={q.id} className="equip-result">
                    <p className="small"><span className="badge badge-ok">Published result</span></p>
                    <NtrsQuoteBlock q={q} />
                  </div>
                ))}
                <p className="small muted"><strong>Not covered:</strong> {l.caveat}</p>
              </li>
            ))}
          </ul>
        </details>
      ))}

      <h4 className="explorer-h equip-upcoming-h">Evidence on the way</h4>
      <ul className="equip-list">
        {upcoming.map((u) => (
          <li key={u.id} className={u.relevant ? "upcoming relevant" : "upcoming"}>
            <p className="equip-informs">
              <strong>{u.name}</strong>{" "}
              {u.relevant
                ? <span className="badge badge-ok">Would close a gap in your scenario</span>
                : <span className="badge">Not needed for this scenario</span>}
            </p>
            <p className="small">{u.what} <span className="muted">{u.why}</span></p>
            <blockquote className="equip-quote">
              “{u.quote.text}”
              <cite><a href={u.quote.url} target="_blank" rel="noreferrer">{u.quote.source} <ExternalIcon /></a></cite>
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
