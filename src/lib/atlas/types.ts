// EMBER Fire Test Atlas: one record per NASA source row, in one schema, with the source cell
// behind every value. Built by scripts/build-atlas.ts into src/data/atlas/.

export type FuelClass = "solid" | "liquid" | "gas" | "aerosol";

/**
 * test    – one experiment run (one ignition attempt, droplet, sample or aging run)
 * session – one row summarising several runs (e.g. ACME "Flames ignited: 10" for a test day)
 * matrix  – a test-matrix summary listing the levels tested, not individual runs (FLEX-2)
 * aside   – a row that is not a test (flow visualisation, cleaning run, blank row)
 */
export type RowKind = "test" | "session" | "matrix" | "aside";

/**
 * What happened to the flame, as the table itself records it. Only tables with an outcome
 * column get anything other than "not-recorded"; each mapping rule is in specs.ts.
 */
export type Outcome =
  | "no-ignition" // the table says the flame did not ignite
  | "flash" // ignited only as a brief flash
  | "no-spread" // ignited by the igniter but the flame did not propagate (burn length ~0)
  | "extinguished" // the flame went out on its own before the fuel was used up
  | "burned-out" // burned until the fuel or sample was consumed
  | "terminated" // the crew or software stopped the run (fuel flow cut)
  | "disrupted" // droplet disruption (FLEX "Disruption")
  | "burned" // sustained burning recorded, without an end type
  | "not-recorded";

/** The NASA cell a value came from. */
export interface Cell {
  /** Header exactly as NASA wrote it. */
  col: string;
  /** Cell text exactly as NASA wrote it. */
  raw: string;
}

/** A value with the cell it came from. */
export interface Quantity extends Cell {
  /** The value in `unit`, or null when the cell gave no usable number (see flags). */
  v: number | null;
  /** All values when the cell lists several (e.g. "21; 26.5; 40"), in `unit`. */
  values?: number[];
  unit: string;
  /** The cell carried "~". */
  approx?: boolean;
  flags?: string[];
}

export interface TextValue extends Cell {
  v: string | null;
  flags?: string[];
}

export interface MaterialInfo {
  /** Normalised name, or null when the cell does not say. */
  name: string | null;
  /** "stated": the cell names it. "inferred": EMBER infers it, with the reason in `basis`. */
  basis: "stated" | "inferred" | "none";
  reason?: string;
  form: string | null;
  thicknessMm?: number;
  widthCm?: number;
  diameterMm?: number;
  sides?: 1 | 2;
  /** Fuel/diluent share stated in the label, e.g. "50% C2H4" → 50. */
  fuelPct?: number;
  flags?: string[];
}

export type PsiSource = {
  kind: "psi";
  table: string;
  accession: string;
  sha256: string;
  /** Row number in NASA's CSV file (header = row 1). */
  sourceRow: number;
};
export type NtrsSource = { kind: "ntrs"; ntrsId: string; tables: string; sample: string; pdfSha256: string };

export interface AtlasRow {
  /** Stable id: table id and source row ("PSI-69-0:r12"), or "NTRS-20240002981:VI-2". */
  id: string;
  source: PsiSource | NtrsSource;
  /** EMBER profile id (src/data/investigations.ts). */
  investigation: string;
  rowKind: RowKind;
  /** Why the row is an aside or a session, in plain words. */
  rowKindReason?: string;
  fuelClass: FuelClass | null;
  material: MaterialInfo & Cell;
  /** "normal": fuel from the burner into an oxidiser atmosphere; "inverse": oxygen from the burner into a fuel atmosphere. */
  flameConfig?: "normal" | "inverse";
  gravity: "microgravity";
  /** Ambient oxygen. For inverse flames this is absent and burnerO2Pct holds the burner stream. */
  o2Pct?: Quantity;
  o2PctEnd?: Quantity;
  burnerO2Pct?: Quantity;
  pressurePsi?: Quantity;
  flowCms?: Quantity;
  flowDirection?: TextValue;
  /** Diluent mole fractions of the ambient gas, when the table records them. */
  diluent?: { n2?: Quantity; co2?: Quantity; he?: Quantity };
  outcome: { value: Outcome; rule: string; cell?: Cell };
  /** Measured results and set-up quantities, keyed by a short name (see MEASURES in specs.ts). */
  measures: Record<string, Quantity | TextValue>;
  /** Row-level data-quality notes; each code is listed in FLAG_TEXT. */
  flags: string[];
}

export interface Atlas {
  version: string;
  builtFrom: { manifestSyncedOn: string; tables: number; ntrs: string[] };
  method: string;
  counts: { rows: number; byKind: Record<RowKind, number>; byFuelClass: Record<string, number>; byOutcome: Record<string, number> };
  rows: AtlasRow[];
}
