import type { RankShift } from "../lib/compare";

type Props = { shifts: RankShift[]; onClear: () => void };

export function BaselineDiff({ shifts, onClear }: Props) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Compared with your baseline</p>
          <h3>{shifts.length === 0 ? "No score changes" : `${shifts.length} investigation score${shifts.length > 1 ? "s" : ""} changed`}</h3>
        </div>
        <button className="btn" onClick={onClear}>Clear baseline</button>
      </div>
      {shifts.length > 0 && (
        <table className="probe-table">
          <thead><tr><th>Investigation</th><th>Baseline</th><th>Now</th><th>Change</th></tr></thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.before ?? "not ranked"}</td>
                <td>{s.after ?? "not ranked"}</td>
                <td className={s.delta > 0 ? "ok" : "bad"}>{s.delta > 0 ? "+" : ""}{s.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
