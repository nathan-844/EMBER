export type SafetyQuestion = "prevention" | "detection" | "suppression";
export type FuelType = "solid" | "liquid" | "gas";
export type Platform = "ISS" | "Cygnus";

/** A closed numeric interval. All curated ranges are approximate until checked against PSI. */
export interface Range {
  min: number;
  max: number;
  /** Where the numbers came from, in plain words. */
  basis: string;
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
  psi: PsiReference;
  caveats: string[];
}
