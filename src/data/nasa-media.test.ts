import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import records from "./nasa-media-records.json";
import { INVESTIGATIONS } from "./investigations";
import { NASA_PHOTOS, photosFor } from "./nasa-media";

const RECORDS = records.records as Record<string, { title: string; date_created: string; center: string; description: string }>;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const IDS = new Set([...INVESTIGATIONS.map((i) => i.id), "saffire-iv-vi"]);

describe("NASA photos", () => {
  it.each(NASA_PHOTOS.map((p) => [p.nasaId, p] as const))("%s quotes NASA's description and date", (_id, p) => {
    const r = RECORDS[p.nasaId];
    expect(r, p.nasaId).toBeDefined();
    expect(squash(r.description)).toContain(squash(p.nasaSays));
    expect(r.date_created.slice(0, 10)).toBe(p.date);
    expect(r.center).toBe(p.center);
    expect(existsSync(`src/assets/nasa/${p.nasaId}.jpg`)).toBe(true);
    expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("only point at real investigations", () => {
    for (const p of NASA_PHOTOS) for (const id of [...p.shows, ...(p.shared ?? [])]) expect(IDS.has(id), `${p.nasaId} → ${id}`).toBe(true);
  });

  it("list an investigation's own photo before shared hardware", () => {
    expect(photosFor("acme-flame-design").map((x) => [x.photo.nasaId, x.shared])).toEqual([["iss059e103188", false], ["GRC-2016-C-05051", true]]);
    expect(photosFor("flex").map((x) => x.shared)).toEqual([true]);
    expect(photosFor("spice")).toEqual([]);
  });
});
