import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAB_TOUR } from "./GuidedTour";

describe("guided tour", () => {
  const lab = readFileSync("src/pages/ScenarioLab.tsx", "utf8");
  // "More about this habitat" rows get aria-labelledby="<id>-tile"; only FEATURED ones show before "Show more".
  const featured = lab.match(/const FEATURED: TileId\[\] = \[([^\]]*)\]/)?.[1] ?? "";

  it("points every step at something the lab renders on first view", () => {
    for (const s of LAB_TOUR) {
      const tile = s.target.match(/^\[aria-labelledby="(\w+)-tile"\]$/)?.[1];
      const id = s.target.match(/^#([\w-]+)$/)?.[1];
      if (tile && lab.includes(`aria-labelledby="${tile}-tile"`)) continue;
      if (tile) expect(featured, s.title).toContain(`"${tile}"`);
      else if (id) expect(lab, s.title).toContain(`id="${id}"`);
      else expect(lab, s.title).toContain('href="#credibility"');
    }
  });

  it("keeps each step short", () => {
    for (const s of LAB_TOUR) expect(s.body.length, s.title).toBeLessThan(260);
    expect(LAB_TOUR.length).toBeLessThanOrEqual(8);
  });
});
