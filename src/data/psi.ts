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
