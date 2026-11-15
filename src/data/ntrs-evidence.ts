// Results NASA has published on the NASA Technical Reports Server (NTRS), quoted word for word.
//
// The PSI repository holds what an investigation set out to do and its run tables; it does not
// hold lunar-gravity data yet, and it rarely states results in words. These quotes fill both gaps.
// They are evidence shown beside the ranking, never scored in it.
//
// Every quote is checked against the PDF by `npm run sync:ntrs`, which records the PDF's SHA-256,
// the page each quote is on and a hash of each quote in src/data/ntrs-manifest.json. A test fails
// if a quote here is edited without running that check again.

export interface NtrsSource {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  kind: "paper" | "presentation" | "poster" | "extended abstract" | "report";
}

export type GravityLevel = "lunar" | "mars";

export interface NtrsQuote {
  id: string;
  source: string;
  /** Verbatim from the PDF text (whitespace collapsed, ligatures and curly quotes made plain). */
  text: string;
  /**
   * partial-gravity: a result or method statement about lunar or Martian gravity.
   * atmosphere: an exploration-atmosphere value a preset uses.
   * equipment: a result that bears on one EQUIPMENT_LINKS entry.
   */
  topic: "partial-gravity" | "atmosphere" | "equipment";
  /** For partial-gravity quotes: what the statement says about flammability compared with Earth tests. */
  finding?: "more flammable" | "mixed" | "method" | "planned";
  gravity?: GravityLevel[];
  /** For equipment quotes: the EQUIPMENT_LINKS id this result belongs beside. */
  equipmentLink?: string;
}

export const NTRS_SOURCES: NtrsSource[] = [
  { id: "20250002114", title: "Solid Fuel Ignition Testing for Lunar Applications, Theory and Experimental Results", authors: "Urban, D., Olson, S., Dietrich, D., et al.", venue: "54th International Conference on Environmental Systems (ICES)", year: 2025, kind: "paper" },
  { id: "20210020446", title: "Impact of Lunar Gravity on Material Flammability", authors: "Ruff, G. A.", venue: "Lunar Surface Science Workshop", year: 2021, kind: "presentation" },
  { id: "20240008623", title: "Flammability of Materials on the Moon", authors: "Zayac, J., Johnston, M., Ruff, G., et al.", venue: "Glenn Space Technology Symposium", year: 2024, kind: "poster" },
  { id: "20250010653", title: "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket", authors: "Ferkul, P. V., Johnston, M. C., Kralik, N., et al.", venue: "American Society for Gravitational and Space Research", year: 2025, kind: "presentation" },
  { id: "20260000646", title: "Material Flammability at Lunar and Martian Gravity", authors: "Ferkul, P., Kralik, N., Liao, Y.-T.", venue: "57th Lunar and Planetary Science Conference", year: 2026, kind: "extended abstract" },
  { id: "20150021491", title: "Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere", authors: "Norcross, J. R., Conkin, J., Wessel, J. H., III, et al.", venue: "NASA Human Research Program", year: 2015, kind: "report" },
  { id: "20220000245", title: "Artemis Deep Space Habitation: Enabling a Sustained Human Presence on the Moon and Beyond", authors: "Kessler, P., Prater, T., Nickens, T., et al.", venue: "IEEE Aerospace Conference", year: 2022, kind: "paper" },
  { id: "20160000593", title: "Combustion of Solids in Microgravity: Results from the BASS-II Experiment", authors: "Ferkul, P. V., Bhattacharjee, S., Fernandez-Pello, C., et al.", venue: "American Society for Gravitational and Space Research", year: 2014, kind: "presentation" },
  { id: "20140011099", title: "Thickness and Fuel Preheating Effects on Material Flammability in Microgravity from the BASS Experiment", authors: "Ferkul, P. V., Olson, S. L., Takahashi, F., et al.", venue: "American Society for Gravitational and Space Research", year: 2013, kind: "presentation" },
  { id: "20220007191", title: "Laminar Non-Premixed Flames of Gaseous Fuel Aboard the International Space Station", authors: "Stocker, D. P.", venue: "Spring Technical Meeting, Central States Section of The Combustion Institute", year: 2022, kind: "presentation" },
  { id: "20180005168", title: "Saffire: A Novel Approach to Study of Spacecraft Fire Safety Using Un-Manned Spacecraft", authors: "Urban, D. L., Ferkul, P., Olson, S., et al.", venue: "American Society for Gravitational and Space Research", year: 2017, kind: "presentation" },
  { id: "20130000422", title: "Particle Morphology and Size Results from the Smoke Aerosol Measurement Experiment-2", authors: "Urban, D. L., Ruff, G. A., Greenberg, P. S., et al.", venue: "AIAA International Conference on Environmental Systems", year: 2012, kind: "paper" },
  { id: "20070031686", title: "Particle and Smoke Detection on ISS for Next Generation Smoke Detectors", authors: "Urban, D. L., Ruff, G., Yuan, Z.-G., et al.", venue: "International Space Development Conference", year: 2007, kind: "presentation" },
  { id: "20130014061", title: "Methanol Droplet Combustion in Oxygen-Inert Environments in Microgravity", authors: "Nayagam, V., Dietrich, D. L., Hicks, M. C., et al.", venue: "8th U.S. National Combustion Meeting", year: 2013, kind: "paper" },
];

export const NTRS_QUOTES: NtrsQuote[] = [
  // Partial gravity: results.
  { id: "urban25-increased", source: "20250002114", topic: "partial-gravity", finding: "more flammable", gravity: ["lunar"],
    text: "Comparative testing in 1-g under forced flow and buoyant flow at lunar-g conditions has demonstrated that for some materials, there is a clear increased flammability at lunar gravity conditions." },
  { id: "urban25-decreased", source: "20250002114", topic: "partial-gravity", finding: "mixed", gravity: ["lunar"],
    text: "Other, higher temperature materials may show decreased flammability at lunar conditions than would be predicted from 1-g testing." },
  { id: "urban25-mars", source: "20250002114", topic: "partial-gravity", finding: "more flammable", gravity: ["mars"],
    text: "At Martian g-levels, the buoyant flow will be higher and increased flammability is possible for materials that do not exhibit it at lunar-g levels." },
  { id: "ruff21-moc", source: "20210020446", topic: "partial-gravity", finding: "more flammable", gravity: ["lunar", "mars"],
    text: "Partial-g flames propagated at the normal-g MOC for all materials (charring and non-charring)" },
  { id: "ruff21-materials", source: "20210020446", topic: "partial-gravity", finding: "method", gravity: ["lunar", "mars"],
    text: "Tests were conducted at WSTF (normal-g) and GRC (partial-g) to quantify changes in the MOC for Nomex, Mylar, and Ultem" },
  { id: "fm2-24-lower-limits", source: "20240008623", topic: "partial-gravity", finding: "more flammable", gravity: ["lunar"],
    text: "materials have lower oxygen limits of flammability in Lunar gravity than in Earth gravity according to the 5.18 second tests using the zerogravity drop facility" },
  { id: "ferkul26-burn", source: "20260000646", topic: "partial-gravity", finding: "more flammable", gravity: ["lunar"],
    text: "Theoretical and experimental results have demonstrated that some materials that will not burn in 1-g will burn in 0-g (with a low-speed flow) or in partial gravity (such as Lunar-g)." },
  { id: "luci25-sibal", source: "20250010653", topic: "partial-gravity", finding: "method", gravity: ["lunar"],
    text: "Edge view of SIBAL fabric (cotton-fiberglass blend) burning downward in Lunar-g 30 s after ignition." },
  // Partial gravity: how the evidence was gathered, and what is still to come.
  { id: "ferkul26-times", source: "20260000646", topic: "partial-gravity", finding: "method", gravity: ["lunar", "mars"],
    text: "Partial gravity tests can be performed in drop towers [8] and aboard aircraft [2], but the available times are too short to provide significant flame development (5 s for drop tower and ~25 s for aircraft)." },
  { id: "ferkul26-rocket", source: "20260000646", topic: "partial-gravity", finding: "method", gravity: ["lunar"],
    text: "A sounding rocket utilizing vehicle rotation to simulate Lunar gravity provided test times on the order of 150 s, burning two different materials, but again the Coriolis force introduces uncertainty." },
  { id: "ferkul26-fm2", source: "20260000646", topic: "partial-gravity", finding: "planned", gravity: ["lunar"],
    text: "Flammability of Materials on the Moon (FM2) will burn a total of four solid fuel samples in quiescent habitable atmospheres in actual long duration Lunar gravity" },

  // Exploration atmospheres used by the presets.
  { id: "eaw-8-2-34", source: "20150021491", topic: "atmosphere",
    text: "After re-evaluation in 2012, the 8/32 environment was altered to 8.2 psia and 34% O2 to reduce the hypoxic stress to a crewmember." },
  { id: "fm2-24-atmospheres", source: "20240008623", topic: "atmosphere",
    text: "The environmental control system can replicate and conduct fire experiments automatically in the expected atmospheres, specifically 21% oxygen at 14.7 psia, and 34% oxygen at 8.2 psia, which are of immediate interest to the Human Lander System (HLS) and Lunar Rover." },
  { id: "artemis-sh", source: "20220000245", topic: "atmosphere",
    text: "The SH is assumed to operate at a nominal atmospheric operating pressure of 10.2 psia and 26.5% oxygen concentration and a capability of operating at 8.2 psia and 34% oxygen." },

  // Equipment: published results beside the PSI objectives.
  { id: "bass2-margin", source: "20160000593", topic: "equipment", equipmentLink: "screening-test",
    text: "Thus the material has a negative Oxygen Margin of Safety of 2.4% O2, and the normal gravity flammability limits should be de-rated by at least that much." },
  { id: "bass-flow", source: "20140011099", topic: "equipment", equipmentLink: "forced-flow",
    text: "Microgravity flames were found to be especially sensitive to air flow speed in the range 0 to 5 cm/s." },
  { id: "bass-nitrogen", source: "20140011099", topic: "equipment", equipmentLink: "inert-agent",
    text: "One result is that extinction with the nitrogen jet was not possible for the given flow rate." },
  { id: "flex-loi", source: "20130014061", topic: "equipment", equipmentLink: "gaseous-suppressants",
    text: "The experiments also show that the limiting oxygen index for methanol in these diluent gases is around 12% to 13% oxygen by volume." },
  { id: "same-sizes", source: "20130000422", topic: "equipment", equipmentLink: "smoke-particle-size",
    text: "Overall the majority of the average smoke particle sizes were found to be in the 200 nm to 400 nm range with the quiescent cases producing some cases with substantially larger particles." },
  { id: "daft-background", source: "20070031686", topic: "equipment", equipmentLink: "particle-counter",
    text: "The ISS cabin was found to be a very clean environment with particulate levels substantially below the space shuttle and typical ground-based environments." },
  { id: "saffire-duct", source: "20180005168", topic: "equipment", equipmentLink: "fire-growth",
    text: "Concurrent flame spread (with the wind) was shown to be more sensitive to the flow duct dimension than previously anticipated." },
  { id: "bre-25pct", source: "20220007191", topic: "equipment", equipmentLink: "ventilation-shutdown-high-o2",
    text: "While the flames can burn for minutes in elevated oxygen concentrations, like those being considered for future spacecraft, they were found to self-extinguish in concentrations below ~25% (by volume)." },
];

export const ntrsUrl = (id: string) => `https://ntrs.nasa.gov/citations/${id}`;

export function ntrsSource(id: string): NtrsSource {
  const s = NTRS_SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown NTRS source ${id}`);
  return s;
}

/** First author and year, e.g. "Urban et al. 2025". */
export function ntrsShort(id: string): string {
  const s = ntrsSource(id);
  const many = s.authors.split(".,").length > 1;
  return `${s.authors.split(",")[0]}${many ? " et al." : ""} ${s.year}`;
}

/** Short citation, e.g. "Urban et al. 2025 · NTRS 20250002114". */
export const ntrsCite = (id: string) => `${ntrsShort(id)} · NTRS ${id}`;

export function quotesFor(topic: NtrsQuote["topic"]): NtrsQuote[] {
  return NTRS_QUOTES.filter((q) => q.topic === topic);
}

export function equipmentResults(linkId: string): NtrsQuote[] {
  return NTRS_QUOTES.filter((q) => q.topic === "equipment" && q.equipmentLink === linkId);
}

/** Partial-gravity statements relevant to a gravity level (g). Lunar ≈ 0.166 g, Mars ≈ 0.38 g. */
export function partialGravityEvidence(gravityG: number | null): NtrsQuote[] {
  if (gravityG == null || gravityG <= 0.001 || gravityG >= 0.95) return [];
  const level: GravityLevel = gravityG < 0.27 ? "lunar" : "mars";
  return quotesFor("partial-gravity").filter((q) => q.gravity?.includes(level));
}
