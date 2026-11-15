import { describe, expect, it } from "vitest";
import report from "./verify-report.json";

describe("verification scoreboard", () => {
  const board = report.scoreboard;

  it("lists the tests and every source check, each with a method", () => {
    expect(board.map((r) => r.id)).toEqual(["tests", "psi-quotes", "ntrs-quotes", "psi-links", "recorded-claims", "table-hashes", "saffire"]);
    for (const r of board) {
      expect(r.passed, r.id).toBeLessThanOrEqual(r.checked);
      expect(r.checked, r.id).toBeGreaterThan(0);
      expect(r.method.length, r.id).toBeGreaterThan(20);
      expect(["rerun", "recorded", "manual"]).toContain(r.how);
    }
  });

  it("agrees with the recorded test run", () => {
    const tests = board.find((r) => r.id === "tests")!;
    expect([tests.passed, tests.checked]).toEqual([report.tests.passed, report.tests.total]);
  });
});
