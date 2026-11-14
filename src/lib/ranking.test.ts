import { describe, expect, it } from "vitest";
import type { Investigation } from "../data/types";
import { INVESTIGATIONS } from "../data/investigations";
import { MAX_CONDITION_POINTS, rankInvestigations, rankLabel, scoreInvestigation } from "./ranking";
import { presetScenario, type Scenario } from "./scenario";

const lunar = presetScenario("lunar-habitat");

function profile(over: Partial<Investigation>): Investigation {
  return {
    id: "x", name: "X", fullName: "X", platform: "ISS", hardware: "", summary: "",
    fuelTypes: ["solid"], questions: ["prevention"], adjacentQuestions: [],
    conditions: { oxygenPct: null, pressurePsi: null, gravityG: null, airflowMs: null },
    measurements: [], psi: { accession: null, url: null, verifiedOn: null }, caveats: [],
    ...over,
  };
}

describe("scoring", () => {
  it("caps conditions at 75 and total at 100", () => {
    const inv = profile({
      conditions: {
        oxygenPct: { min: 0, max: 100, basis: "", source: "psi-table" },
        pressurePsi: { min: 0, max: 30, basis: "", source: "psi-table" },
        gravityG: { min: 0, max: 1, basis: "", source: "psi-table" },
        airflowMs: { min: 0, max: 1, basis: "", source: "psi-table" },
      },
    });
    const r = scoreInvestigation(inv, lunar)!;
    expect(r.conditionPoints).toBe(MAX_CONDITION_POINTS);
    expect(r.total).toBe(100);
  });

  it("unknown profile ranges earn no points", () => {
    const r = scoreInvestigation(profile({}), lunar)!;
    expect(r.conditions.filter((c) => c.status === "unknown")).toHaveLength(4);
    expect(r.conditionPoints).toBe(15); // fuel only
  });

  it("unspecified inputs earn no points for anyone", () => {
    const s: Scenario = { ...lunar, oxygenPct: null, fuel: null };
    const r = scoreInvestigation(profile({ conditions: { oxygenPct: { min: 0, max: 100, basis: "" }, pressurePsi: null, gravityG: null, airflowMs: null } }), s)!;
    expect(r.conditions[0].status).toBe("unspecified");
    expect(r.conditionPoints).toBe(0);
  });

  it("excludes investigations that do not address the question", () => {
    expect(scoreInvestigation(profile({ questions: ["detection"] }), lunar)).toBeNull();
  });

  it("adjacent research scores lower and can be switched off", () => {
    const inv = profile({ questions: [], adjacentQuestions: ["prevention"] });
    expect(scoreInvestigation(inv, lunar)!.questionPoints).toBe(10);
    expect(scoreInvestigation(inv, { ...lunar, includeAdjacent: false })).toBeNull();
  });
});

describe("ranking", () => {
  it("ties share a rank", () => {
    const ranked = rankInvestigations(lunar, [profile({ id: "a", name: "A" }), profile({ id: "b", name: "B" })]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
    expect(rankLabel(ranked[0])).toBe("T01");
  });

  it("lists every same-fuel study first, then sorts by descending total within each group", () => {
    const ranked = rankInvestigations(lunar);
    const firstOther = ranked.findIndex((r) => r.group === "other");
    expect(firstOther).toBeGreaterThan(0);
    expect(ranked.slice(firstOther).every((r) => r.group === "other")).toBe(true);
    for (let i = 1; i < ranked.length; i++) {
      if (ranked[i - 1].group === ranked[i].group) expect(ranked[i - 1].total).toBeGreaterThanOrEqual(ranked[i].total);
    }
  });

  it("puts a same-fuel study ahead of a higher-scoring other-fuel study", () => {
    // 30% O2 at 10.2 psi: FLEX-2 (droplets) matches more conditions than Saffire, but is analogue evidence.
    const ranked = rankInvestigations(lunar);
    const flex2 = ranked.findIndex((r) => r.investigation.id === "flex-2");
    const lastSolid = Math.max(...ranked.map((r, i) => (r.investigation.fuelTypes.includes("solid") ? i : -1)));
    expect(flex2).toBeGreaterThan(lastSolid);
  });

  it("uses one group when no fuel is set", () => {
    expect(new Set(rankInvestigations({ ...lunar, fuel: null }).map((r) => r.group))).toEqual(new Set(["all"]));
  });

  it("gives a curated estimate two thirds of a measured range's points", () => {
    const base = { oxygenPct: null, pressurePsi: null, gravityG: null, airflowMs: { min: 0, max: 1, basis: "" } };
    const curated = scoreInvestigation(profile({ conditions: { ...base, airflowMs: { ...base.airflowMs, source: "curated" as const } } }), lunar)!;
    const measured = scoreInvestigation(profile({ conditions: { ...base, airflowMs: { ...base.airflowMs, source: "psi-table" as const } } }), lunar)!;
    expect(curated.conditions.find((c) => c.key === "airflowMs")!.points).toBe(10);
    expect(measured.conditions.find((c) => c.key === "airflowMs")!.points).toBe(15);
  });

  it("leads with a solid-fuel flammability study for a lunar prevention scenario", () => {
    const top = rankInvestigations(lunar)[0].investigation;
    expect(top.fuelTypes).toContain("solid");
    expect(top.questions).toContain("prevention");
  });

  it("detection questions surface SAME and SAME-R", () => {
    const ids = rankInvestigations({ ...lunar, question: "detection" }).map((r) => r.investigation.id);
    expect(ids).toContain("same");
    expect(ids).toContain("same-r");
  });

  it("every curated profile has a unique id", () => {
    expect(new Set(INVESTIGATIONS.map((i) => i.id)).size).toBe(INVESTIGATIONS.length);
  });

  it("never ranks a different fuel type as tied with the leader (lunar habitat, solid fuel)", () => {
    const ranked = rankInvestigations(presetScenario("lunar-habitat"));
    for (const r of ranked.filter((x) => x.rank === 1)) expect(r.investigation.fuelTypes).toContain("solid");
    expect(ranked.find((r) => r.investigation.id === "flex-2")!.rank).toBeGreaterThan(1);
  });
});
