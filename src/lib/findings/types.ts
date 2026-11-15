// A measured finding: a claim computed by code from Fire Test Atlas rows, never written by a model.
// The claim text is generated from `numbers`, so the words cannot drift from the data.

export interface FindingTable {
  /** Column headers, plain words with units. */
  columns: string[];
  rows: (string | number | null)[][];
}

export interface Finding {
  /** Stable id ("F1"…), used by the app and the AI to cite a finding. */
  id: string;
  title: string;
  /** One sentence, generated from `numbers`. */
  claim: string;
  /** Every number the claim uses, by name. */
  numbers: Record<string, number | string>;
  /** Tests the finding counts. */
  n: number;
  /** Atlas row ids the numbers were computed from. */
  rows: string[];
  /** Rows looked at but not used, with the reason. */
  excluded: { reason: string; count: number }[];
  /** How the numbers were computed, step by step, in plain words. */
  method: string;
  /** What else differs between the compared tests, or could explain the result. */
  confounders: string[];
  /** What this finding does not establish. */
  notClaimed: string;
  /** EMBER investigation ids the rows come from. */
  investigations: string[];
  /** The numbers behind a chart or table on the Findings page. */
  table: FindingTable;
}

export interface FindingsFile {
  version: string;
  atlasVersion: string;
  method: string;
  findings: Finding[];
}
