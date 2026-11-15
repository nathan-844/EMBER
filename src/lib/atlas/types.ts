// EMBER Fire Test Atlas: one record per NASA source row, in one schema, with the source cell
// behind every value. Built by scripts/build-atlas.ts into src/data/atlas/.

export type FuelClass = "solid" | "liquid" | "gas" | "aerosol";

/**
 * test       – one observation of an experiment run (one ignition attempt, droplet, sample or aging
 *              measurement). Two test rows can observe the same run (see `experiment`), so the number
 *              of test rows is a count of observations, not of independent experiments.
 * session    – one row summarising several runs (e.g. ACME "Flames ignited: 10" for a test day)
 * matrix     – a test-matrix summary listing the levels tested, not individual runs (FLEX-2, SAME)
 * supplement – measurements of a run that another table already lists as a test (the SAME-R rows of
 *              NASA's results workbook). A scientific observation, never counted as a second test.
 * aside      – a row that is not a test or an observation (footnote, cleaning run, blank row)
 */
export type RowKind = "test" | "session" | "matrix" | "supplement" | "aside";

/**
 * Which experiment (one run of one sample) a row observes, where EMBER has reviewed the grouping.
 * A row without this is taken as its own experiment; that default has not been reviewed.
 */
export interface ExperimentLink {
  /** Rows with the same id observe the same run. */
  id: string;
  /** run: the run as first measured. aged: the same smoke measured again after ageing. */
  role: "run" | "aged";
  /** How the grouping was established, in plain words. */
  basis: string;
  /** Supplement rows only: whether the run table lists a test with this identity. */
  match?: "matched" | "unmatched";
}

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
  /** All values when the cell lists several (e.g. "21; 26.5; 40"), in `unit`, in the order written. */
  values?: number[];
  /**
   * What several values mean: "list" (separate levels, "21; 26.5; 40"), "range" (a span, "21.5 - 21.7")
   * or "trajectory" (start then end, "22.1 to 22.0"). None of them is one exact value.
   */
  shape?: "list" | "range" | "trajectory";
  /**
   * How the number was obtained when it is not simply read as written: "converted" (from the unit
   * NASA states, by an exact factor), "invalid" (the cell holds something unusable; see flags),
   * "bound" (off the instrument's scale) or "placeholder" (a 0 written where the source holds no value).
   */
  status?: "converted" | "invalid" | "bound" | "placeholder";
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
  /** The experiment this row observes, where reviewed (SAME and SAME-R). */
  experiment?: ExperimentLink;
  /**
   * Why a key condition has no value: "blank" (the table has the column but the cell is empty) or
   * "not-in-table" (this NASA table has no such column; the experiment may still have recorded it).
   */
  absent?: Partial<Record<"o2Pct" | "pressurePsi" | "flowCms", "blank" | "not-in-table">>;
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
  counts: {
    rows: number;
    byKind: Record<RowKind, number>;
    /** Distinct experiments among test rows: rows that observe the same reviewed run count once. */
    experiments: number;
    byFuelClass: Record<string, number>;
    byOutcome: Record<string, number>;
  };
  rows: AtlasRow[];
}
