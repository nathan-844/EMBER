// Links from NASA investigations to the fire-safety equipment and control decisions they inform.
//
// Each link has two parts, kept apart on purpose:
//   quote   – words copied exactly from the investigation's NASA PSI record (tests check this);
//   informs – EMBER's one-line statement of the equipment decision. When NASA's own words do not
//             name that use, `interpretation` is true and the app says it is EMBER's reading.
import type { SafetyQuestion } from "./types";

export type EquipmentArea = "detection" | "suppression" | "ventilation" | "materials";

export interface EquipmentLink {
  id: string;
  area: EquipmentArea;
  /** Investigation profile ids (src/data/investigations.ts). */
  investigations: string[];
  /** EMBER's plain statement of the equipment or control decision this evidence informs. */
  informs: string;
  /** Verbatim from the NASA PSI record: its objectives (default) or its Earth-benefits text. */
  quote: { accession: string; text: string; field?: "objectives" | "earthBenefits" };
  /** True when the link is EMBER's reading rather than something NASA's text states. */
  interpretation: boolean;
  /** What the evidence does not cover for this decision. */
  caveat: string;
}

export const AREA_LABEL: Record<EquipmentArea, string> = {
  detection: "Fire detection",
  suppression: "Suppression and extinguishers",
  ventilation: "Ventilation control",
  materials: "Material screening and cabin atmosphere",
};

/** The safety question each area serves, so the panel can lead with the user's question. */
export const AREA_QUESTION: Record<EquipmentArea, SafetyQuestion> = {
  detection: "detection",
  suppression: "suppression",
  ventilation: "prevention",
  materials: "prevention",
};

export const EQUIPMENT_LINKS: EquipmentLink[] = [
  {
    id: "detect-suppress-models",
    area: "suppression",
    investigations: ["bass-ii"],
    informs: "Computational fire models used to design detection and suppression systems",
    quote: { accession: "PSI-25", text: "BASS-II results contribute to the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth." },
    interpretation: false,
    caveat: "Duct-scale samples in cabin-like air; no elevated-oxygen or partial-gravity runs.",
  },
  {
    id: "inert-agent",
    area: "suppression",
    investigations: ["bass"],
    informs: "Inert-gas extinguisher performance on different materials, shapes and flows",
    quote: { accession: "PSI-26", text: "Assess the effectiveness of an inert, gaseous extinguishing agent (similar to that used on ISS) in putting out flames over different materials, geometries, preheating, and flow." },
    interpretation: false,
    caveat: "Small samples in a flow duct; extinguisher discharge into a full cabin was not tested.",
  },
  {
    id: "gaseous-suppressants",
    area: "suppression",
    investigations: ["flex", "flex-2"],
    informs: "Choice of gaseous suppressant and how much dilution puts a flame out",
    quote: { accession: "PSI-69", text: "measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6" },
    interpretation: false,
    caveat: "Burning fuel droplets in a diluted chamber, not solid cabin materials.",
  },
  {
    id: "smoke-particle-size",
    area: "detection",
    investigations: ["same", "same-r"],
    informs: "Smoke detector design: the particle sizes a spacecraft detector must sense",
    quote: { accession: "PSI-102", text: "quantify the sizes that the liquid smoke particulate achieves in low gravity and to relate the droplet size distribution to the smoke generation and smoke transport conditions in the experiment" },
    interpretation: true,
    caveat: "Smoke from heated (pyrolyzing) materials, not flaming fires.",
  },
  {
    id: "particle-counter",
    area: "detection",
    investigations: ["daft", "daft-2"],
    informs: "Whether particle-counting instruments work in microgravity, and the dust background they must ignore (false alarms)",
    quote: { accession: "PSI-47", text: "DAFT / DAFT-2 tests that a modified P-Trak particulate counter would be accurate in microgravity." },
    interpretation: true,
    caveat: "Two sessions with a test dust; no fire smoke.",
  },
  {
    id: "fire-growth",
    area: "detection",
    investigations: ["saffire-i", "saffire-ii", "saffire-iii"],
    informs: "Detection and response time: how fast a spacecraft-scale fire grows",
    quote: { accession: "PSI-98", text: "determine how rapidly a large scale fire grows in low-gravity" },
    interpretation: true,
    caveat: "Cabin air at about 21% O₂ in an uncrewed Cygnus; no exploration atmosphere.",
  },
  {
    id: "sooting",
    area: "detection",
    investigations: ["spice"],
    informs: "How much smoke different fuels make, which affects optical smoke sensing",
    quote: { accession: "PSI-107", text: "Quantify the sooting propensity of different fuels, such as ethylene, propane, and propylene mixtures." },
    interpretation: true,
    caveat: "Gas-jet flames, not burning cabin materials.",
  },
  {
    id: "forced-flow",
    area: "ventilation",
    investigations: ["bass-ii", "bass"],
    informs: "Ventilation response: in microgravity, forced flow supplies the oxygen a fire needs, so fan speed and shutdown matter",
    quote: { accession: "PSI-25", text: "Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity." },
    interpretation: true,
    caveat: "Flow speeds of a small duct; cabin ventilation patterns were not modelled.",
  },
  {
    id: "ventilation-shutdown-high-o2",
    area: "ventilation",
    investigations: ["acme-bre"],
    informs: "Ventilation shutdown may not put out a fire in an elevated-oxygen habitat",
    quote: { accession: "PSI-20", field: "earthBenefits", text: "The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft, whereas such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time." },
    interpretation: false,
    caveat: "NASA calls BRE's results preliminary; a gas burner emulating solids, in microgravity.",
  },
  {
    id: "screening-test",
    area: "materials",
    investigations: ["bass", "bass-ii", "saffire-i", "saffire-ii", "saffire-iii"],
    informs: "Material selection: whether NASA's normal-gravity flammability screening test ranks materials the way they burn in space",
    quote: { accession: "PSI-26", text: "Begin to bridge the gap between the normal gravity NASA-STD-6001 Test#1 method, ground-based microgravity tests, and actual material flammability in microgravity." },
    interpretation: false,
    caveat: "Limited materials (SIBAL fabric, PMMA, Nomex, silicone, Ultem) and cabin-air oxygen.",
  },
  {
    id: "exploration-atmospheres",
    area: "materials",
    investigations: ["acme-bre"],
    informs: "Choosing the habitat atmosphere: burning in NASA's candidate exploration atmospheres",
    quote: { accession: "PSI-20", text: "NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen." },
    interpretation: false,
    caveat: "A gas burner that emulates solid burning, not real cabin materials; still microgravity.",
  },
];

/** Planned or new investigations that would close gaps EMBER reports. */
export interface UpcomingStudy {
  id: string;
  name: string;
  closes: "partial-gravity" | "exploration-atmosphere";
  what: string;
  quote: { text: string; source: string; url: string };
}

const CHALLENGE = {
  source: "NASA Space Apps 2026 · Flame in Freefall challenge",
  url: "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/",
};

export const UPCOMING: UpcomingStudy[] = [
  {
    id: "sofie",
    name: "SoFIE · Solid Fuel Ignition and Extinction",
    closes: "exploration-atmosphere",
    what: "Solid fuels on the ISS at oxygen levels and pressures of planned exploration atmospheres, the gap above 22.2% O₂.",
    quote: {
      text: "The CIR chamber provides a level of containment and permits testing at variable oxygen concentrations and pressures representative of current and planned NASA space exploration atmospheres.",
      source: "NASA · Solid Fuel Ignition and Extinction (SoFIE)",
      url: "https://science.nasa.gov/biological-physical/investigations/sofie/",
    },
  },
  {
    id: "fm2",
    name: "FM2 · Flammability of Materials on the Moon",
    closes: "partial-gravity",
    what: "Material flammability in lunar gravity, which PSI does not hold yet.",
    quote: {
      text: "We expect such data will be added in the future, for example from the Lunar-g Combustion Investigation (LUCI) and the Flammability of Materials on the Moon (FM2) experiment.",
      ...CHALLENGE,
    },
  },
  {
    id: "luci",
    name: "LUCI · Lunar-g Combustion Investigation",
    closes: "partial-gravity",
    what: "Combustion data at lunar gravity, which PSI does not hold yet.",
    quote: {
      text: "We expect such data will be added in the future, for example from the Lunar-g Combustion Investigation (LUCI) and the Flammability of Materials on the Moon (FM2) experiment.",
      ...CHALLENGE,
    },
  },
];

/** NASA-stated uses of the PSI data for fire safety on Earth (challenge objective 4). */
export interface EarthLink {
  id: string;
  use: string;
  investigations: string[];
  quote: { accession: string; text: string; field: "earthBenefits" };
}

export const EARTH_LINKS: EarthLink[] = [
  {
    id: "earth-smoke-detectors",
    use: "Smoke detectors for submarines and underwater laboratories",
    investigations: ["same", "same-r"],
    quote: { accession: "PSI-102", field: "earthBenefits", text: "The smoke detectors developed from the results of SAME can also be useful in other extreme environments on Earth, such as submarines or underwater laboratories." },
  },
  {
    id: "earth-instruments",
    use: "Smoke-measuring instruments for hard-to-reach places",
    investigations: ["daft", "daft-2"],
    quote: { accession: "PSI-47", field: "earthBenefits", text: "Additionally, the successful adaptation of the TSI P-Trak for microgravity can inform the design of instruments for use in other challenging Earth environments, such as submarines or underwater laboratories where accurate detection of smoke can save lives." },
  },
  {
    id: "earth-confined-spaces",
    use: "Fire safety in mines, airplanes and submarines",
    investigations: ["saffire-i", "saffire-ii", "saffire-iii"],
    quote: { accession: "PSI-99", field: "earthBenefits", text: "Studying fire in small, sealed environments such as the Cygnus cargo supply vehicle benefits fire safety and prevention efforts on Earth, including inside mines, airplanes, or submarines." },
  },
  {
    id: "earth-suppressants",
    use: "More efficient, less harmful fire suppression systems",
    investigations: ["flex"],
    quote: { accession: "PSI-69", field: "earthBenefits", text: "The mission's findings on the effectiveness of various fire suppressants, including CO2, He, and SF6, in microgravity can lead to the development of more efficient and less harmful fire suppression systems, reducing the risk of toxic byproducts during fire events." },
  },
  {
    id: "earth-wildfire-models",
    use: "Models of wildfires and building fires",
    investigations: ["bass-ii"],
    quote: { accession: "PSI-25", field: "earthBenefits", text: "These models can then be used to more accurately study flames on Earth, such as in wildfires, building fires, energy recapture from waste recycling, and other combustion problems." },
  },
  {
    id: "earth-cone-calorimeter",
    use: "Performance-based material flammability testing (cone calorimeter)",
    investigations: ["bass", "acme-bre"],
    quote: { accession: "PSI-26", field: "earthBenefits", text: "These results are used in first order models and predictions of heat release in spacecraft fires and as a means to extend heat release data from tests like the NASA cone calorimeter test (NASA–STD–6001 Test 2) to a performance-based material selection process." },
  },
];
