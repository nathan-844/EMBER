import snapshot from "./psi-snapshot.json";

export interface PsiRecord {
  accession: string;
  acronym: string | null;
  title: string;
  url: string;
  researchArea: string;
  subResearchArea: string | null;
  flightPlatform: string | null;
  projectType: string | null;
  publicReleaseDate: string | null;
  startDate: string | null;
  endDate: string | null;
  monitoringCenter: string | null;
  hardware: string | null;
  keywords: string[];
  relatedInvestigations: string[];
  objectives: string;
  /** NASA's "Research Impacts/Earth Benefits" text. */
  earthBenefits: string;
  publications: string[];
}

export interface PsiSnapshot {
  source: string;
  fetchedOn: string;
  totalInvestigations: number;
  responseSha256: string;
  records: PsiRecord[];
}

export const PSI_SNAPSHOT = snapshot as PsiSnapshot;

export function getPsiRecord(accession: string | null): PsiRecord | undefined {
  return accession ? PSI_SNAPSHOT.records.find((r) => r.accession === accession) : undefined;
}

/** Accessions EMBER profiles as flight investigations (src/data/investigations.ts keeps the mapping). */
const PROFILED = new Set(["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-25", "PSI-26", "PSI-39", "PSI-47", "PSI-68", "PSI-69", "PSI-98", "PSI-99", "PSI-100", "PSI-101", "PSI-102", "PSI-106", "PSI-107", "PSI-159"]);

/**
 * Combustion records in PSI that are not flight investigations themselves: NASA-funded ground
 * studies that model or re-analyse flight data. Each names the flight investigations it builds on.
 */
export const ANALYSIS_RECORDS: PsiRecord[] = PSI_SNAPSHOT.records.filter((r) => !PROFILED.has(r.accession));

/** Ground modelling and analysis studies that build on a flight investigation's data. */
export function analysesFor(accession: string | null): PsiRecord[] {
  if (!accession) return [];
  return ANALYSIS_RECORDS.filter((r) => r.relatedInvestigations.includes(accession));
}
