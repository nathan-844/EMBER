import { useCallback, useEffect, useState } from "react";
import type { GroundingReport } from "../lib/grounding";
import { analysisKey, AWAITING_RECORDING, cleanAsk } from "../lib/recorded";
import type { Scenario } from "../lib/scenario";

export interface AnalysisResult {
  model?: string;
  generatedAt?: string;
  ms?: number;
  attempts?: number;
  report?: GroundingReport;
  recorded?: boolean;
  cached?: boolean;
  /** The question this answers; absent for a whole-scenario analysis. */
  ask?: string;
  error?: string;
}

export type AiStatus = {
  enabled: boolean;
  provider?: string | null;
  model: string | null;
  recorded?: number;
  limits?: { perVisitor: number; windowMinutes: number; daily: number } | null;
  server: boolean;
};

type Recorded = Record<string, AnalysisResult>;

/**
 * State for the grounded AI analysis and "Ask EMBER", shared by the dashboard tile and its
 * detail dialog. With a live model it calls /api/analyze; without one it replays answers
 * recorded through the same pipeline for the unedited presets (and their suggested questions).
 */
export function useAnalysis(scenario: Scenario) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [forKey, setForKey] = useState<string | null>(null);
  const key = JSON.stringify(scenario);

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s) => setStatus({ ...s, server: true }))
      .catch(() => setStatus({ enabled: false, model: null, server: false }));
  }, []);

  // Recordings are only needed when there is no live model.
  useEffect(() => {
    if (!status || status.enabled || recorded) return;
    import("../data/recorded-analyses.json").then((m) => setRecorded((m.default as unknown as { entries: Recorded }).entries));
  }, [status, recorded]);

  const live = !!status?.enabled;
  const hasRecording = useCallback((ask?: string | null) => !!recorded?.[analysisKey(scenario, cleanAsk(ask) ?? null)], [recorded, scenario]);
  /** Whether a run for this question (or the whole scenario) can produce an answer here. */
  const canRun = (ask?: string | null) => !!status && (live || hasRecording(ask));

  const run = async (rawAsk?: string | null) => {
    const ask = cleanAsk(rawAsk);
    if (ask === undefined) {
      setResult({ error: "Questions must be 3 to 300 characters." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      if (!live) {
        const hit = recorded?.[analysisKey(scenario, ask)];
        const awaiting = AWAITING_RECORDING.includes(scenario.environment);
        setResult(hit ? { ...hit, recorded: true } : {
          ask: ask ?? undefined,
          error: awaiting
            ? "This preset is new and has no recorded answers yet; it needs a live AI key. The ranking and evidence panels work as normal."
            : ask
              ? "Live AI is off here, so typed questions cannot be answered. Try a suggested question on an unedited preset."
              : "No recorded analysis for this exact scenario.",
        });
      } else {
        const r = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scenario, ...(ask ? { ask } : {}) }),
        });
        setResult({ ...(await r.json()), ...(ask ? { ask } : {}) });
      }
      setForKey(key);
    } catch {
      setResult({ error: "Could not reach the EMBER server." });
    } finally {
      setBusy(false);
    }
  };

  return { status, live, busy, result, stale: !!result && forKey !== key, hasRecording, canRun, run };
}

export type Analysis = ReturnType<typeof useAnalysis>;
