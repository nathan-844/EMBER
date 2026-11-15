import { describe, expect, it } from "vitest";
import { EQUIPMENT_LINKS } from "./applications";
import manifest from "./ntrs-manifest.json";
import { equipmentResults, ntrsCite, NTRS_QUOTES, NTRS_SOURCES, partialGravityEvidence } from "./ntrs-evidence";
import { PRESETS } from "../lib/scenario";
import { quoteHash } from "../lib/ntrs-text";

const quotes = manifest.quotes as Record<string, { source: string; page: number | null; sha256: string }>;
const sources = manifest.sources as Record<string, { pdfSha256: string; pages: number }>;

describe("NTRS quotes", () => {
  it("were each found in the NASA PDF, unchanged since (npm run sync:ntrs)", () => {
    for (const q of NTRS_QUOTES) {
      expect(quotes[q.id], q.id).toBeDefined();
      expect(quotes[q.id].source, q.id).toBe(q.source);
      expect(quotes[q.id].sha256, `${q.id} was edited after the PDF check`).toBe(quoteHash(q.text));
      expect(quotes[q.id].page, q.id).toBeGreaterThan(0);
    }
    expect(Object.keys(quotes).sort()).toEqual(NTRS_QUOTES.map((q) => q.id).sort());
  });

  it("record the SHA-256 of every PDF checked", () => {
    for (const s of NTRS_SOURCES) expect(sources[s.id]?.pdfSha256, s.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("have unique ids and cite a known source", () => {
    expect(new Set(NTRS_QUOTES.map((q) => q.id)).size).toBe(NTRS_QUOTES.length);
    for (const q of NTRS_QUOTES) expect(NTRS_SOURCES.some((s) => s.id === q.source), q.id).toBe(true);
    expect(ntrsCite("20250002114")).toBe("Urban et al. 2025 · NTRS 20250002114");
    expect(ntrsCite("20220007191")).toBe("Stocker 2022 · NTRS 20220007191");
  });

  it("put equipment results beside an existing equipment link", () => {
    const ids = new Set(EQUIPMENT_LINKS.map((l) => l.id));
    for (const q of NTRS_QUOTES.filter((x) => x.topic === "equipment")) expect(ids.has(q.equipmentLink!), q.id).toBe(true);
    expect(equipmentResults("ventilation-shutdown-high-o2").map((q) => q.id)).toEqual(["bre-25pct"]);
  });

  it("show partial-gravity evidence only for partial gravity, by level", () => {
    expect(partialGravityEvidence(0)).toEqual([]);
    expect(partialGravityEvidence(1)).toEqual([]);
    expect(partialGravityEvidence(null)).toEqual([]);
    const moon = partialGravityEvidence(0.166).map((q) => q.id);
    const mars = partialGravityEvidence(0.38).map((q) => q.id);
    expect(moon).toContain("urban25-increased");
    expect(moon).not.toContain("urban25-mars");
    expect(mars).toContain("urban25-mars");
    expect(mars).not.toContain("luci25-sibal");
  });

  it("back every exploration-atmosphere preset with a checked quote that states its values", () => {
    for (const p of PRESETS.filter((x) => x.source)) {
      const q = NTRS_QUOTES.find((x) => x.id === p.source!.quote)!;
      expect(q, p.id).toBeDefined();
      expect(q.text).toContain(`${p.values.pressurePsi} psia`);
      expect(q.text).toMatch(new RegExp(`${p.values.oxygenPct}% (O2|oxygen)`));
    }
  });
});
