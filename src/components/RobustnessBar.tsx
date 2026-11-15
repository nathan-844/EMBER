import { useMemo, useState } from "react";
import { getInvestigation } from "../data/investigations";
import { CONDITION_LABELS } from "../lib/ranking";
import { probeRobustness } from "../lib/robustness";
import type { Scenario } from "../lib/scenario";

export function RobustnessBar({ scenario, initialOpen = false }: { scenario: Scenario; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const report = useMemo(() => probeRobustness(scenario), [scenario]);
  if (!report.lead) return null;
  const leadName = getInvestigation(report.lead)?.name ?? report.lead;
  return (
    <div className="robust">
      <button className="robust-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="eyebrow">Ranking robustness</span>
        <span>
          Top match <strong>{leadName}</strong> unchanged under {report.changesHeld} of {report.changesTotal} small input changes ·{" "}
          {report.removalsHeld} of {report.removalsTotal} input removals ·{" "}
          {report.weightsHeld} of {report.weightProbes.length} alternative point schemes
        </span>
        {report.dependsOn.length > 0 && (
          <span><strong>Lead depends on:</strong> {report.dependsOn.map((k) => CONDITION_LABELS[k]).join(", ")}</span>
        )}
        <span className="robust-toggle" aria-hidden>{open ? "Hide probes ▴" : "Show probes ▾"}</span>
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
            {report.weightProbes.map((p) => (
              <tr key={p.id}>
                <td>Weights: {p.label}</td>
                <td>{p.leadAfter ? getInvestigation(p.leadAfter)?.name : "—"}</td>
                <td className={p.unchanged ? "ok" : "bad"}>{p.unchanged ? "Held" : "Changed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">Probes test the ranking rule near your inputs and under other plausible point schemes, not the underlying experiments. The default weights were chosen, not fitted to expert rankings.</p>
    </div>
  );
}
