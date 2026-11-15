// One manifest of every count EMBER displays or documents, computed from the committed data files.
// The app, the docs test and the exports all read src/data/counts.json, so a number cannot drift
// from the data. Source rows, observations and experiments are counted separately on purpose:
// a row is not always a test, and two test rows can observe the same run.
import type { AuditFile } from "./atlas/audit";
import { experimentCount } from "./atlas/build";
import type { Atlas, AtlasRow, RowKind } from "./atlas/types";
import type { FindingsFile } from "./findings/types";

export interface Counts {
  version: "counts-v1";
  /** Identifies the data these counts, and any export made from them, came from. */
  snapshot: {
    /** First 12 hex digits of a SHA-256 over the data files listed in `files`, in that order. */
    id: string;
    sha256: string;
    files: string[];
    atlasVersion: string;
    findingsVersion: string;
    tablesSyncedOn: string;
    psiFetchedOn: string;
  };
  sources: {
    /** NASA PSI tables stored (CSV run tables, plus sheets taken from NASA workbooks). */
    psiTables: number;
    workbookSheets: number;
    /** PSI investigation records those tables come from. */
    psiRecordsWithTables: number;
    /** Combustion Science records in the PSI catalogue snapshot. */
    psiCatalogueRecords: number;
    investigationProfiles: number;
    /** NASA documents whose text EMBER quotes after finding the quote in the PDF. */
    quoteDocuments: { ntrs: number; psiHeld: number };
    quotes: number;
  };
  rows: { total: number; psi: number; ntrs: number; byKind: Record<RowKind, number> };
  /** Observations: test rows, and supplement rows that add measurements to a test listed elsewhere. */
  observations: { testRows: number; supplementRows: number };
  experiments: {
    /** Distinct experiments among test rows (see `reviewed` and `unreviewedTestRows`). */
    total: number;
    /** Investigations whose run identities EMBER has reviewed: several rows can observe one run. */
    reviewed: Record<string, { experiments: number; testRows: number; agedMeasurements: number; supplementRows: number; unmatchedSupplements: number }>;
    /** Test rows counted as one experiment each without review. Identical rows in NASA's tables are not merged. */
    unreviewedTestRows: number;
  };
  tests: {
    withOutcome: number;
    outcomeNotRecorded: number;
    /** Test rows by fuel class; "none" where the material is blank or unnamed. */
    byFuelClass: Record<string, number>;
    solid: number;
    solidWithScalarPressure: number;
    inferredMaterial: number;
    /** Ambient oxygen absent, unusable, or given as several values (not one exact number). */
    withoutScalarOxygen: number;
    multiValuedOxygen: number;
    withoutScalarPressure: number;
    withoutScalarFlow: number;
  };
  audit: AuditFile["totals"];
  /** Findings reuse tests, so their sample sizes must never be added together. */
  findings: { count: number; ids: string[] };
  licences: { psiRecords: number; withDoi: number; cc0: number; notStated: string[] };
}

const scalar = (q?: { v: number | null }) => typeof q?.v === "number";

export function computeCounts(input: {
  atlas: Atlas;
  audit: AuditFile;
  findings: FindingsFile;
  tables: { id: string; accession: string; sheet?: string }[];
  tablesSyncedOn: string;
  psi: { fetchedOn: string; records: { accession: string; doi: string | null; license: { id: string } | null }[] };
  profiles: number;
  quotes: { sources: { psi?: unknown }[]; count: number };
  snapshot: { sha256: string; files: string[] };
}): Counts {
  const { atlas, audit, findings, tables, psi } = input;
  const rows = atlas.rows;
  const tests = rows.filter((r) => r.rowKind === "test");
  const reviewedInvs = [...new Set(rows.filter((r) => r.experiment).map((r) => r.investigation))].sort();
  const reviewed: Counts["experiments"]["reviewed"] = {};
  for (const inv of reviewedInvs) {
    const t = tests.filter((r) => r.investigation === inv && r.experiment);
    const sup = rows.filter((r: AtlasRow) => r.investigation === inv && r.rowKind === "supplement");
    reviewed[inv] = {
      experiments: new Set(t.map((r) => r.experiment!.id)).size,
      testRows: t.length,
      agedMeasurements: t.filter((r) => r.experiment!.role === "aged").length,
      supplementRows: sup.length,
      unmatchedSupplements: sup.filter((r) => r.experiment?.match === "unmatched").length,
    };
  }
  return {
    version: "counts-v1",
    snapshot: {
      id: input.snapshot.sha256.slice(0, 12), sha256: input.snapshot.sha256, files: input.snapshot.files,
      atlasVersion: atlas.version, findingsVersion: findings.version, tablesSyncedOn: input.tablesSyncedOn, psiFetchedOn: psi.fetchedOn,
    },
    sources: {
      psiTables: tables.length,
      workbookSheets: tables.filter((t) => t.sheet).length,
      psiRecordsWithTables: new Set(tables.map((t) => t.accession)).size,
      psiCatalogueRecords: psi.records.length,
      investigationProfiles: input.profiles,
      quoteDocuments: { ntrs: input.quotes.sources.filter((s) => !s.psi).length, psiHeld: input.quotes.sources.filter((s) => s.psi).length },
      quotes: input.quotes.count,
    },
    rows: {
      total: rows.length,
      psi: rows.filter((r) => r.source.kind === "psi").length,
      ntrs: rows.filter((r) => r.source.kind === "ntrs").length,
      byKind: atlas.counts.byKind,
    },
    observations: { testRows: tests.length, supplementRows: rows.filter((r) => r.rowKind === "supplement").length },
    experiments: { total: experimentCount(rows), reviewed, unreviewedTestRows: tests.filter((r) => !r.experiment).length },
    tests: {
      withOutcome: tests.filter((r) => r.outcome.value !== "not-recorded").length,
      outcomeNotRecorded: tests.filter((r) => r.outcome.value === "not-recorded").length,
      byFuelClass: Object.fromEntries(
        [...new Set(tests.map((r) => r.fuelClass ?? "none"))].sort().map((f) => [f, tests.filter((r) => (r.fuelClass ?? "none") === f).length]),
      ),
      solid: tests.filter((r) => r.fuelClass === "solid").length,
      solidWithScalarPressure: tests.filter((r) => r.fuelClass === "solid" && scalar(r.pressurePsi)).length,
      inferredMaterial: tests.filter((r) => r.material.basis === "inferred").length,
      withoutScalarOxygen: tests.filter((r) => !scalar(r.o2Pct)).length,
      multiValuedOxygen: tests.filter((r) => (r.o2Pct?.values?.length ?? 0) > 1).length,
      withoutScalarPressure: tests.filter((r) => !scalar(r.pressurePsi)).length,
      withoutScalarFlow: tests.filter((r) => !scalar(r.flowCms)).length,
    },
    audit: audit.totals,
    findings: { count: findings.findings.length, ids: findings.findings.map((f) => f.id) },
    licences: {
      psiRecords: psi.records.length,
      withDoi: psi.records.filter((r) => r.doi).length,
      cc0: psi.records.filter((r) => r.license?.id === "CC0-1.0").length,
      notStated: psi.records.filter((r) => !r.license).map((r) => r.accession),
    },
  };
}
