import normalized from "./normalized-conditions.json";
import type { ConditionEnvelope, Investigation, PsiReference, Range } from "./types";

/*
 * Curated investigation profiles.
 *
 * Descriptions, hardware and fuel types follow the 2026 NASA Space Apps
 * "Flame in Freefall" challenge text and public NASA mission summaries.
 * Numeric condition ranges are deliberately sparse: a range is only filled
 * in where the nominal value is widely documented, and every range is marked
 * approximate. Unknown ranges stay null and earn no match points.
 *
 * Each profile is linked to its NASA Physical Science Informatics (PSI)
 * investigation record. Accessions were matched by acronym against the PSI
 * repository search on the verifiedOn date; `npm run sync:psi` refreshes the
 * stored snapshot (src/data/psi-snapshot.json) and the tests check every link.
 * PSI does not publish DOIs for investigation records.
 */

const PSI_VERIFIED_ON = "2026-11-14";

/** Profile id → PSI accession. DAFT and DAFT-2 share one PSI record. */
export const PSI_ACCESSIONS: Record<string, string> = {
  "acme-flame-design": "PSI-10",
  "acme-bre": "PSI-20",
  "acme-cld": "PSI-21",
  "acme-efield": "PSI-22",
  "acme-s-flame": "PSI-23",
  "bass-ii": "PSI-25",
  bass: "PSI-26",
  cfi: "PSI-39",
  daft: "PSI-47",
  "daft-2": "PSI-47",
  "flex-2": "PSI-68",
  flex: "PSI-69",
  "saffire-i": "PSI-98",
  "saffire-ii": "PSI-99",
  "saffire-iii": "PSI-100",
  "same-r": "PSI-101",
  same: "PSI-102",
  spice: "PSI-107",
  slice: "PSI-106",
  "acme-cfi-g": "PSI-159",
};

function psiRef(id: string): PsiReference {
  const accession = PSI_ACCESSIONS[id] ?? null;
  return accession
    ? { accession, url: `https://psi.nasa.gov/physci/repo/data/investigations/${accession}`, verifiedOn: PSI_VERIFIED_ON }
    : { accession: null, url: null, verifiedOn: null };
}

const MICROGRAVITY: Range = {
  min: 0,
  max: 0.001,
  basis: "Orbital free fall (ISS or Cygnus); residual accelerations well below 0.001 g",
};

const CABIN_AIR_O2: Range = { min: 20.5, max: 21.5, basis: "Nominal spacecraft cabin air, approximate" };
const CABIN_AIR_P: Range = { min: 14.2, max: 14.9, basis: "Nominal sea-level cabin pressure, approximate" };

const unknownExceptGravity: ConditionEnvelope = {
  oxygenPct: null,
  pressurePsi: null,
  gravityG: MICROGRAVITY,
  airflowMs: null,
};

const CURATED: Omit<Investigation, "psi">[] = [
  {
    id: "bass-ii",
    name: "BASS-II",
    fullName: "Burning and Suppression of Solids II",
    platform: "ISS",
    hardware: "SPICE flow duct · MSG",
    summary: "Examine solid-fuel flame spread and extinction across flow, oxygen and sample conditions.",
    fuelTypes: ["solid"],
    questions: ["prevention", "suppression"],
    adjacentQuestions: [],
    conditions: {
      oxygenPct: { min: 14, max: 21.5, basis: "Reduced-oxygen runs by nitrogen dilution up to cabin air, approximate" },
      pressurePsi: CABIN_AIR_P,
      gravityG: MICROGRAVITY,
      airflowMs: { min: 0, max: 0.5, basis: "Fan-driven duct flow from quiescent to tens of cm/s, approximate" },
    },
    measurements: ["Video of flame spread", "Flame extinction limits", "Duct flow speed"],
    caveats: ["Duct-scale samples; spacecraft-scale fire growth was studied separately in Saffire."],
  },
  {
    id: "bass",
    name: "BASS",
    fullName: "Burning and Suppression of Solids",
    platform: "ISS",
    hardware: "SPICE flow duct · MSG",
    summary: "Study burning and suppression of solid materials in microgravity.",
    fuelTypes: ["solid"],
    questions: ["prevention", "suppression"],
    adjacentQuestions: [],
    conditions: {
      oxygenPct: null,
      pressurePsi: CABIN_AIR_P,
      gravityG: MICROGRAVITY,
      airflowMs: { min: 0, max: 0.5, basis: "Fan-driven duct flow, approximate" },
    },
    measurements: ["Video of flame spread", "Extinguishment by nitrogen jet"],
    caveats: [],
  },
  ...(["I", "II", "III"] as const).map((n): Omit<Investigation, "psi"> => ({
    id: `saffire-${n.toLowerCase()}`,
    name: `Saffire-${n}`,
    fullName: `Spacecraft Fire Safety Demonstration ${n}`,
    platform: "Cygnus",
    hardware: "Saffire flow enclosure · Cygnus",
    summary:
      n === "II"
        ? "Ignite and burn a set of spacecraft materials inside an uncrewed Cygnus vehicle."
        : "Investigate spacecraft-scale solid-material fire behavior.",
    fuelTypes: ["solid"],
    questions: ["prevention", "detection"],
    adjacentQuestions: ["suppression"],
    conditions: {
      oxygenPct: CABIN_AIR_O2,
      pressurePsi: CABIN_AIR_P,
      gravityG: MICROGRAVITY,
      airflowMs: { min: 0.15, max: 0.25, basis: "Forced flow of roughly 20 cm/s through the enclosure, approximate" },
    },
    measurements: ["Flame spread video", "Cabin O₂ and CO₂", "Temperature", "Combustion products"],
    caveats: ["Run in cabin air only; no elevated-oxygen exploration atmosphere."],
  })),
  {
    id: "flex",
    name: "FLEX",
    fullName: "Flame Extinguishment Experiment",
    platform: "ISS",
    hardware: "MDCA · CIR",
    summary: "Burn isolated fuel droplets and measure extinction when the chamber is diluted with CO₂ or helium.",
    fuelTypes: ["liquid"],
    questions: ["suppression"],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Droplet diameter history", "Flame radiation", "Extinction diameter"],
    caveats: ["Fuel droplets, not cabin materials."],
  },
  {
    id: "flex-2",
    name: "FLEX-2",
    fullName: "Flame Extinguishment Experiment 2",
    platform: "ISS",
    hardware: "MDCA · CIR",
    summary: "Extend droplet combustion to fuel mixtures, droplet pairs and arrays.",
    fuelTypes: ["liquid"],
    questions: [],
    adjacentQuestions: ["suppression", "prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Droplet burning rate", "Soot formation"],
    caveats: [],
  },
  {
    id: "cfi",
    name: "CFI",
    fullName: "Cool Flames Investigation",
    platform: "ISS",
    hardware: "MDCA · CIR",
    summary: "Study low-temperature 'cool flames' that persist after hot flame extinction of fuel droplets.",
    fuelTypes: ["liquid"],
    questions: [],
    adjacentQuestions: ["suppression"],
    conditions: unknownExceptGravity,
    measurements: ["Droplet history", "Cool-flame lifetime"],
    caveats: ["Cool flames can continue after visible flame extinction."],
  },
  {
    id: "acme-bre",
    name: "BRE",
    fullName: "Burning Rate Emulator",
    project: "ACME",
    platform: "ISS",
    hardware: "ACME modular hardware · CIR",
    summary: "Emulate burning of solid materials with gaseous fuel to study flammability in still atmospheres.",
    fuelTypes: ["gas"],
    emulates: "solid",
    questions: ["prevention"],
    adjacentQuestions: [],
    conditions: {
      ...unknownExceptGravity,
      // The run table has no pressure column; NASA's PSI-20 objectives name the three atmospheres.
      pressurePsi: { min: 8.2, max: 14.7, basis: "Atmospheres named in NASA's PSI-20 objectives: 14.7 psia at 21% O2, 10.2 psia at 26.5%, 8.2 psia at 34%" },
      airflowMs: { min: 0, max: 0.01, basis: "Still (quiescent) atmosphere" },
    },
    measurements: ["Heat flux", "Flame extinction", "Fuel flow rate"],
    caveats: ["Gaseous emulator of solid burning, not a real material sample."],
  },
  {
    id: "acme-cfi-g",
    name: "CFI-G",
    fullName: "Cool Flames Investigation with Gases",
    project: "ACME",
    platform: "ISS",
    hardware: "ACME modular hardware · CIR",
    summary: "Inside-out spherical flames with oxygen-enriched oxidizer flowing from a porous burner.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Flame radius", "Radiative emission"],
    caveats: [],
  },
  {
    id: "acme-efield",
    name: "E-FIELD Flames",
    fullName: "Electric-Field Effects on Laminar Diffusion Flames",
    project: "ACME",
    platform: "ISS",
    hardware: "ACME modular hardware · CIR",
    summary: "Apply electric fields to the ions in flames, a body force that partly mimics gravity.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Ion current", "Flame shape"],
    caveats: ["Electric-field effects are not lunar-gravity measurements."],
    gravityAnalogue: {
      text: "An electric field acting on the ions in a flame adds a body force, which the challenge describes as mimicking partial gravity. Gas-jet flames, not materials.",
      quote: "Partial gravity was mimicked in ACME’s Electric-Field Effects on Laminar Diffusion Flames (E-FIELD Flames) experiment through the effect of the electric field on the ions that naturally occur in flames.",
      source: { label: "NASA Space Apps 2026 · Flame in Freefall challenge", href: "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" },
    },
  },
  {
    id: "acme-cld",
    name: "CLD Flame",
    fullName: "Coflow Laminar Diffusion Flame",
    project: "ACME",
    platform: "ISS",
    hardware: "ACME modular hardware · CIR",
    summary: "Laminar gas-jet flames in a coflow of air for soot and lift-off studies.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Flame shape", "Soot volume fraction"],
    caveats: [],
  },
  {
    id: "acme-flame-design",
    name: "Flame Design",
    fullName: "Flame Design",
    project: "ACME",
    platform: "ISS",
    hardware: "ACME modular hardware · CIR",
    summary: "Spherical gas flames to understand how flame structure controls soot formation.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Soot", "Flame temperature"],
    caveats: [],
  },
  {
    id: "acme-s-flame",
    name: "s-Flame",
    fullName: "Structure and Response of Spherical Diffusion Flames",
    project: "ACME",
    platform: "ISS",
    hardware: "ACME modular hardware · CIR",
    summary: "Spherical diffusion flames for validating combustion models and extinction behavior.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Flame radius", "Extinction"],
    caveats: [],
  },
  {
    id: "spice",
    name: "SPICE",
    fullName: "Smoke Point In Co-flow Experiment",
    platform: "ISS",
    hardware: "SPICE flow duct · MSG",
    summary: "Measure smoke points of gas-jet flames in co-flowing air.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["detection", "prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Smoke point", "Flame length"],
    caveats: [],
  },
  {
    id: "slice",
    name: "SLICE",
    fullName: "Structure & Liftoff In Combustion Experiment",
    platform: "ISS",
    hardware: "SPICE flow duct · MSG",
    summary: "Study lifted and attached gas-jet flames in co-flow.",
    fuelTypes: ["gas"],
    questions: [],
    adjacentQuestions: ["prevention"],
    conditions: unknownExceptGravity,
    measurements: ["Lift-off height", "Flame stability"],
    caveats: [],
  },
  {
    id: "same",
    name: "SAME",
    fullName: "Smoke and Aerosol Measurement Experiment",
    platform: "ISS",
    hardware: "SAME hardware · MSG",
    summary: "Characterize smoke particles from overheated spacecraft materials to inform smoke detectors.",
    fuelTypes: ["solid"],
    questions: ["detection"],
    adjacentQuestions: [],
    conditions: unknownExceptGravity,
    measurements: ["Particle size distribution", "Particle count"],
    caveats: ["Smoke from heated (pyrolyzing) materials, not flaming combustion."],
  },
  {
    id: "same-r",
    name: "SAME-R",
    fullName: "Smoke and Aerosol Measurement Experiment – Reflight",
    platform: "ISS",
    hardware: "SAME hardware · MSG",
    summary: "Reflight of SAME with additional materials and aging of smoke particles.",
    fuelTypes: ["solid"],
    questions: ["detection"],
    adjacentQuestions: [],
    conditions: unknownExceptGravity,
    measurements: ["Particle size distribution", "Smoke aging"],
    caveats: [],
  },
  {
    id: "daft",
    name: "DAFT",
    fullName: "Dust and Aerosol Measurement Feasibility Test",
    platform: "ISS",
    hardware: "Smoke-detection instrument · ISS cabin",
    summary: "Use a SAME smoke instrument to measure dust in the ISS cabin.",
    fuelTypes: [],
    questions: [],
    adjacentQuestions: ["detection"],
    conditions: { ...unknownExceptGravity, oxygenPct: CABIN_AIR_O2, pressurePsi: CABIN_AIR_P },
    measurements: ["Dust particle counts"],
    caveats: ["Dust background, not combustion; relevant to false alarms."],
  },
  {
    id: "daft-2",
    name: "DAFT-2",
    fullName: "Dust and Aerosol Measurement Feasibility Test 2",
    platform: "ISS",
    hardware: "Smoke-detection instrument · ISS cabin",
    summary: "Follow-on dust measurements in the ISS cabin.",
    fuelTypes: [],
    questions: [],
    adjacentQuestions: ["detection"],
    conditions: { ...unknownExceptGravity, oxygenPct: CABIN_AIR_O2, pressurePsi: CABIN_AIR_P },
    measurements: ["Dust particle counts"],
    caveats: [],
  },
];

type NormalizedCondition = { min: number; max: number; column: string; sourceUnit: string; rowsUsed: number; dropped: number; approx: boolean };
type NormalizedProfile = {
  accession: string;
  table: string;
  file: string;
  sha256: string;
  totalRows: number;
  conditions: Partial<Record<"oxygenPct" | "pressurePsi" | "airflowMs", NormalizedCondition>>;
  materials?: string[];
  flowDirections?: ("opposed" | "concurrent")[];
  /** Inverse flames: oxygen fed through the burner, not the surrounding atmosphere. */
  burnerOxygen?: { min: number; max: number; table: string; column: string; rowsUsed: number; totalRows: number };
};
export const NORMALIZED = normalized as { method: string; profiles: Record<string, NormalizedProfile> };

/**
 * Replace curated approximations with ranges read from the NASA PSI run table
 * wherever the table states the condition with a unit (scripts/normalize-conditions.mjs).
 * Curated ranges remain only where no table column exists, and stay labelled as such.
 */
function withPsiTables(inv: Omit<Investigation, "psi">): Omit<Investigation, "psi"> {
  const n = NORMALIZED.profiles[inv.id];
  const conditions: ConditionEnvelope = { ...inv.conditions };
  for (const key of ["oxygenPct", "pressurePsi", "gravityG", "airflowMs"] as const) {
    const r = conditions[key];
    if (r) conditions[key] = { source: "curated", ...r };
  }
  if (!n) return { ...inv, conditions };
  for (const [key, c] of Object.entries(n.conditions) as [keyof typeof n.conditions, NormalizedCondition][]) {
    conditions[key] = {
      min: c.min,
      max: c.max,
      basis: `NASA ${n.table} run table, column "${c.column}" (${c.sourceUnit}), ${c.rowsUsed} of ${n.totalRows} rows${c.approx ? "; some values marked approximate in the source" : ""}`,
      source: "psi-table",
      table: n.table,
      column: c.column,
      rowsUsed: c.rowsUsed,
      totalRows: n.totalRows,
    };
  }
  return {
    ...inv,
    conditions,
    ...(n.materials ? { testedMaterials: n.materials } : {}),
    ...(n.flowDirections ? { testedFlowDirections: n.flowDirections } : {}),
    ...(n.burnerOxygen
      ? {
          burnerOxygen: n.burnerOxygen,
          caveats: [
            ...inv.caveats,
            `Inverse flames fed up to ${n.burnerOxygen.max}% O₂ through the burner (NASA ${n.burnerOxygen.table}, ${n.burnerOxygen.rowsUsed} runs). That is the oxygen in the burner stream, not the surrounding atmosphere, so it is not used as an ambient range.`,
          ],
        }
      : {}),
  };
}

export const INVESTIGATIONS: Investigation[] = CURATED.map((inv) => ({ ...withPsiTables(inv), psi: psiRef(inv.id) }));

export function getInvestigation(id: string): Investigation | undefined {
  return INVESTIGATIONS.find((inv) => inv.id === id);
}
