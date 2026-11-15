import { describe, expect, it } from "vitest";
import { SAFFIRE_NTRS_RUNS, SAFFIRE_NTRS_SOURCE, saffireRunsAbove } from "./ntrs-saffire";

describe("Saffire IV-VI from NTRS 20240002981", () => {
  it("keeps Table 1 of the paper exactly (sample, material, kPa, mol % O2, free volume)", () => {
    expect(SAFFIRE_NTRS_RUNS.map((r) => [r.sample, r.pressureKpa, r.oxygenPct, r.freeVolumeM3, r.lengthCm])).toEqual([
      ["IV-1", 100.0, 22.0, 17.9, 50],
      ["V-2", 70.7, 26.2, 19.0, 50],
      ["VI-2", 54.1, 31.0, 16.7, 50],
      ["VI-3", 54.6, 30.3, 16.7, 18],
      ["VI-4", 55.2, 28.8, 16.7, 18],
    ]);
    expect(SAFFIRE_NTRS_RUNS.every((r) => r.flowCms === 20 && r.flowDirection === "concurrent")).toBe(true);
  });

  it("keeps Table 2 results", () => {
    expect(SAFFIRE_NTRS_RUNS.map((r) => [r.sample, r.burnS, r.heatReleaseW, r.co2IncreasePpm, r.coIncreasePpm])).toEqual([
      ["IV-1", 130, 3150, 1390, 80],
      ["V-2", 200, 2800, 2360, 83],
      ["VI-2", 112, 3217, 2800, 120],
      ["VI-3", 780, 3080, 8539, 308],
      ["VI-4", 1200, 1507, 8117, 320],
    ]);
  });

  it("converts kPa to psia only for plotting", () => {
    expect(SAFFIRE_NTRS_RUNS.map((r) => r.pressurePsi)).toEqual([14.5, 10.25, 7.85, 7.92, 8.01]);
  });

  it("lists runs above an oxygen level, highest first", () => {
    expect(saffireRunsAbove(22.2).map((r) => r.sample)).toEqual(["VI-2", "VI-3", "VI-4", "V-2"]);
    expect(saffireRunsAbove(31)).toEqual([]);
  });

  it("points at the NASA NTRS record", () => {
    expect(SAFFIRE_NTRS_SOURCE.url).toBe("https://ntrs.nasa.gov/citations/20240002981");
  });
});
