import { useMemo } from "react";
import { EQUIPMENT_LINKS } from "../data/applications";
import { AREA_TITLE, designQuestionsFor, type DesignEvidence } from "../data/design-questions";
import rawFindings from "../data/findings.json";
import { NTRS_QUOTES } from "../data/ntrs-evidence";
import type { Scenario } from "../lib/scenario";
import { NtrsQuoteBlock } from "./PartialGravityPanel";

const FINDINGS = (rawFindings as unknown as { findings: { id: string; title: string; claim: string }[] }).findings;

function Evidence({ e }: { e: DesignEvidence }) {
  if (e.kind === "ntrs") return <NtrsQuoteBlock q={NTRS_QUOTES.find((q) => q.id === e.quote)!} />;
  if (e.kind === "psi") {
    const l = EQUIPMENT_LINKS.find((x) => x.id === e.link)!;
    return (
      <blockquote className="equip-quote">
        “{l.quote.text}”
        <cite>NASA {l.quote.accession} {l.quote.field === "earthBenefits" ? "research impacts" : "objectives"}</cite>
      </blockquote>
    );
  }
  const f = FINDINGS.find((x) => x.id === e.id)!;
  return (
    <blockquote className="equip-quote finding-quote">
      {f.claim}
      <cite><a href={`#findings/${f.id}`}>Measured finding {f.id}: {f.title}</a> · computed by EMBER from NASA's rows</cite>
    </blockquote>
  );
}

/** Questions a designer could ask of their own habitat, each backed by checked NASA evidence. */
export function DesignQuestions({ scenario }: { scenario: Scenario }) {
  const items = useMemo(() => designQuestionsFor(scenario), [scenario]);
  const applies = items.filter((x) => x.applies).length;
  return (
    <section className="card equipment" aria-labelledby="dq-title">
      <p className="eyebrow">For designers · {applies} of {items.length} apply directly to your scenario</p>
      <h3 id="dq-title">Questions to ask of your design</h3>
      <p className="small muted">
        These are EMBER's questions, not instructions or safety rules: the evidence behind them comes from small samples, other fuels or other
        gravity levels. Each is backed by NASA text found word for word in its source, or by a finding computed from NASA's rows.
      </p>
      <ol className="dq-list">
        {items.map(({ q, applies }) => (
          <li key={q.id} className={applies ? "applies" : ""}>
            <details open={applies}>
              <summary>
                <span className="dq-q">{q.question}</span>
                <span className="dq-tags">
                  <span className="badge">{AREA_TITLE[q.area]}</span>
                  {applies && <span className="badge badge-ok">Applies: {q.appliesWhen.label}</span>}
                </span>
              </summary>
              <p className="small"><strong>Why ask:</strong> {q.why}</p>
              {q.evidence.map((e, i) => <Evidence key={i} e={e} />)}
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
