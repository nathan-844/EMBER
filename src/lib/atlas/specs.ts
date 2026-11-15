// Per-table extraction rules for the Fire Test Atlas. Each NASA table gets one spec saying which
// column feeds which atlas field, in which unit, and how its outcome column (if any) is read.
// Columns are named exactly as NASA wrote them (whitespace-insensitive); a renamed column fails
// the build instead of silently dropping data.
import type { FuelClass, Outcome, RowKind } from "./types";

export const ATM_PSI = 14.6959;
export const BAR_PSI = 14.5038;
export const MMHG_PSI = 14.6959 / 760;

export type Get = (col: string) => string;

export interface QSpec {
  col: string;
  /** Unit of the atlas value. */
  unit: string;
  /** Unit NASA states for the source (header or cell); conversions only happen when it is stated. */
  from: string;
  factor?: number;
  parser?: "parseCell" | "pctO2InText";
  /** Codes added to every value read from this column (see FLAG_TEXT). */
  flags?: string[];
  /** The source writes 0 where it holds no value (e.g. a particle diameter that was never reduced); 0 is read as no value. */
  zeroIsMissing?: true;
}
export interface TSpec {
  col: string;
  text: true;
  flags?: string[];
}

export interface OutcomeResult {
  value: Outcome;
  rule: string;
  col?: string;
}

export interface TableSpec {
  /** Investigation id, or a rule when one table holds rows of two investigations. */
  investigation: string | ((get: Get) => string);
  /** Column holding the material or fuel label, or a fixed label when the table has one fuel. */
  material: { col: string } | { fixed: string; why: string };
  fuelClass?: FuelClass;
  flameConfig?: "normal" | "inverse";
  rowKind: (get: Get, isBlank: boolean) => RowKind | [RowKind, string];
  o2Pct?: QSpec;
  o2PctEnd?: QSpec;
  burnerO2Pct?: QSpec;
  pressurePsi?: QSpec;
  flowCms?: QSpec;
  flowDirection?: string;
  diluent?: { n2?: QSpec; co2?: QSpec; he?: QSpec };
  outcome?: (get: Get) => OutcomeResult;
  measures?: Record<string, QSpec | TSpec>;
  /** Extra row-level checks; return flag codes. */
  rowFlags?: (get: Get) => string[];
  /**
   * Reviewed experiment identity: a key unique to one run within the investigation, the row's role
   * in that run, and how the grouping is known. Only tables whose identities EMBER has reviewed set it.
   */
  experiment?: (get: Get) => { key: string; role: "run" | "aged"; basis: string } | null;
}

const molePct = (col: string, flags?: string[]): QSpec => ({ col, unit: "%", from: "mole fraction", factor: 100, flags });
const pct = (col: string): QSpec => ({ col, unit: "%", from: "vol %" });
const atm = (col: string): QSpec => ({ col, unit: "psia", from: "atm", factor: ATM_PSI });
const cms = (col: string): QSpec => ({ col, unit: "cm/s", from: "cm/s" });
const plain = (col: string, unit: string): QSpec => ({ col, unit, from: unit });
const text = (col: string): TSpec => ({ col, text: true });

const test = (): RowKind => "test";
/**
 * SAME and SAME-R number each run; a label ending in "a" ("61a") is the same run's smoke measured
 * again after ageing. A run's identity is its sample material plus the number, because NASA's
 * SAME-R run table uses "57" under two materials.
 */
const sameExperiment = (material: string, label: string) => {
  const n = label.trim();
  if (!n) return null;
  const aged = /a$/i.test(n);
  return {
    key: `${material.trim().toLowerCase()}:${n.replace(/a$/i, "")}`,
    role: aged ? ("aged" as const) : ("run" as const),
    basis: `NASA's SAME test number "${n}" under sample type "${material.trim()}"${aged ? '; the "a" suffix marks the aged measurement of that run' : ""}`,
  };
};

const session = (why: string) => (_g: Get, blank: boolean): RowKind | [RowKind, string] => (blank ? ["aside", "blank row"] : ["session", why]);
const ASIDE_LABEL = /flow visuali?s?ation|visulation|soot cleaning/i;
const solidRow = (materialCol: string) => (g: Get, blank: boolean): RowKind | [RowKind, string] => {
  if (blank) return ["aside", "blank row"];
  if (ASIDE_LABEL.test(g(materialCol))) return ["aside", `not a test: "${g(materialCol).trim()}"`];
  return "test";
};

/** Saffire µg burn length → outcome. Burn length ~0 means the igniter fired but no flame spread. */
function saffireBurn(burnCol: string, lengthCol: string) {
  return (g: Get): OutcomeResult => {
    const raw = g(burnCol).trim();
    if (!raw) return { value: "not-recorded", rule: "burn length blank" };
    const n = /(\d*\.?\d+)/.exec(raw);
    if (!n) return { value: "not-recorded", rule: "burn length has no number" };
    const len = Number(n[1]);
    const sample = Number(/(\d*\.?\d+)\s*cm/.exec(g(lengthCol))?.[1] ?? NaN);
    if (len === 0) return { value: "no-spread", rule: "µg burn length ~0: the igniter fired but the flame did not spread", col: burnCol };
    if (sample && len >= sample) return { value: "burned-out", rule: "µg burn length equals the sample length: the whole sample burned", col: burnCol };
    return { value: "burned", rule: "µg burn length > 0 but less than the sample length", col: burnCol };
  };
}

function cfiGOutcome(hotCol: string, endCol: string) {
  return (g: Get): OutcomeResult => {
    const hot = g(hotCol).trim().toLowerCase();
    const end = g(endCol).trim();
    if (hot === "no") return { value: "no-ignition", rule: `"${hotCol.trim()}" = No`, col: hotCol };
    if (hot === "flash") return { value: "flash", rule: `"${hotCol.trim()}" = flash`, col: hotCol };
    if (hot !== "yes") return { value: "not-recorded", rule: `"${hotCol.trim()}" blank` };
    if (end === "SE") return { value: "extinguished", rule: "hot ignition, then SE (self-extinguished)", col: endCol };
    if (end === "FT") return { value: "terminated", rule: "hot ignition, then FT (fuel flow terminated)", col: endCol };
    return { value: "burned", rule: "hot ignition; end not recorded (\"-\")", col: hotCol };
  };
}

export const SPECS: Record<string, TableSpec> = {
  // ACME Flame Design, normal flames: fuel from a porous sphere into O2/N2.
  "PSI-10-0": {
    investigation: "acme-flame-design",
    material: { col: "Fuel" },
    flameConfig: "normal",
    rowKind: test,
    o2Pct: molePct("XO2 (init)"),
    o2PctEnd: molePct("XO2 (final)"),
    pressurePsi: atm("pinit (atm)"),
    measures: {
      fuelMoleFraction: plain("Xfuel", "mole fraction"),
      fuelFlowMgS: plain("mfuel (mg/s)", "mg/s"),
      stoichMixtureFraction: plain("mean Zst", "-"),
      adiabaticFlameTempK: plain("Tad (K)", "K"),
    },
    rowFlags: (g) => (/^\s*ramp/i.test(g("Xfuel")) ? ["ramped"] : []),
  },
  // ACME Flame Design, inverse flames: oxygen from the sphere into an ethylene atmosphere.
  "PSI-10-1": {
    investigation: "acme-flame-design",
    material: { fixed: "C2H4", why: "the ambient fuel is ethylene (columns \"XC2H4 initial/final\")" },
    flameConfig: "inverse",
    rowKind: test,
    burnerO2Pct: molePct("XO2"),
    pressurePsi: atm("pinit (atm)"),
    measures: {
      ambientFuelMoleFraction: plain("XC2H4 initial", "mole fraction"),
      oxygenFlowMgS: plain("mO2 (mg/s)", "mg/s"),
      stoichMixtureFraction: plain("mean Zst", "-"),
      adiabaticFlameTempK: plain("Tad (K)", "K"),
    },
  },
  // ACME BRE: one row per test day; several O2 levels per day.
  "PSI-20-0": {
    investigation: "acme-bre",
    material: { col: "Fuel Bottle" },
    rowKind: session("one row per test day; \"Flames Ignited\" counts the flames that day"),
    o2Pct: pct("Oxygen Conc (percent)"),
    measures: { burnerSizeMm: plain("Burner Size (mm)", "mm"), flamesIgnited: plain("Flames Ignited", "count") },
  },
  "PSI-21-0": {
    investigation: "acme-cld",
    material: { col: "Fuel Bottle" },
    rowKind: session("one row per test day; \"Flames ignited\" counts the flames that day"),
    measures: { fuelConcRange: text("Fuel conc. Range"), flamesIgnited: plain("Flames ignited", "count") },
  },
  "PSI-22-0": {
    investigation: "acme-efield",
    material: { col: "Fuel Bottle" },
    rowKind: (g, blank) => {
      if (blank) return ["aside", "blank row"];
      // A line with only "Fuel Conc" filled continues the test day above it.
      if (!g("Test Day").trim() && !g("Fuel Bottle").trim()) return ["aside", "continuation line: lists one more fuel concentration for the test day above"];
      return ["session", "one row per test day; \"Flames Ignited\" counts the flames that day"];
    },
    measures: { meshPolarity: text("Mesh Polarity"), fuelConc: text("Fuel Conc"), flamesIgnited: plain("Flames Ignited", "count") },
  },
  "PSI-23-0": {
    investigation: "acme-s-flame",
    material: { col: "Fuel Bottle" },
    rowKind: session("one row per test day; \"Flames Ignited\" counts the flames that day"),
    o2Pct: { col: "Atmosphere*", unit: "%", from: "% O2 in text", parser: "pctO2InText" },
    measures: { atmosphere: text("Atmosphere*"), flamesIgnited: plain("Flames Ignited*", "count") },
  },
  // BASS-II: one row per burn in the MSG; O2 and carbon oxides before and after.
  "PSI-25-0": {
    investigation: "bass-ii",
    material: { col: "Fuel Sample Material" },
    fuelClass: "solid",
    rowKind: solidRow("Fuel Sample Material"),
    o2Pct: pct("Calibrated  initial O2 % by vol "),
    o2PctEnd: pct("Calibrated final O2 % by vol"),
    measures: {
      co2StartPct: plain("Initial CO2 % by vol", "vol %"),
      co2EndPct: plain("Final CO2 % by vol", "vol %"),
      coStartPpm: plain("Initial CO (ppm)", "ppm"),
      coEndPpm: plain("Final CO (ppm)", "ppm"),
      fanDisplay: text("Fan display"),
      airDisplay: text("Air display"),
      framesShot: text("Total Frames Shot"),
    },
    rowFlags: (g) => {
      const a = Number(g("Calibrated  initial O2 % by vol ")), b = Number(g("Calibrated final O2 % by vol"));
      return g("Calibrated final O2 % by vol").trim() && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 5 ? ["o2-end-implausible"] : [];
    },
  },
  "PSI-26-0": {
    investigation: "bass",
    material: { col: "Fuel Sample Material" },
    fuelClass: "solid",
    rowKind: solidRow("Fuel Sample Material"),
  },
  // CFI: one row per droplet test.
  "PSI-39-0": {
    investigation: "cfi",
    material: { col: "Fuel " },
    rowKind: (_g, blank) => (blank ? ["aside", "blank row"] : "test"),
    o2Pct: molePct("Oxygen"),
    pressurePsi: atm("Pressure"),
    diluent: { n2: plain("Nitrogen", "mole fraction"), he: plain("Helium", "mole fraction") },
    measures: { fiberSupported: text("Fiber") },
  },
  "PSI-47-0": {
    investigation: "daft",
    material: { col: "Sample Material" },
    fuelClass: "aerosol",
    rowKind: session("one row per measurement session (dust aerosol, not a fire)"),
    measures: { hardware: text("Hardware Description"), location: text("Sampled Location") },
  },
  // FLEX-2: the PSI table is the test matrix (levels per fuel), not individual runs.
  "PSI-68-0": {
    investigation: "flex-2",
    material: { col: "Sample (Fuel Type)" },
    rowKind: () => ["matrix", "one row per fuel listing the levels tested, not individual runs"],
    o2Pct: molePct("Oxygen Mole Fraction"),
    pressurePsi: atm("Ambient Pressure (atm)"),
    flowCms: cms("Flow Velocity (cm/s)"),
    measures: { dropletDiameterMm: plain("Initial Droplet Diameter (mm)", "mm"), ambientGas: text("Ambient Gas Mixture ") },
  },
  // FLEX: one row per droplet burn, with the end of each burn.
  "PSI-69-0": {
    investigation: "flex",
    material: { col: "Fuel" },
    rowKind: test,
    o2Pct: molePct("O initial ambient composition; mole fraction", ["header-subscript-lost"]),
    pressurePsi: { col: "Ambient pressure; mmHg", unit: "psia", from: "mmHg", factor: MMHG_PSI },
    diluent: {
      n2: { ...plain("N initial ambient composition; mole fraction", "mole fraction"), flags: ["header-subscript-lost"] },
      co2: { ...plain("CO initial ambient composition; mole fraction", "mole fraction"), flags: ["header-subscript-lost"] },
      he: plain("He initial ambient composition; mole fraction", "mole fraction"),
    },
    outcome: (g) => {
      const e = g("Test end").trim();
      const map: Record<string, Outcome> = { Extinction: "extinguished", Completion: "burned-out", Disruption: "disrupted" };
      return map[e]
        ? { value: map[e], rule: `"Test end" = ${e}`, col: "Test end" }
        : { value: "not-recorded", rule: "\"Test end\" blank" };
    },
    measures: {
      dropletDiameterMm: plain("Droplet initial diameter; mm", "mm"),
      extinctionDiameterMm: plain("Visible flame extinction diameter; mm", "mm"),
      burningRate: { ...plain("Burning rate; mm", "as stated (mm)"), flags: ["unit-doubtful"] },
      burnTimeS: plain("Burn time; s", "s"),
    },
  },
  // Saffire-I: two large SIBAL sheets.
  "PSI-98-0": {
    investigation: "saffire-i",
    material: { col: "Material" },
    fuelClass: "solid",
    rowKind: solidRow("Material"),
    o2Pct: pct("Percent O2"),
    flowCms: cms("Air Flow (cm/s)"),
    flowDirection: "Flow Direction ",
    outcome: (g) =>
      Number(g("Burn Time (s)")) > 0
        ? { value: "burned", rule: "a burn time is recorded", col: "Burn Time (s)" }
        : { value: "not-recorded", rule: "no burn time" },
    measures: {
      thicknessCm: plain("Sample Thickness (cm)", "cm"),
      lengthCm: plain("Sample Length (cm)", "cm"),
      widthCm: plain("Sample Width (cm)", "cm"),
      ignitionPowerW: plain("Ignition Power (W)", "W"),
      burnTimeS: plain("Burn Time (s)", "s"),
    },
    rowFlags: (g) => (g("Sample Length (cm)").trim() === "40.6" && g("Sample Width (cm)").trim() === "94" ? ["length-width-swapped"] : []),
  },
  // Saffire-II: nine samples, each with a µg burn and a matching 1-g ground test.
  "PSI-99-0": {
    investigation: "saffire-ii",
    material: { col: "Material" },
    fuelClass: "solid",
    rowKind: solidRow("Material"),
    o2Pct: pct("Percent O2 (Note 1)"),
    flowCms: cms("Air Flow (cm/s)"),
    flowDirection: "Flow Direction",
    outcome: saffireBurn("?-g Burn Length", "Sample Length "),
    measures: {
      sample: text("Sample Number"),
      thicknessMm: { ...plain("Samle Thickness ", "mm"), flags: ["header-typo"] },
      lengthCm: plain("Sample Length ", "cm"),
      widthCm: plain("Sample Width (cm)", "cm"),
      ignitionPowerW: plain("Ignition Power (W)", "W"),
      burnTimeS: plain("Burn Time (s)", "s"),
      burnLengthMicrogravityCm: { ...plain("?-g Burn Length", "cm"), flags: ["header-encoding"] },
      spreadRateMicrogravity: { ...text("?-g Spread Length"), flags: ["header-encoding"] },
      burnLength1g: text("1-g Burn Length"),
      spreadRate1g: text("1-g Spread Rate"),
    },
    rowFlags: (g) => [
      ...(g("Material").trim() === "" && g("Sample Number").trim() && g("Burn Time (s)").trim() ? ["material-blank"] : []),
    ],
  },
  "PSI-100-0": {
    investigation: "saffire-iii",
    material: { col: "Material" },
    fuelClass: "solid",
    rowKind: solidRow("Material"),
    flowCms: cms("Air Flow "),
    flowDirection: "Direction",
    measures: { thicknessCm: plain("Sample Thickness", "cm"), lengthCm: plain("Sample Length", "cm"), widthCm: plain("Sample Width", "cm") },
  },
  // SAME-R: smoke from heated (not burning) materials, aged and measured.
  "PSI-101-0": {
    investigation: "same-r",
    material: { col: "Sample Type" },
    rowKind: (_g, blank) => (blank ? ["aside", "blank row"] : "test"),
    flowCms: cms("Inlet velocity (cm/s)"),
    measures: {
      sameTest: text("SAME Test #"),
      description: text("Description"),
      rtOverR0: plain("Rt/R0", "-"),
      durationS: plain("Duration (sec)", "s"),
      netAgingTimeS: plain("Net aging time (sec)", "s"),
    },
    experiment: (get) => sameExperiment(get("Sample Type"), get("SAME Test #")),
  },
  // NASA's SAME and SAME-R results workbook (sheet "Reduced data sheet"), stored by
  // scripts/sync-same-results.py: one row per flight test with the particle sizes measured.
  // Flight 1 rows are SAME's tests. Flight 2 rows repeat SAME-R tests that PSI-101-0 already lists,
  // so they are supplements: those tests' results, not counted twice. Rows numbered "…a" are the same
  // run measured again after the smoke aged, as PSI-101-0 also lists them; `experiment` groups them.
  //
  // Zeros: a particle diameter or geometric spread of 0 is not a physical result. In this sheet it
  // marks a row with no reduced value: all 20 SAME DBP rows (every reduced result is 0, although the
  // workbook's separate "DBP" sheet holds their raw particle-counter readings) and three SAME-R
  // Kapton rows whose particle counter gave no count ("no Ptrak"), so no mean diameter exists.
  // A 0 here means "not in this sheet", not "nothing was measured".
  "PSI-101-1": {
    investigation: (get) => (get("Flight 1=same 2=sameR, g=ground").trim() === "1" ? "same" : "same-r"),
    material: { col: "Sample Type" },
    rowKind: (get, blank) =>
      blank ? ["aside", "blank row"]
      : get("Flight 1=same 2=sameR, g=ground").trim() === "2" ? ["supplement", `results of SAME-R test ${get("SAME #").trim()}, whose conditions are the test row in PSI-101-0`]
      : "test",
    flowCms: cms("Inlet Velocity (cm/sec)"),
    measures: {
      sameTest: text("SAME #"),
      description: text("Description"),
      rtOverR0: plain("Rt/R0", "-"),
      netAgingS: plain("Net Aging  Duration", "s"),
      amdUm: { col: "M1/M0 (micro-m)--AMD", unit: "µm", from: "µm", zeroIsMissing: true },
      massMeanUm: { col: "Diameter of Average mass (micro-m)", unit: "µm", from: "µm", zeroIsMissing: true },
      sigmaG: { col: "Hatch Choate Sigma g", unit: "-", from: "-", zeroIsMissing: true },
      sampleTempC: plain("Sample Temperature C", "°C"),
      massLossMg: plain("Mass Loss (mg)", "mg"),
    },
    experiment: (get) => sameExperiment(get("Sample Type"), get("SAME #")),
  },
  // SAME's run table is a test matrix: one line per sample type and its conditions ("Kapton: same
  // conditions as 1-4"). The flight tests themselves are in NASA's results workbook (PSI-101-1).
  "PSI-102-0": {
    investigation: "same",
    material: { col: "Sample Material  " },
    rowKind: (_g, blank) => (blank ? ["aside", "blank row"] : ["matrix", "one line per sample type and condition set; SAME's flight tests are listed in NASA's results workbook (PSI-101-1)"]),
    flowCms: cms("Air Flow (cm/s)"),
    measures: { weightLossRateMgMin: plain("Weight loss rate (mg/min)", "mg/min"), agingMin: plain("Aging Duration (minutes)", "min") },
  },
  "PSI-106-0": {
    investigation: "slice",
    material: { col: "Fuel Type" },
    rowKind: session("one row per test day, naming the fuel"),
  },
  // SPICE: one row per jet flame (smoke-point study); coflow air speed recorded.
  "PSI-107-0": {
    investigation: "spice",
    material: { col: "Fuel" },
    rowKind: (_g, blank) => (blank ? ["aside", "blank row"] : "test"),
    flowCms: cms("Air Rate (cm/s)"),
    measures: { nozzleMm: plain("Nozzle (mm)", "mm"), fuelRateMgS: plain("Fuel Rate (mg/s)", "mg/s") },
  },
  // Cool-flame counterflow analysis (PSI-142): the table indexes the datasets behind figures in
  // published papers (description, DOI, figure number). No row is a test, so none is counted as one.
  "PSI-142-0": {
    investigation: "cool-flame-counterflow",
    material: { fixed: "not recorded", why: "the table lists datasets and the papers they appear in, not fuels" },
    rowKind: (_g, blank) => (blank ? ["aside", "blank row"] : ["aside", "dataset index: one row per figure in a published paper, not a test"]),
    measures: { dataset: text("Data Description"), publication: text("Reference Publication Link"), figure: text("Figure ID in Reference") },
  },
  // ACME CFI-G, normal flames: cool-flame search with gaseous fuels.
  "PSI-159-0": {
    investigation: "acme-cfi-g",
    material: { col: "Fuel" },
    flameConfig: "normal",
    rowKind: test,
    o2Pct: molePct(" XO2 before test"),
    o2PctEnd: molePct("XO2  after test"),
    pressurePsi: { col: "approx p (bar)", unit: "psia", from: "bar", factor: BAR_PSI },
    outcome: cfiGOutcome("Hot ignition", "Self-ext or flow term"),
    measures: {
      coolFlame: text("Cool flame?"),
      fuelMoleFraction: plain("Xf", "mole fraction"),
      adiabaticFlameTempK: plain("Tad (K)", "K"),
      burnTimeS: plain("burn time (sec)", "s"),
      peakBurnerTempC: plain("Peak burner T (C )", "°C"),
      comments: text("Comments"),
    },
  },
  "PSI-159-1": {
    investigation: "acme-cfi-g",
    material: { col: "Fuel" },
    flameConfig: "inverse",
    rowKind: test,
    burnerO2Pct: molePct("XO2"),
    pressurePsi: { col: "approx p (bar)", unit: "psia", from: "bar", factor: BAR_PSI },
    outcome: cfiGOutcome("Hot ignition", "Self -ext or flow term"),
    measures: {
      ambientFuelMoleFraction: plain("Xf  before test", "mole fraction"),
      adiabaticFlameTempK: plain("Tad (K)", "K"),
      burnTimeS: plain("burn time (sec)", "s"),
      color: text("Color"),
      comments: text("Comments"),
    },
  },
};

/** Plain-language meaning of every flag code. */
export const FLAG_TEXT: Record<string, string> = {
  "out-of-range": "The value is outside physical limits for its quantity, so it is not used (the raw cell is kept).",
  "leading-zero": "A number written with a leading zero and no decimal point (e.g. \"037 mm\"), so its magnitude is ambiguous; not used.",
  "not-numeric": "The cell holds text, not a number; kept as written.",
  "negative-reading": "A negative instrument reading (e.g. CO of -1 ppm); kept as written.",
  "zero-placeholder": "A particle diameter or geometric spread written as 0. Neither can be 0 for an aerosol, so the 0 stands for a value this sheet does not hold: the row's size results were never reduced here, or its particle counter gave no count. Read as no value, never as zero. It does not mean the run was not measured.",
  ramped: "NASA marks the flow as RAMPED, so the run has no single fuel fraction or flow.",
  "header-subscript-lost": "NASA's header lost its subscripts (\"O\" is O₂, \"CO\" is CO₂ in FLEX); read with that meaning.",
  "header-encoding": "NASA's header lost the µ (\"?-g\" is µ-g); read with that meaning.",
  "header-typo": "NASA's header has a typo (\"Samle Thickness\"); read with its evident meaning.",
  "unit-doubtful": "The header's unit (mm) does not fit a burning rate; values are kept in the unit as stated.",
  "o2-end-implausible": "Final O₂ differs from initial O₂ by more than 5 points in one burn, which a glovebox burn cannot do; likely a transcription slip.",
  "length-width-swapped": "Length and width are the reverse of the Saffire-III table for the same 94 × 40.6 cm sheet format.",
  "material-blank": "The material cell is blank on a row with test data; EMBER does not fill it in.",
  "label-fill-down": "The fuel label counts up row by row (\"40% CH5\", \"CH6\"…, or \"N3\", \"N4\"…), a spreadsheet fill-down; the real gas is not stated.",
  "label-typo": "The label has a typo (e.g. \"blac\", \"2ide\", \"parrafin\"); matched with its evident meaning.",
  censored: "The reading was off the instrument's scale (\">500\", \"OR\", \"over\"); no number is used.",
  "spreadsheet-error": "The cell holds a spreadsheet error (e.g. \"#DIV/0!\").",
  "cell-unit-converted": "The cell states its own unit, different from the column's (e.g. \"1 cm\" under a mm thickness); converted.",
  "unit-mismatch": "The cell states a unit that cannot be converted to the column's unit; not used.",
};
