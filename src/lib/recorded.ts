import type { Scenario } from "./scenario";

/** Longest question a visitor may type for "Ask EMBER". */
export const ASK_MAX = 300;

/**
 * One-click questions. They work for any scenario; for the unedited presets their answers
 * are recorded through the live pipeline (scripts/record-demo.ts), so they replay instantly.
 */
export const SUGGESTED_ASKS = [
  "Why is the top match ranked first, and what does it not cover?",
  "What has NASA measured closest to my oxygen and pressure?",
  "Which gaps in the evidence matter most for this scenario?",
  "What does this evidence mean for fire detection or suppression equipment?",
] as const;

/**
 * Tidy a typed question: drop control characters, collapse whitespace, trim.
 * Returns null when there is no question and undefined when the input is not acceptable.
 */
export function cleanAsk(raw: unknown): string | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== "string") return undefined;
  const text = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length < 3 || text.length > ASK_MAX) return undefined;
  return text;
}

/** Key for a scenario plus an optional question (case-insensitive), for recordings and the cache. */
export function analysisKey(s: Scenario, ask?: string | null): string {
  return ask ? `${scenarioKey(s)}|ask:${ask.toLowerCase()}` : scenarioKey(s);
}

/**
 * Stable key for a scenario: only the fields that change the ranking or the evidence
 * package, in a fixed order. Used to replay recorded analyses when no API key is set.
 */
export function scenarioKey(s: Scenario): string {
  return JSON.stringify([
    s.environment,
    s.question,
    s.oxygenPct,
    s.pressurePsi,
    s.gravityG,
    s.airflowMs,
    s.fuel,
    s.material,
    s.thicknessMm,
    s.flowDirection,
    s.includeAdjacent,
  ]);
}
