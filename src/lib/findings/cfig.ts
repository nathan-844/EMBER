// F5: ACME CFI-G (PSI-159) searched for cool flames with gaseous fuels. NASA's "Cool flame?" column
// says which runs produced one.
import type { AtlasRow } from "../atlas/types";
import { pctCi, round, wilson } from "./stats";
import type { Finding } from "./types";

const isCool = (r: AtlasRow) => /^yes/i.test(String(r.measures.coolFlame?.v ?? ""));
const bar = (psi: number) => round(psi / 14.5038, 2);

export function f5CoolFlames(rows: AtlasRow[]): Finding {
  const tests = rows.filter((r) => r.source.kind === "psi" && r.source.table === "PSI-159-0" && r.rowKind === "test");
  const cool = tests.filter(isCool);
  const fuels = [...new Set(cool.map((r) => r.material.name))];
  const pressures = [...new Set(cool.map((r) => bar(r.pressurePsi!.v!)))];
  const o2 = cool.map((r) => r.o2Pct!.v!);
  // The runs at the same fuel and pressure as the cool flames, with or without one.
  const sameSetting = tests.filter((r) => fuels.includes(r.material.name) && pressures.includes(bar(r.pressurePsi?.v ?? NaN)));
  const numbers = {
    runs: tests.length,
    coolFlames: cool.length,
    fuel: fuels.join(", "),
    fuelShare: [...new Set(cool.map((r) => r.material.fuelPct))].join(", "),
    pressureBar: pressures.join(", "),
    o2Min: round(Math.min(...o2), 1),
    o2Max: round(Math.max(...o2), 1),
    sameSettingRuns: sameSetting.length,
    otherRuns: tests.length - sameSetting.length,
    sameSettingCi: pctCi(wilson(cool.length, sameSetting.length)),
    otherUpperPct: Math.round(wilson(0, tests.length - sameSetting.length)[1] * 100),
  };
  const settings = new Map<string, AtlasRow[]>();
  for (const r of tests) {
    const k = `${r.material.name}|${r.pressurePsi?.v != null ? bar(r.pressurePsi.v) : "?"}`;
    settings.set(k, [...(settings.get(k) ?? []), r]);
  }
  return {
    id: "F5",
    title: "Cool flames appeared in one narrow corner",
    claim:
      `${cool.length} of ${tests.length} CFI-G normal-flame runs produced a cool flame, all with ${numbers.fuel} (${numbers.fuelShare}% in nitrogen) at ${numbers.pressureBar} bar and ${numbers.o2Min}–${numbers.o2Max}% O₂: ` +
      `${cool.length} of the ${sameSetting.length} runs at that fuel and pressure, and none of the other ${numbers.otherRuns}.`,
    numbers,
    n: tests.length,
    rows: tests.map((r) => r.id),
    excluded: [],
    method:
      `1. Take every CFI-G normal-flame run (fuel from the burner into an O₂/N₂ atmosphere). 2. A run has a cool flame when NASA's "Cool flame?" column starts with "yes". ` +
      `3. Group runs by fuel and pressure (NASA's "approx p (bar)") and count cool flames in each.`,
    uncertainty: {
      text:
        `At that fuel and pressure, cool flames appeared in ${cool.length} of ${sameSetting.length} runs (95% interval ${numbers.sameSettingCi}). ` +
        `None in the other ${numbers.otherRuns} runs still allows a true rate of up to about ${numbers.otherUpperPct}% at those settings.`,
      method: "Wilson score 95% intervals, treating each run as one independent trial; the upper bound for zero events is the Wilson upper limit.",
    },
    confounders: [
      "CFI-G set out to find cool flames, so the runs near these conditions were chosen where cool flames were expected; other settings were not searched as finely.",
      "Oxygen fell during each run (NASA gives before and after values); the before value is used.",
    ],
    notClaimed:
      "Gas-fuel burner flames in microgravity. This maps where CFI-G saw cool flames; it does not say cool flames cannot happen elsewhere, or that they are a cabin hazard.",
    investigations: ["acme-cfi-g"],
    table: {
      columns: ["Fuel", "Pressure (bar)", "Runs", "Cool flames", "O₂ before test (%)"],
      rows: [...settings.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, rs]) => {
          const [fuel, p] = k.split("|");
          const ox = rs.map((r) => r.o2Pct?.v).filter((v): v is number => typeof v === "number");
          return [fuel, p === "?" ? null : Number(p), rs.length, rs.filter(isCool).length, ox.length ? `${round(Math.min(...ox), 1)}–${round(Math.max(...ox), 1)}` : null];
        }),
    },
  };
}
