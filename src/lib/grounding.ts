import type { EvidencePackage, EvidenceSource } from "./evidence";

export const CLAIM_KINDS = ["Reported finding", "Measured data", "Comparison", "Research gap", "Equipment implication", "Interpretation"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

/** Shape the model must return (requested with a JSON schema, then re-checked here). */
export interface ModelAnswer {
  summary: { text: string; sources: string[] };
  claims: { kind: ClaimKind; text: string; implication: string; citations: { source: string; excerpt: string }[] }[];
  openQuestions: string[];
}

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "claims", "openQuestions"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["text", "sources"],
      properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } },
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        // Citations come first so the model picks and copies evidence before writing the claim.
        required: ["citations", "kind", "text", "implication"],
        properties: {
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["source", "excerpt"],
              properties: { source: { type: "string" }, excerpt: { type: "string" } },
            },
          },
          kind: { type: "string", enum: [...CLAIM_KINDS] },
          text: { type: "string" },
          implication: { type: "string" },
        },
      },
    },
    openQuestions: { type: "array", items: { type: "string" } },
  },
} as const;

export interface CheckedClaim {
  kind: string;
  text: string;
  implication: string;
  citations: { source: string; label: string; origin: EvidenceSource["origin"]; excerpt: string }[];
  accepted: boolean;
  problems: string[];
}

export interface GroundingReport {
  verdict: "accepted" | "partial" | "rejected";
  summary: { text: string; accepted: boolean; problems: string[] };
  claims: CheckedClaim[];
  openQuestions: string[];
  receipt: { claims: number; acceptedClaims: number; excerpts: number; nasaExcerpts: number; derivedExcerpts: number; emberExcerpts: number; userExcerpts: number; tableRowExcerpts: number };
}

/** Collapse whitespace, unify quotes and dashes, lowercase: verbatim up to formatting. */
export function normalize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const NUMBER = /(?<![\w.])\d+(?:\.\d+)?/g;

export function numbersIn(text: string): number[] {
  // Identifiers such as "PSI-25-0", "row12", "O2", "CO2" are names, not quantities.
  const stripped = text
    .replace(/\b[A-Za-z]+-\d+(?:-\d+)?\b/g, " ")
    .replace(/\brow\d+\b/gi, " ")
    .replace(/\b(?:CO|O|N|H)[₂2]\b/g, " ");
  return [...stripped.matchAll(NUMBER)].map((m) => Number(m[0]));
}

function decimals(n: number): number {
  const s = String(n);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/** A number traces if some evidence number equals it, allowing the answer to round. */
function traces(n: number, pool: number[]): boolean {
  const d = decimals(n);
  return pool.some((p) => p === n || Math.abs(+p.toFixed(d) - n) < 1e-9);
}

/** Small integers are allowed as counts ("3 of 5 conditions"). */
const isCount = (n: number) => Number.isInteger(n) && n <= 10;

/** Earth reference values a claim may use for contrast: 0 g, 1 g, 21% / 20.95% O₂, 14.7 psia, 1 atm. */
export const EARTH_REFERENCE = [0, 1, 21, 20.95, 14.7];

const investigationOf = (sourceId: string) => sourceId.split(":")[0];
/** Internal source ids ("bass-ii:row7", "limitation:joint") must not appear in reader-facing text. */
const SOURCE_ID = /\b[a-z0-9]+(?:-[a-z0-9]+)*:(?:row\d+|[a-z][a-zA-Z0-9-]*)\b/;
const leaksId = (text: string) => SOURCE_ID.test(text);
const isTableRow = (sourceId: string) => /:row\d+$/.test(sourceId);

/**
 * Check a model answer against the evidence package. A claim is kept only if:
 * - it cites at least one source in the package, and every excerpt (12+ characters)
 *   occurs verbatim, up to whitespace and typographic punctuation, in the source it cites;
 * - every number in its text and implication appears in its cited sources, the scenario
 *   or the Earth reference values (small counts excepted);
 * - a Comparison cites two or more investigations, and Measured data quotes a NASA table row.
 * This makes the basis auditable; it does not prove the claim follows from the excerpt.
 */
/**
 * Conclusions EMBER never draws, whatever the excerpts say: that something is safe, will not burn
 * or ignite, or that detection, suppression or ventilation equipment is not needed. A claim with
 * valid quotes can still assert one of these, so the wording itself is checked.
 */
const SAFETY_CONCLUSION = [
  /\b(?:will|would|cannot|can ?not|can't|won't|does not|do not|did not|is not|are not|never)\s+(?:\w+\s+){0,2}(?:burn|ignite|catch fire|combust|spread)\b/i,
  /\bno\s+(?:extinguisher|suppression|suppressant|detection|detector|ventilation|fire protection)\b[^.]{0,40}\b(?:needed|necessary|required)\b/i,
  /\b(?:extinguishers?|suppression|detectors?|detection|ventilation)\s+(?:is|are)\s+(?:not|un)\s*(?:needed|necessary|required)\b/i,
  /\b(?:non-?flammable|nonflammable|fire-?proof|flame-?proof|fire-?safe|inherently safe|completely safe|perfectly safe|guaranteed?|certif(?:y|ied|ies))\b/i,
  /\b(?:is|are|will be|would be)\s+safe\b/i,
];

export function safetyConclusion(text: string): boolean {
  return SAFETY_CONCLUSION.some((re) => re.test(text));
}

/** Kinds that report what NASA found or measured: they must quote NASA's own text. */
const NEEDS_NASA = new Set(["Reported finding", "Measured data", "Comparison", "Equipment implication"]);

export function checkAnswer(answer: ModelAnswer, pkg: EvidencePackage): GroundingReport {
  const byId = new Map(pkg.sources.map((s) => [s.id, s]));
  const basePool = [...numbersIn(byId.get("scenario")?.text ?? ""), ...EARTH_REFERENCE];

  const claims: CheckedClaim[] = answer.claims.map((c) => {
    const problems: string[] = [];
    const citations: CheckedClaim["citations"] = [];
    if (!c.citations.length) problems.push("No citation.");
    for (const cit of c.citations) {
      const src = byId.get(cit.source);
      if (!src) { problems.push(`Cites unknown source "${cit.source}".`); continue; }
      if (normalize(cit.excerpt).length < 12) problems.push(`Excerpt from ${src.label} is too short to check (under 12 characters).`);
      else if (!normalize(src.text).includes(normalize(cit.excerpt))) problems.push(`Excerpt not found verbatim in ${src.label}.`);
      citations.push({ source: src.id, label: src.label, origin: src.origin, excerpt: cit.excerpt });
    }
    const kind = (CLAIM_KINDS as readonly string[]).includes(c.kind) ? c.kind : "Interpretation";
    if (kind === "Comparison" && new Set(citations.map((x) => investigationOf(x.source)).filter((id) => id !== "scenario" && !id.startsWith("limitation"))).size < 2) {
      problems.push("A comparison must cite two or more investigations.");
    }
    if (NEEDS_NASA.has(kind) && !citations.some((x) => x.origin === "nasa")) {
      problems.push(`A ${kind.toLowerCase()} must quote NASA text (a PSI record or run-table row), not only EMBER's own summaries.`);
    }
    if (safetyConclusion(`${c.text} ${c.implication ?? ""}`)) {
      problems.push("States a safety conclusion (that something will not burn, is safe, or needs no detection, suppression or ventilation). EMBER never draws one.");
    }
    if (kind === "Measured data" && !citations.some((x) => isTableRow(x.source))) {
      problems.push("Measured data must quote a NASA run-table row.");
    }
    const pool = [...basePool, ...citations.flatMap((ct) => numbersIn(byId.get(ct.source)!.text))];
    const loose = numbersIn(`${c.text} ${c.implication ?? ""}`).filter((n) => !isCount(n) && !traces(n, pool));
    if (loose.length) problems.push(`Number${loose.length > 1 ? "s" : ""} ${[...new Set(loose)].join(", ")} not found in the cited sources, scenario or Earth reference values.`);
    if (leaksId(`${c.text} ${c.implication ?? ""}`)) problems.push("Mentions an internal source id instead of describing the source.");
    return { kind, text: c.text, implication: c.implication ?? "", citations, accepted: problems.length === 0, problems };
  });

  const summaryProblems: string[] = [];
  const summarySources = answer.summary.sources.map((id) => byId.get(id)).filter((s): s is EvidenceSource => !!s);
  if (!summarySources.length) summaryProblems.push("Summary cites no known source.");
  const summaryPool = [...basePool, ...summarySources.flatMap((s) => numbersIn(s.text))];
  const summaryLoose = numbersIn(answer.summary.text).filter((n) => !isCount(n) && !traces(n, summaryPool));
  if (summaryLoose.length) summaryProblems.push(`Numbers ${summaryLoose.join(", ")} not found in the summary's sources or scenario.`);
  if (leaksId(answer.summary.text)) summaryProblems.push("Summary mentions an internal source id.");
  if (safetyConclusion(answer.summary.text)) summaryProblems.push("Summary states a safety conclusion, which EMBER never draws.");

  const accepted = claims.filter((c) => c.accepted);
  const excerpts = accepted.flatMap((c) => c.citations);
  // The summary is withheld on its own if it fails; the verdict rests on the claims.
  const verdict: GroundingReport["verdict"] =
    accepted.length === 0 ? "rejected" : accepted.length === claims.length && summaryProblems.length === 0 ? "accepted" : "partial";

  return {
    verdict,
    summary: { text: answer.summary.text, accepted: summaryProblems.length === 0, problems: summaryProblems },
    claims,
    openQuestions: answer.openQuestions.filter((q) => !leaksId(q)).slice(0, 5),
    receipt: {
      claims: claims.length,
      acceptedClaims: accepted.length,
      excerpts: excerpts.length,
      nasaExcerpts: excerpts.filter((e) => e.origin === "nasa").length,
      derivedExcerpts: excerpts.filter((e) => e.origin === "derived").length,
      emberExcerpts: excerpts.filter((e) => e.origin === "ember").length,
      userExcerpts: excerpts.filter((e) => e.origin === "user").length,
      tableRowExcerpts: excerpts.filter((e) => isTableRow(e.source)).length,
    },
  };
}

/** Rank two checked reports: more kept claims wins, then more NASA excerpts. */
export function better(a: GroundingReport, b: GroundingReport): GroundingReport {
  const score = (r: GroundingReport) =>
    r.verdict === "rejected" ? -1 : r.receipt.acceptedClaims * 10 + r.receipt.nasaExcerpts + (r.summary.accepted ? 5 : 0);
  return score(b) > score(a) ? b : a;
}
