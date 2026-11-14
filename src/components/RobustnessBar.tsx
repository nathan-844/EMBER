import { useMemo, useState } from "react";
import { getInvestigation } from "../data/investigations";
import { CONDITION_LABELS } from "../lib/ranking";
import { probeRobustness } from "../lib/robustness";
import type { Scenario } from "../lib/scenario";

export function RobustnessBar({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => probeRobustness(scenario), [scenario]);
  if (!report.lead) return null;
  const leadName = getInvestigation(report.lead)?.name ?? report.lead;
  return (
    <div className="robust">
      <button className="robust-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="eyebrow">Ranking robustness</span>
        <span>
          Top match <strong>{leadName}</strong> unchanged under {report.changesHeld} of {report.changesTotal} small input changes ·{" "}
          {report.removalsHeld} of {report.removalsTotal} input removals
        </span>
        {report.dependsOn.length > 0 && (
          <span><strong>Lead depends on:</strong> {report.dependsOn.map((k) => CONDITION_LABELS[k]).join(", ")}</span>
        )}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <table className="probe-table">
          <thead><tr><th>Probe</th><th>Lead after</th><th>Result</th></tr></thead>
          <tbody>
            {report.probes.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                <td>{p.leadAfter ? getInvestigation(p.leadAfter)?.name : "—"}</td>
                <td className={p.unchanged ? "ok" : "bad"}>{p.unchanged ? "Held" : "Changed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">Probes test the ranking rule near your inputs, not the underlying experiments.</p>
    </div>
  );
}
