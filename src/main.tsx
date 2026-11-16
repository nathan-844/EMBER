import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./redesign.css";
import "./polish.css";
import { startPointer } from "./lib/pointer";
import { startReveal } from "./lib/reveal";

startReveal();
startPointer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
