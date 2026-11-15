/** Independently transcribed reference cells from rendered NASA/TM-20210011385.
 * Order: calibrated initial O2, calibrated final O2, initial CO, final CO.
 * Locators use PDF page numbers (printed page = PDF page - 8).
 * This is a Codex source cross-check, NOT an independent scientific review.
 */
export const REVIEW_VERSION = "bass-m1-crosswalk-v1";
type Reference = { page: number; cells: [number, number, number | null, number | ">500" | null] };
export const REFERENCES: Record<string, Reference> = {
  M1: { page: 116, cells: [22.2, 21.9, 0, 60] }, M2: { page: 117, cells: [22.2, 21.2, 12, 325] },
  M3: { page: 117, cells: [20.8, 19.7, 11, 300] }, M4: { page: 117, cells: [21.8, 19.8, 2, 561] },
  M5: { page: 117, cells: [22.2, 19, 9, ">500"] }, M6: { page: 117, cells: [21.8, 20.7, 1, 345] },
  M7: { page: 117, cells: [18.9, 18.4, 398, 612] }, M8: { page: 117, cells: [19.1, 18.2, 52, 467] },
  M9: { page: 117, cells: [18, 17.6, 0, 191] }, M10: { page: 116, cells: [20.1, 18.6, -1, 536] },
  M11: { page: 116, cells: [20, 18.5, 46, 577] }, M12: { page: 116, cells: [21.7, 20.4, 15, 443] },
  M13: { page: 116, cells: [20.8, 19, 0, 487] }, M14: { page: 116, cells: [22.2, 21.6, 0, 198] },
  M15: { page: 116, cells: [21, 20, 1, 220] }, M16: { page: 116, cells: [19.2, 18.7, 118, 421] },
  M17: { page: 116, cells: [18.8, 17.1, 4, 485] }, M18: { page: 116, cells: [17.9, 16.8, 0, 335] },
  M19: { page: 117, cells: [19, 17.4, 3, 357] }, M20: { page: 117, cells: [18, 17.4, 0, 157] },
  T1: { page: 120, cells: [18.5, 18.5, 0, 40] }, T2: { page: 120, cells: [18.5, 18.5, 40, 78] },
  T4: { page: 121, cells: [18.7, 18.7, 59, 72] }, T5: { page: 121, cells: [18.8, 18.9, 2, 41] },
  T6: { page: 121, cells: [18.8, 18.8, 39, 77] }, T9: { page: 121, cells: [16.4, 16.4, 0, 9] },
  T10: { page: 120, cells: [16.4, 16.5, 9, 14] }, T11: { page: 120, cells: [17.1, 17, 1, 45] },
  T12: { page: 120, cells: [16.8, 16.9, 113, 117] }, T13: { page: 120, cells: [17.5, 17.6, 2, 12] },
  T14: { page: 120, cells: [16.9, 16.9, 117, 152] }, T15: { page: 120, cells: [18.7, 18.7, 72, 102] },
  T16: { page: 120, cells: [17.6, 17.5, 17, 41] }, T17: { page: 120, cells: [16.9, 16.9, 152, 190] },
  T18: { page: 120, cells: [17.4, 17.4, 2, 22] }, T19: { page: 120, cells: [17.2, 17.2, 1, 20] },
  T20: { page: 120, cells: [17.2, 17.2, 20, 34] }, T21: { page: 120, cells: [17.2, 17.2, 34, 45] },
  T22: { page: 120, cells: [17.1, 17, 140, 162] }, T23: { page: 120, cells: [17.2, 17.3, 45, 49] },
  T24: { page: 120, cells: [18.2, 18.2, 85, 107] }, T25: { page: 121, cells: [20.8, 20.7, -1, 17] },
  T26: { page: 121, cells: [20.8, 20.7, -1, 24] }, T27: { page: 121, cells: [20.7, 20.6, -1, 9] },
  T28a: { page: 121, cells: [20.7, .9, -1, null] }, T28b: { page: 121, cells: [20.7, 40.4, null, 2] },
  T29: { page: 121, cells: [20.7, 20.5, -1, 10] },
};
export const SOURCE_MANIFEST = {
  reviewVersion: REVIEW_VERSION,
  reviewedOn: "2026-11-15",
  reviewer: "Codex; visual source cross-check, no independent human or scientific sign-off",
  scope: "47 PSI observations matched by test ID, with 4 gas cells each (188 cells). Material context checked; T23 unresolved. Dates, flow, geometry and duration are not reconciled numerically. No source measurements overwritten.",
  psi: { accession: "PSI-25", table: "PSI-25-0", doi: "10.60555/4qc4-de67", recordVersion: 4, license: "CC0-1.0", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25", csvSha256: "71e792bf6b5fb5ea620c5dd70fbbac05515992e12aefcf5dff47312caa48c042" },
  summary: { title: "Burning and Suppression of Solids – II (BASS-II) Summary Report", url: "https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf", sha256: "5ffa911fd9b6356f204646003fb9342e341810dcdfdf5cb15756e7f01ec5f770", locators: "Tables A.4 and A.6, printed pp. 108–109 and 112–113; PDF pp. 116–117 and 120–121", license: "NASA public report; linked, full PDF not redistributed" },
  sensors: { title: "Results from On-board CSA-CP and CDM Sensor Readings During BASS-II", url: "https://ntrs.nasa.gov/api/citations/20150019858/downloads/20150019858.pdf", sha256: "e9c1286f0903700c0ae180a574debb6826f3676a072df2eeb926c22955a09831", locator: "PDF p. 4", context: "The report describes CO sensor zero calibration every 60 days, a 0–1000 ppm range and 1 ppm resolution. This does not give per-reading uncertainty or establish each PSI reading's calibration; the explicit >500 flag on M5 is retained." },
  unresolved: [
    "T23: PSI labels the material Sibal; the summary table says SI. Its four gas cells agree, but material equivalence is unresolved. Excluded in source-reconciled mode.",
    "T28a/T28b: final calibrated O2 values 0.9 and 40.4 appear in both sources. Agreement does not resolve their plausibility. Numeric CO pairs are also incomplete.",
    "Negative initial CO readings are preserved, not clamped to zero. The optional stricter policy excludes them; the sensor report does not establish their exact cause.",
    "Dates are not safe session identifiers here: the summary lists T10 in 2018 while PSI lists 2014. Session-clustered inference is deferred pending an identity review.",
  ],
};
