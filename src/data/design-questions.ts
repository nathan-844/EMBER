// Questions a habitat designer could ask of their own design, each backed by NASA evidence EMBER
// has already checked: NTRS quotes (found in the PDF), PSI equipment quotes (found in the PSI
// record) or measured findings (computed from NASA rows).
//
// The questions are EMBER's. They are deliberately questions, not instructions: the evidence comes
// from small samples, other fuels or other gravity levels, and EMBER does not turn it into rules.
// A test runs every question through the same safety-conclusion check the AI answers face.
import type { EquipmentArea } from "./applications";
import { gravityRegime, ppo2VsEarth, type Scenario } from "../lib/scenario";

export type DesignEvidence =
  | { kind: "ntrs"; quote: string }
  | { kind: "psi"; link: string }
  | { kind: "finding"; id: string };

export interface DesignQuestion {
  id: string;
  area: EquipmentArea | "atmosphere";
  question: string;
  /** EMBER's one-line reason for asking, in plain words, without a conclusion. */
  why: string;
  evidence: DesignEvidence[];
  /** When the question applies most directly to a scenario, and how to say so. */
  appliesWhen: { test: (s: Scenario) => boolean; label: string };
}

const o2Above = (pct: number) => (s: Scenario) => s.oxygenPct != null && s.oxygenPct > pct;
const inSpace = (s: Scenario) => ["microgravity", "partial"].includes(gravityRegime(s.gravityG));

export const DESIGN_QUESTIONS: DesignQuestion[] = [
  {
    id: "dq-vent-shutdown",
    area: "ventilation",
    question: "Does your fire response count on switching off the ventilation to put a fire out?",
    why: "In elevated oxygen, NASA saw gas flames keep burning with no air flow.",
    evidence: [{ kind: "psi", link: "ventilation-shutdown-high-o2" }, { kind: "ntrs", quote: "bre-25pct" }],
    appliesWhen: { test: o2Above(21.5), label: "oxygen above 21.5%" },
  },
  {
    id: "dq-self-extinguish",
    area: "suppression",
    question: "Does any procedure expect a small flame to go out by itself before the crew acts?",
    why: "Near exploration air, none of 17 FLEX droplet flames went out before the fuel burned away or broke apart; about half did in ordinary air.",
    evidence: [{ kind: "finding", id: "F2" }, { kind: "ntrs", quote: "bre-25pct" }],
    appliesWhen: { test: o2Above(25), label: "oxygen above 25%" },
  },
  {
    id: "dq-screening",
    area: "materials",
    question: "Is your material list cleared only by NASA's 1-g flammability screening test?",
    why: "NASA's own work finds materials that pass on Earth can burn in low or lunar gravity.",
    evidence: [{ kind: "ntrs", quote: "bass2-margin" }, { kind: "ntrs", quote: "ferkul26-burn" }, { kind: "ntrs", quote: "fotm21-most-flammable" }],
    appliesWhen: { test: inSpace, label: "low or partial gravity" },
  },
  {
    id: "dq-ignition-time",
    area: "materials",
    question: "Are your material ignition tests long enough, and run at your oxygen level?",
    why: "BASS-II found ignition needs more oxygen than flame spread, and can take far longer than the standard igniter time.",
    evidence: [{ kind: "ntrs", quote: "bass2tm-ignition" }],
    appliesWhen: { test: inSpace, label: "low or partial gravity" },
  },
  {
    id: "dq-airflow",
    area: "ventilation",
    question: "What air speed will there actually be across materials where a fire could start?",
    why: "In microgravity, BASS flames changed most between still air and 5 cm/s, and quenched at 1–5 cm/s.",
    evidence: [{ kind: "ntrs", quote: "bass-flow" }, { kind: "ntrs", quote: "bass2tm-quench" }, { kind: "psi", link: "forced-flow" }],
    appliesWhen: { test: (s) => gravityRegime(s.gravityG) === "microgravity", label: "microgravity" },
  },
  {
    id: "dq-co-detection",
    area: "detection",
    question: "Does your detection plan sense carbon monoxide as well as smoke?",
    why: "Almost every small BASS-II burn raised CO, and these low-gravity flames burned inefficiently.",
    evidence: [{ kind: "finding", id: "F7" }, { kind: "ntrs", quote: "bass2tm-co" }],
    appliesWhen: { test: (s) => s.question === "detection", label: "your question is detection" },
  },
  {
    id: "dq-smoke-size",
    area: "detection",
    question: "Is your smoke detector sensitive to the particle sizes low-gravity smoke produces?",
    why: "SAME measured average smoke particles mostly between 200 and 400 nm.",
    evidence: [{ kind: "ntrs", quote: "same-sizes" }, { kind: "psi", link: "smoke-particle-size" }],
    appliesWhen: { test: (s) => s.question === "detection", label: "your question is detection" },
  },
  {
    id: "dq-suppressant",
    area: "suppression",
    question: "Has your suppressant been tested at your oxygen level, pressure and gravity?",
    why: "FLEX found methanol droplets stop burning at around 12–13% oxygen in the diluent gases it tested.",
    evidence: [{ kind: "ntrs", quote: "flex-loi" }, { kind: "psi", link: "gaseous-suppressants" }],
    appliesWhen: { test: (s) => s.question === "suppression", label: "your question is suppression" },
  },
  {
    id: "dq-atmosphere",
    area: "atmosphere",
    question: "Was your cabin atmosphere chosen on oxygen partial pressure alone?",
    why: "NASA's tests point to the oxygen fraction, which rises in low-pressure habitats, as the stronger driver of flammability.",
    evidence: [{ kind: "ntrs", quote: "ruff21-o2-vs-pressure" }, { kind: "ntrs", quote: "eaw-8-2-34" }],
    appliesWhen: { test: (s) => (ppo2VsEarth(s)?.fractionVsEarth ?? 0) >= 0.02, label: "oxygen fraction above Earth air" },
  },
  {
    id: "dq-lunar-gap",
    area: "materials",
    question: "What margin will you hold on material choices until fire tests on the Moon report?",
    why: "Lunar-gravity results so far come from short drop-tower and aircraft tests and a rotating rocket; FM2 is planned to burn samples on the Moon itself.",
    evidence: [{ kind: "ntrs", quote: "ferkul26-times" }, { kind: "ntrs", quote: "ferkul26-fm2" }, { kind: "ntrs", quote: "fotm21-planned" }],
    appliesWhen: { test: (s) => gravityRegime(s.gravityG) === "partial", label: "partial gravity" },
  },
];

export const AREA_TITLE: Record<DesignQuestion["area"], string> = {
  detection: "Detection",
  suppression: "Suppression",
  ventilation: "Ventilation",
  materials: "Materials",
  atmosphere: "Atmosphere",
};

/** Questions that apply directly to the scenario first, then the rest. */
export function designQuestionsFor(s: Scenario): { q: DesignQuestion; applies: boolean }[] {
  const all = DESIGN_QUESTIONS.map((q) => ({ q, applies: q.appliesWhen.test(s) }));
  return [...all.filter((x) => x.applies), ...all.filter((x) => !x.applies)];
}
