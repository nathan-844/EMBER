// Saffire IV–VI test conditions from a NASA technical paper on NTRS. These flights are not in
// the NASA PSI repository, so EMBER shows them as a separate, labelled source: they are drawn on
// the gap map and named in the oxygen finding, but they are not investigation profiles and
// are never scored in the ranking.
//
// Every number below is copied from the paper. Pressures are as published (kPa); the psia
// values are EMBER's conversion (× 0.1450377, two decimals), used only to plot them.

export const SAFFIRE_NTRS_SOURCE = {
  title: "Preliminary Results from the Saffire VI Experiment",
  authors: "Urban, D. L., Ruff, G. A., Ferkul, P., et al.",
  venue: "53rd International Conference on Environmental Systems, ICES-2024-365, Louisville, KY, July 2024",
  ntrsId: "20240002981",
  url: "https://ntrs.nasa.gov/citations/20240002981",
  pdf: "https://ntrs.nasa.gov/api/citations/20240002981/downloads/Saffire-ICES-2024-ICES-365-accepted%20final.pdf",
  /** Where the numbers come from in the paper. */
  tables: "Table 1 (sample test conditions) and Table 2 (heat release and carbon oxides)",
  label: "NASA NTRS 20240002981 · Saffire VI paper (ICES-2024-365)",
  /** Every value below was checked against Tables 1 and 2 of the PDF (pdf, above) on this date. */
  verifiedOn: "2026-11-15",
  /** SHA-256 of the PDF that was checked, so the check can be repeated on the same file. */
  pdfSha256: "7f875da1d6abeeeeac64aeba67d3f160074cf98430e714fe7606b34b37e0aa59",
} as const;

export interface SaffireRun {
  /** Flight and sample, as the paper labels it (e.g. "VI-2"). */
  sample: string;
  flight: "Saffire IV" | "Saffire V" | "Saffire VI";
  material: string;
  lengthCm: number;
  /** Forced air flow over the sample, cm/s. */
  flowCms: number;
  flowDirection: "concurrent";
  pressureKpa: number;
  /** EMBER's conversion of pressureKpa, for plotting against PSI tables in psia. */
  pressurePsi: number;
  /** "Oxygen Concentration (mol %)" in the paper. */
  oxygenPct: number;
  freeVolumeM3: number;
  /** Table 2: burn duration (s), heat release (W; oxygen-consumption peak or fuel-consumption average), FFD inlet CO₂ and CO increases (ppm). */
  burnS: number;
  heatReleaseW: number;
  heatReleaseMethod: "peak, oxygen consumption" | "average, fuel consumption";
  co2IncreasePpm: number;
  coIncreasePpm: number;
}

const kpaToPsi = (kpa: number) => +(kpa * 0.1450377).toFixed(2);

const run = (r: Omit<SaffireRun, "pressurePsi" | "flowDirection" | "flowCms">): SaffireRun => ({
  ...r,
  flowCms: 20,
  flowDirection: "concurrent",
  pressurePsi: kpaToPsi(r.pressureKpa),
});

/** Table 1 of the paper: "Saffire IV-VI Sample Test Conditions considered in this paper", with Table 2 results. */
export const SAFFIRE_NTRS_RUNS: SaffireRun[] = [
  run({ sample: "IV-1", flight: "Saffire IV", material: "SIBAL cloth (75% cotton, 25% fiberglass)", lengthCm: 50, pressureKpa: 100.0, oxygenPct: 22.0, freeVolumeM3: 17.9, burnS: 130, heatReleaseW: 3150, heatReleaseMethod: "average, fuel consumption", co2IncreasePpm: 1390, coIncreasePpm: 80 }),
  run({ sample: "V-2", flight: "Saffire V", material: "Cotton jersey", lengthCm: 50, pressureKpa: 70.7, oxygenPct: 26.2, freeVolumeM3: 19.0, burnS: 200, heatReleaseW: 2800, heatReleaseMethod: "average, fuel consumption", co2IncreasePpm: 2360, coIncreasePpm: 83 }),
  run({ sample: "VI-2", flight: "Saffire VI", material: "SIBAL cloth (75% cotton, 25% fiberglass)", lengthCm: 50, pressureKpa: 54.1, oxygenPct: 31.0, freeVolumeM3: 16.7, burnS: 112, heatReleaseW: 3217, heatReleaseMethod: "peak, oxygen consumption", co2IncreasePpm: 2800, coIncreasePpm: 120 }),
  run({ sample: "VI-3", flight: "Saffire VI", material: "Two-sided PMMA (1 cm thick)", lengthCm: 18, pressureKpa: 54.6, oxygenPct: 30.3, freeVolumeM3: 16.7, burnS: 780, heatReleaseW: 3080, heatReleaseMethod: "peak, oxygen consumption", co2IncreasePpm: 8539, coIncreasePpm: 308 }),
  run({ sample: "VI-4", flight: "Saffire VI", material: "One-sided PMMA (0.5 cm thick)", lengthCm: 18, pressureKpa: 55.2, oxygenPct: 28.8, freeVolumeM3: 16.7, burnS: 1200, heatReleaseW: 1507, heatReleaseMethod: "peak, oxygen consumption", co2IncreasePpm: 8117, coIncreasePpm: 320 }),
];

/** Published Saffire runs above a given oxygen level, highest first. */
export function saffireRunsAbove(oxygenPct: number): SaffireRun[] {
  return SAFFIRE_NTRS_RUNS.filter((r) => r.oxygenPct > oxygenPct).sort((a, b) => b.oxygenPct - a.oxygenPct);
}
