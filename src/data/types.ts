export type SafetyQuestion = "prevention" | "detection" | "suppression";
export type FuelType = "solid" | "liquid" | "gas";
export type Platform = "ISS" | "Cygnus";

/** A closed numeric interval with its provenance. */
export interface Range {
  min: number;
  max: number;
  /** Where the numbers came from, in plain words. */
  basis: string;
  /** "psi-table": derived from a stored NASA PSI run table. "curated": a written approximation. */
  source?: "psi-table" | "curated";
  /** For psi-table ranges: the table id (e.g. PSI-25-0), column and rows used. */
  table?: string;
  column?: string;
  rowsUsed?: number;
  totalRows?: number;
}

export interface ConditionEnvelope {
  oxygenPct: Range | null;
  pressurePsi: Range | null;
  gravityG: Range | null;
  airflowMs: Range | null;
}

/**
 * Pointer to the authoritative NASA PSI investigation record.
 * verifiedOn is the date the accession was matched against the PSI repository.
 */
export interface PsiReference {
  accession: string | null;
  url: string | null;
  verifiedOn: string | null;
}

export interface Investigation {
  id: string;
  name: string;
  fullName: string;
  project?: string;
  platform: Platform;
  hardware: string;
  summary: string;
  fuelTypes: FuelType[];
  /** Safety questions this investigation addresses directly. */
  questions: SafetyQuestion[];
  /** Questions it informs only indirectly (analogue / adjacent research). */
  adjacentQuestions: SafetyQuestion[];
  conditions: ConditionEnvelope;
  measurements: string[];
  /** Materials and flow directions named in the PSI run table, when it records them. */
  /** A burner built to emulate another fuel type (BRE emulates solids with gas). Scored as a partial fuel match. */
  emulates?: FuelType;
  /** Inverse flames only: oxygen fed through the burner (not the surrounding atmosphere), from a NASA table. */
  burnerOxygen?: { min: number; max: number; table: string; column: string; rowsUsed: number; totalRows: number };
  /** A way this study stands in for partial gravity, with its public source. */
  gravityAnalogue?: { text: string; quote: string; source: { label: string; href: string } };
  testedMaterials?: string[];
  testedFlowDirections?: ("opposed" | "concurrent")[];
  psi: PsiReference;
  caveats: string[];
}
