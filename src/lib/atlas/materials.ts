// Material dictionary: maps NASA's free-text sample and fuel labels to a normalised name, a form
// and stated dimensions. Every label in the stored tables goes through here; the tests check that
// none falls through unexplained. Nothing is guessed: a label that does not name a material
// gets name null, unless a stated NASA source supports an inference (basis "inferred" + reason).
import type { FuelClass, MaterialInfo } from "./types";

const INCH_MM = 25.4;

interface Rule {
  re: RegExp;
  name: string;
  fuelClass: FuelClass;
}

// Order matters: the first match wins (blends before their single components).
const RULES: Rule[] = [
  // Solids
  { re: /sibal|cotton-fiberglass/i, name: "SIBAL cotton-fiberglass fabric", fuelClass: "solid" },
  { re: /cotton jersey/i, name: "Cotton jersey", fuelClass: "solid" },
  { re: /pmma.*nomex/i, name: "PMMA + Nomex (one composite sample)", fuelClass: "solid" },
  { re: /nomex/i, name: "Nomex", fuelClass: "solid" },
  { re: /pmma/i, name: "PMMA", fuelClass: "solid" },
  { re: /silicone/i, name: "Silicone rubber", fuelClass: "solid" },
  { re: /ultem/i, name: "Ultem", fuelClass: "solid" },
  { re: /kapton/i, name: "Kapton", fuelClass: "solid" },
  { re: /teflon/i, name: "Teflon", fuelClass: "solid" },
  { re: /lampwick/i, name: "Lampwick", fuelClass: "solid" },
  { re: /pyrell/i, name: "Pyrell foam", fuelClass: "solid" },
  { re: /japan wax/i, name: "Japan wax", fuelClass: "solid" },
  { re: /par+af+in/i, name: "Paraffin wax", fuelClass: "solid" },
  { re: /\bwax\b/i, name: "Wax (type not stated)", fuelClass: "solid" },
  { re: /^\s*candle\s*$/i, name: "Wax (type not stated)", fuelClass: "solid" },
  // Liquids
  { re: /dibutyl phthalate/i, name: "Dibutyl phthalate", fuelClass: "liquid" },
  { re: /iso-?dodecane/i, name: "n-Dodecane / iso-dodecane blend", fuelClass: "liquid" },
  { re: /c12h26/i, name: "n-Dodecane", fuelClass: "liquid" },
  { re: /heptane.*iso-?octane/i, name: "Heptane / isooctane blend", fuelClass: "liquid" },
  { re: /propanol.*glycerol/i, name: "Propanol / glycerol blend", fuelClass: "liquid" },
  { re: /iso-?octane/i, name: "Isooctane", fuelClass: "liquid" },
  { re: /n-octane/i, name: "n-Octane", fuelClass: "liquid" },
  { re: /heptane/i, name: "n-Heptane", fuelClass: "liquid" },
  { re: /decane/i, name: "n-Decane", fuelClass: "liquid" },
  { re: /methanol/i, name: "Methanol", fuelClass: "liquid" },
  { re: /ethanol/i, name: "Ethanol", fuelClass: "liquid" },
  // Gases
  { re: /h2 with ch4/i, name: "Hydrogen / methane blend", fuelClass: "gas" },
  { re: /\bh2\b/i, name: "Hydrogen", fuelClass: "gas" },
  { re: /c2h4|ethylene/i, name: "Ethylene", fuelClass: "gas" },
  { re: /c2h6/i, name: "Ethane", fuelClass: "gas" },
  { re: /\bch4\b|methane/i, name: "Methane", fuelClass: "gas" },
  { re: /c3h8|propane/i, name: "Propane", fuelClass: "gas" },
  { re: /propylene/i, name: "Propylene", fuelClass: "gas" },
  { re: /butane/i, name: "n-Butane", fuelClass: "gas" },
  { re: /ethane/i, name: "Ethane", fuelClass: "gas" },
  // Aerosol
  { re: /arizona road dust/i, name: "Arizona road dust (ARD Fine)", fuelClass: "aerosol" },
];

/** BASS-II rods and films that do not name a material. The PSI-25 record's publications include
 * "Microgravity Flammability of PMMA Rods in Concurrent Flow" and the film rows sit in a run of
 * PMMA film tests; EMBER marks these as inferred PMMA so analyses can include or exclude them. */
const BASS_II_INFER: { re: RegExp; reason: string }[] = [
  { re: /\brod\b/i, reason: "BASS-II rod label without a material; the PSI-25 record lists the paper \"Microgravity Flammability of PMMA Rods in Concurrent Flow\"" },
  { re: /micron film|mm film|thick film/i, reason: "BASS-II film label without a material, in a run of rows labelled PMMA film" },
  { re: /^\s*\d+\s*micron\s+\d+\s*cm wide\s*$/i, reason: "BASS-II film label without a material, in a run of rows labelled PMMA film" },
];

const num = (s: string) => Number(s);

function dims(label: string, info: MaterialInfo): void {
  const micron = /(\d+)\s*micron/i.exec(label);
  if (micron) info.thicknessMm = num(micron[1]) / 1000;
  const mm = /(\d*\.?\d+)\s*mm\b/i.exec(label);
  if (!micron && mm && info.form !== "droplet") info.thicknessMm = num(mm[1]);
  const inch = /(\d+)\s*\/\s*(\d+)\s*"?|(\d*\.\d+)\s*"/.exec(label);
  if (/rod/i.test(label) && inch) info.diameterMm = +((inch[3] ? num(inch[3]) : num(inch[1]) / num(inch[2])) * INCH_MM).toFixed(2);
  // Width: "2 cm wide" (also the typos "2ide" and a trailing "2 cm thick"), a leading "2 cm", or a trailing "2 cm".
  const width =
    /(\d*\.?\d+)\s*cm\s*(wide|2ide|thick(?=\s*$))/i.exec(label) ?? /^\s*(\d*\.?\d+)\s*cm\b/i.exec(label) ?? /(\d*\.?\d+)\s*cm\s*$/i.exec(label);
  if (width && !/sphere|spherical/i.test(label)) info.widthCm = num(width[1]);
  const sphere = /(\d*\.?\d+)\s*cm\b/i.exec(label);
  if (/sphere|spherical/i.test(label) && sphere) info.diameterMm = num(sphere[1]) * 10;
  const sides = /\b([12]|one|two)[\s-]*sided/i.exec(label);
  if (sides) info.sides = /^(1|one)$/i.test(sides[1]) ? 1 : 2;
}

/** Fuel share in a gas or liquid label ("50% C2H4", "75 % Propylene", "Propanol (95%)" → first %). */
function fuelShare(label: string, info: MaterialInfo): void {
  const pct = /(\d+(?:\.\d+)?)\s*%/.exec(label);
  if (pct) info.fuelPct = num(pct[1]);
}

function form(label: string, fuelClass: FuelClass | null, table: string): string | null {
  if (/spherical section/i.test(label)) return "spherical section";
  if (/sphere/i.test(label)) return "sphere";
  if (/rod/i.test(label)) return "rod";
  if (/film|micron/i.test(label)) return "film";
  if (/candle/i.test(label)) return "candle";
  if (/slab|sheet|thick/i.test(label)) return "slab";
  if (/sibal|nomex|fabric|jersey|cotton/i.test(label)) return "fabric";
  if (fuelClass === "liquid" && /PSI-(39|68|69)-/.test(table)) return "droplet";
  if (fuelClass === "gas" && /PSI-107-|PSI-106-/.test(table)) return "jet";
  if (fuelClass === "gas") return "burner";
  if (/PSI-10[12]-/.test(table)) return "heated sample (smoke)";
  if (fuelClass === "aerosol") return "dust";
  return null;
}

export interface Normalised extends MaterialInfo {
  fuelClass: FuelClass | null;
}

/** Normalise one material or fuel label from a given table. */
export function normaliseMaterial(raw: string, table: string): Normalised {
  const label = raw.trim();
  const flags: string[] = [];
  // ACME-CLD and ACME S-Flame labels whose formula counts up row by row ("40% CH5", "CH6", "C2H5"…
  // "C2H11", "with N3"…): a spreadsheet fill-down. The real gas is not stated, so no name is given.
  // C2H6 is a real fuel (ethane) elsewhere, but inside these runs it is one step of the count.
  const fillDown = /\bCH([5-9]|\d{2})\b/.test(label) || /with N[3-9]\b/.test(label) ||
    (table === "PSI-21-0" && /\bC2H([5-9]|\d{2})\b/.test(label));
  if (fillDown) {
    flags.push("label-fill-down");
    const info: Normalised = { name: null, basis: "none", form: "burner", fuelClass: "gas", flags };
    fuelShare(label, info);
    return info;
  }
  const rule = RULES.find((r) => r.re.test(label));
  let info: Normalised;
  if (rule) {
    info = { name: rule.name, basis: "stated", form: null, fuelClass: rule.fuelClass };
  } else {
    const infer =
      table === "PSI-25-0" ? BASS_II_INFER.find((r) => r.re.test(label))
      : table === "PSI-26-0" && /\bsphere\b/i.test(label) ? { reason: "BASS sphere label without a material; other rows in the same table name the same sizes \"PMMA sphere 2 cm\" and \"PMMA sphere 1 cm\"" }
      : undefined;
    info = infer
      ? { name: "PMMA", basis: "inferred", reason: infer.reason, form: null, fuelClass: "solid" }
      : { name: null, basis: "none", form: null, fuelClass: null };
  }
  info.form = form(label, info.fuelClass, table);
  if (info.fuelClass === "solid") dims(label, info);
  if (info.fuelClass === "gas" || info.fuelClass === "liquid") fuelShare(label, info);
  if (/blac\b|2ide|oppsed|parrafin|visulation/i.test(label)) flags.push("label-typo");
  if (flags.length) info.flags = flags;
  return info;
}
