import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell, type Route } from "./components/AppShell";
import { INVESTIGATIONS } from "./data/investigations";
import { Credibility } from "./pages/Credibility";
import { Data } from "./pages/Data";
import { Findings } from "./pages/Findings";
import { Landing } from "./pages/Landing";
import { ScenarioLab } from "./pages/ScenarioLab";

const Compare = lazy(() => import("./pages/Compare"));

function readRoute(): Route {
  const hash = window.location.hash;
  // The landing page is the front door; any other hash (such as #scenario) belongs to the lab.
  if (hash === "" || hash === "#" || hash === "#home") return "home";
  if (hash === "#compare" || hash.startsWith("#compare?")) return "compare";
  if (hash === "#findings" || hash.startsWith("#findings/")) return "findings";
  if (hash === "#data" || hash.startsWith("#data/")) return "data";
  return hash === "#credibility" ? "credibility" : "lab";
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // A new page starts at the top (the landing page's lower buttons would otherwise open the lab mid-scroll).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const navigate = (next: Route) => {
    window.location.hash = next === "home" ? "" : next;
    setRoute(next);
  };

  return (
    <AppShell route={route} onNavigate={navigate} recordCount={INVESTIGATIONS.length}>
      {route === "compare" ? <Suspense fallback={<main className="page" role="status">Loading comparison…</main>}><Compare /></Suspense> : route === "home" ? <Landing /> : route === "lab" ? <ScenarioLab /> : route === "findings" ? <Findings /> : route === "data" ? <Data /> : <Credibility />}
    </AppShell>
  );
}
