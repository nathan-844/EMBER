import { describe, expect, it } from "vitest";
import recorded from "../data/recorded-analyses.json";
import { REJECTED_EXAMPLE, tableOxygenSpan } from "./landing";

describe("landing page facts", () => {
  it("reads the solid-material oxygen ceiling from the NASA run tables", () => {
    expect(tableOxygenSpan("solid")).toEqual({ min: 13.6, max: 22.2, top: "BASS-II" });
  });

  it("finds droplet and gas-flame tables that reach a 30% oxygen atmosphere", () => {
    expect(tableOxygenSpan("liquid")!.max).toBeGreaterThanOrEqual(30);
    expect(tableOxygenSpan("gas")!.max).toBeGreaterThanOrEqual(30);
  });

  it("shows a rejected claim that is really in the recorded answers", () => {
    const claims = Object.values((recorded as any).entries).flatMap((e: any) => e.report.claims);
    const hit = claims.find((c: any) => c.text === REJECTED_EXAMPLE.text);
    expect(hit).toBeTruthy();
    expect(hit.accepted).toBe(false);
    expect(hit.kind).toBe(REJECTED_EXAMPLE.kind);
    expect(hit.problems).toContain(REJECTED_EXAMPLE.problem);
  });
});
