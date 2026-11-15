import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAB_TOUR } from "./GuidedTour";

describe("guided tour", () => {
  const lab = readFileSync("src/pages/ScenarioLab.tsx", "utf8");

  it("points every step at something the lab renders", () => {
    for (const s of LAB_TOUR) {
      const tile = s.target.match(/^\[aria-labelledby="(\w+)-tile"\]$/)?.[1];
      if (tile === "ask") expect(lab).toContain('aria-labelledby="ask-tile"');
      else if (tile) expect(lab, s.title).toContain(`tile("${tile}")`);
      else if (s.target === "#scenario") expect(readFileSync("src/components/ScenarioPanel.tsx", "utf8")).toContain('id="scenario"');
      else expect(lab, s.title).toContain('href="#credibility"');
    }
  });

  it("keeps each step short", () => {
    for (const s of LAB_TOUR) expect(s.body.length, s.title).toBeLessThan(260);
    expect(LAB_TOUR.length).toBeLessThanOrEqual(8);
  });
});
