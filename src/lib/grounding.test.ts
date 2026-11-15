import { describe, expect, it } from "vitest";
import { buildEvidencePackage } from "./evidence";
import { better, checkAnswer, normalize, type ModelAnswer } from "./grounding";
import { presetScenario } from "./scenario";
import { parseScenario } from "../../server/analyze";

const pkg = buildEvidencePackage(presetScenario("iss"));
const src = (id: string) => pkg.sources.find((s) => s.id === id)!;

type LooseClaim = { text: string; citations: { source: string; excerpt: string }[]; kind?: ModelAnswer["claims"][number]["kind"]; implication?: string };
function answer(claims: LooseClaim[], summarySources = ["scenario"]): ModelAnswer {
  return {
    summary: { text: "BASS-II leads for this cabin.", sources: summarySources },
    claims: claims.map((c) => ({ kind: "Interpretation", implication: "", ...c })),
    openQuestions: [],
  };
}

describe("evidence package", () => {
  it("is built from the scenario and includes NASA text", () => {
    expect(pkg.sources[0].id).toBe("scenario");
    expect(pkg.sources.some((s) => s.origin === "nasa")).toBe(true);
    expect(pkg.ranked[0].id).toBe("bass-ii");
  });

  it("labels run-table ranges as EMBER-computed NASA data and curated ranges as EMBER", () => {
    expect(src("bass-ii:oxygenPct").origin).toBe("derived");
    expect(src("bass-ii:gravityG").origin).toBe("ember");
  });
});

describe("grounding check", () => {
  const o2 = src("bass-ii:oxygenPct");

  it("accepts a verbatim excerpt with traceable numbers", () => {
    const excerpt = o2.text.slice(0, 40);
    const r = checkAnswer(answer([{ text: "BASS-II ran from 13.6 to 22.2% oxygen.", citations: [{ source: o2.id, excerpt }] }]), pkg);
    expect(r.claims[0].problems).toEqual([]);
    expect(r.verdict).toBe("accepted");
    expect(r.receipt.derivedExcerpts).toBe(1);
    expect(r.receipt.nasaExcerpts).toBe(0);
  });

  it("rejects a paraphrased excerpt", () => {
    const r = checkAnswer(answer([{ text: "BASS-II covered cabin air.", citations: [{ source: o2.id, excerpt: "BASS-II tested a wide oxygen span" }] }]), pkg);
    expect(r.claims[0].accepted).toBe(false);
    expect(r.verdict).toBe("rejected");
  });

  it("rejects an invented number", () => {
    const r = checkAnswer(answer([{ text: "Flames spread at 4.7 mm/s.", citations: [{ source: o2.id, excerpt: o2.text.slice(0, 40) }] }]), pkg);
    expect(r.claims[0].problems.join(" ")).toMatch(/4\.7/);
  });

  it("allows numbers from the scenario and rounding of source numbers", () => {
    const r = checkAnswer(answer([{ text: "Your 21% cabin sits inside BASS-II's 14 to 22% span.", citations: [{ source: o2.id, excerpt: o2.text.slice(0, 40) }] }]), pkg);
    expect(r.claims[0].accepted).toBe(true);
  });

  it("rejects citations to sources outside the package", () => {
    const r = checkAnswer(answer([{ text: "Saffire proves it.", citations: [{ source: "made-up", excerpt: "anything at all here" }] }]), pkg);
    expect(r.claims[0].problems[0]).toMatch(/unknown source/);
  });

  it("marks the answer partial when only some claims pass", () => {
    const good = { text: "BASS-II has a run table.", citations: [{ source: o2.id, excerpt: o2.text.slice(0, 40) }] };
    const bad = { text: "No basis.", citations: [] };
    expect(checkAnswer(answer([good, bad]), pkg).verdict).toBe("partial");
  });

  it("withholds only the summary when it has an untraceable number", () => {
    const good = { text: "BASS-II has a run table.", citations: [{ source: o2.id, excerpt: o2.text.slice(0, 40) }] };
    const a = answer([good]);
    a.summary.text = "Risk is 37% lower.";
    const r = checkAnswer(a, pkg);
    expect(r.verdict).toBe("partial");
    expect(r.summary.accepted).toBe(false);
    expect(r.claims[0].accepted).toBe(true);
  });

  it("normalizes typographic quotes, dashes and spacing only", () => {
    expect(normalize("13.6–22.2  “vol %”")).toBe('13.6-22.2 "vol %"');
  });
});

describe("server scenario parsing", () => {
  it("accepts a preset scenario", () => {
    expect(parseScenario(presetScenario("lunar-habitat"))).not.toBeNull();
  });

  it("rejects out-of-range or unknown values", () => {
    expect(parseScenario({ ...presetScenario("iss"), oxygenPct: 150 })).toBeNull();
    expect(parseScenario({ ...presetScenario("iss"), environment: "venus" })).toBeNull();
    expect(parseScenario("nope")).toBeNull();
  });
});

describe("claim kinds", () => {
  const o2 = src("bass-ii:oxygenPct");
  const sf = src("saffire-ii:oxygenPct");
  const cite = (s: { id: string; text: string }) => ({ source: s.id, excerpt: s.text.slice(0, 40) });

  it("requires a comparison to cite two investigations", () => {
    const one = checkAnswer(answer([{ kind: "Comparison", text: "BASS-II differs.", citations: [cite(o2)] }]), pkg);
    expect(one.claims[0].problems.join(" ")).toMatch(/two or more investigations/);
    const two = checkAnswer(answer([{ kind: "Comparison", text: "BASS-II and Saffire-II differ.", citations: [cite(o2), cite(sf)] }]), pkg);
    // Two investigations, but only EMBER-computed ranges: a comparison must also quote NASA.
    expect(two.claims[0].problems.join(" ")).toMatch(/must quote NASA text/);
    const sfObj = src("saffire-ii:objectives");
    const three = checkAnswer(answer([{ kind: "Comparison", text: "BASS-II and Saffire-II differ.", citations: [cite(o2), cite(sfObj)] }]), pkg);
    expect(three.claims[0].accepted).toBe(true);
  });

  it("rejects safety conclusions even with valid quotes (judge's fabricated claims)", () => {
    const obj = src("bass-ii:objectives");
    for (const text of [
      "Cabin materials will not burn in lunar gravity, so no extinguisher is needed.",
      "BASS-II showed solids are fire-safe at 30% oxygen.",
      "Detectors are not needed for PMMA.",
    ]) {
      const r = checkAnswer(answer([{ kind: "Interpretation", text, citations: [cite(obj)] }]), pkg);
      expect(r.claims[0].accepted, text).toBe(false);
      expect(r.claims[0].problems.join(" ")).toMatch(/safety conclusion/);
    }
  });

  it("allows ordinary fire-safety wording", () => {
    const obj = src("bass-ii:objectives");
    for (const text of ["BASS-II studied flame spread to support spacecraft fire safety.", "Materials may burn at lower oxygen in partial gravity."]) {
      expect(checkAnswer(answer([{ kind: "Interpretation", text, citations: [cite(obj)] }]), pkg).claims[0].accepted, text).toBe(true);
    }
  });

  it("requires measured data to quote a table row", () => {
    const r = checkAnswer(answer([{ kind: "Measured data", text: "BASS-II oxygen.", citations: [cite(o2)] }]), pkg);
    expect(r.claims[0].problems.join(" ")).toMatch(/run-table row/);
  });

  it("checks numbers in the implication too", () => {
    const r = checkAnswer(answer([{ text: "BASS-II has a run table.", implication: "Keep oxygen below 19.3%.", citations: [cite(o2)] }]), pkg);
    expect(r.claims[0].problems.join(" ")).toMatch(/19\.3/);
  });

  it("allows Earth reference values", () => {
    const r = checkAnswer(answer([{ text: "Unlike 1 g tests at 14.7 psia and 21% oxygen, BASS-II ran in orbit.", citations: [cite(o2)] }]), pkg);
    expect(r.claims[0].accepted).toBe(true);
  });

  it("treats an unknown kind as an interpretation", () => {
    const r = checkAnswer(answer([{ kind: "Prophecy" as never, text: "BASS-II has a run table.", citations: [cite(o2)] }]), pkg);
    expect(r.claims[0].kind).toBe("Interpretation");
  });

  it("prefers the report with more kept claims", () => {
    const good = checkAnswer(answer([{ text: "BASS-II has a run table.", citations: [cite(o2)] }]), pkg);
    const bad = checkAnswer(answer([{ text: "Nothing.", citations: [] }]), pkg);
    expect(better(bad, good)).toBe(good);
    expect(better(good, bad)).toBe(good);
  });

  it("rejects claims and summaries that show internal source ids", () => {
    const r = checkAnswer(answer([{ text: "As bass-ii:row7 shows, BASS-II has a run table.", citations: [cite(o2)] }]), pkg);
    expect(r.claims[0].problems.join(" ")).toMatch(/internal source id/);
    const a = answer([{ text: "BASS-II has a run table.", citations: [cite(o2)] }]);
    a.summary.text = "It rests on source ids limitation:joint and bass-ii:summary.";
    expect(checkAnswer(a, pkg).summary.accepted).toBe(false);
  });
});

describe("equipment implications", () => {
  it("must quote NASA text", () => {
    const obj = pkg.sources.find((s) => s.id.endsWith(":objectives"))!;
    const ok = checkAnswer(answer([{ kind: "Equipment implication", text: "This informs detector design.", citations: [{ source: obj.id, excerpt: obj.text.slice(0, 40) }] }]), pkg);
    expect(ok.claims[0].problems).toEqual([]);
    const ember = pkg.sources.find((s) => s.origin === "ember")!;
    const bad = checkAnswer(answer([{ kind: "Equipment implication", text: "This informs detector design.", citations: [{ source: ember.id, excerpt: ember.text.slice(0, 40) }] }]), pkg);
    expect(bad.claims[0].problems.join(" ")).toMatch(/must quote NASA text/);
  });
});
