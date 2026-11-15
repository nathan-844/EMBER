import { gravityRegime, type Scenario } from "../lib/scenario";

function Candle({ kind }: { kind: "earth" | "micro" }) {
  return (
    <svg viewBox="0 0 60 110" width="54" height="100" aria-hidden>
      <rect x="22" y="70" width="16" height="36" rx="2" fill="#efe6d6" stroke="#d8ccb6" />
      <line x1="30" y1="70" x2="30" y2="62" stroke="#333" strokeWidth="1.5" />
      {kind === "earth" ? (
        <>
          <path d="M30 18 C40 40 40 58 30 66 C20 58 20 40 30 18Z" fill="#f7b44a" opacity="0.85" />
          <path d="M30 34 C35 46 35 58 30 63 C25 58 25 46 30 34Z" fill="#fff3c4" />
          <path d="M30 52 C33 56 33 62 30 64 C27 62 27 56 30 52Z" fill="#5b8bd8" opacity="0.6" />
          {[16, 24, 32].map((y, i) => <path key={i} d={`M30 ${y} l-4 -6 M30 ${y} l4 -6`} stroke="#c9b9a2" strokeWidth="1" opacity="0.5" />)}
        </>
      ) : (
        <>
          <path d="M14 64 A16 16 0 0 1 46 64" fill="none" stroke="#6f8de0" strokeWidth="5" opacity="0.55" />
          <path d="M19 64 A11 11 0 0 1 41 64" fill="none" stroke="#9db4f0" strokeWidth="3" opacity="0.6" />
          {[0, 45, 90, 135, 180].map((a) => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1={30 - Math.cos(r) * 26} y1={64 - Math.sin(r) * 26} x2={30 - Math.cos(r) * 20} y2={64 - Math.sin(r) * 20} stroke="#9aa6b2" strokeWidth="1" />;
          })}
        </>
      )}
    </svg>
  );
}

export function GravityIllustration({ scenario, open = false }: { scenario: Scenario; open?: boolean }) {
  const regime = gravityRegime(scenario.gravityG);
  return (
    <section className="card illus" aria-labelledby="illus-title">
      <details className="fold" open={open}>
      <summary>
        <div>
          <p className="eyebrow">Why gravity changes the evidence</p>
          <h3 id="illus-title">Without buoyancy, a candle flame changes shape</h3>
        </div>
        <span className="badge">Illustration</span>
        <span className="disclose" aria-hidden />
      </summary>
      <div className="sim-banner">Simulated · Qualitative illustration · Not NASA measurements</div>
      <div className="illus-grid">
        <div className="illus-cell">
          <Candle kind="earth" />
          <div><strong>Earth gravity</strong><p>Hot gas rises, drawing fresh air up past the wick into a tall, flickering teardrop.</p></div>
        </div>
        <div className={`illus-cell you ${regime}`}>
          <strong>Your scenario: {scenario.gravityG == null ? "unspecified" : `${scenario.gravityG} g`}</strong>
          {regime === "partial" ? (
            <p>No illustration is shown. Intermediate gravity is not an interpolation between these two pictures; some materials may burn at lower oxygen concentrations near lunar gravity.</p>
          ) : regime === "microgravity" ? (
            <p>Your scenario matches the microgravity case on the right.</p>
          ) : regime === "earth" ? (
            <p>Your scenario matches the Earth-gravity case on the left.</p>
          ) : (
            <p>Set gravity to place your scenario.</p>
          )}
        </div>
        <div className="illus-cell">
          <Candle kind="micro" />
          <div><strong>Microgravity, still air</strong><p>No rising plume. Oxygen arrives slowly by diffusion, leaving a small, dim blue, roughly hemispherical flame.</p></div>
        </div>
      </div>
      <p className="small muted">Candle-like example in still air. Solid sheets, droplets and gas jets, and any ventilation, behave differently; colors are artistic, not temperatures.</p>
      </details>
    </section>
  );
}
