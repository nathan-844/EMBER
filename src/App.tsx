import { useEffect, useState } from "react";
import { AppShell, type Route } from "./components/AppShell";

function readRoute(): Route {
  return window.location.hash === "#credibility" ? "credibility" : "lab";
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = next;
    setRoute(next);
  };

  return (
    <AppShell route={route} onNavigate={navigate} recordCount={0}>
      <main className="page">{route === "lab" ? "Scenario lab" : "Credibility"}</main>
    </AppShell>
  );
}
