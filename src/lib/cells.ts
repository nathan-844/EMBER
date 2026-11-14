// Shared NASA run-table cell parsing, used by the app (data explorer) and the server
// (nearest rows). Same rules as scripts/normalize-conditions.mjs.

/** Unit-stated scalars, ";"/","/"or"/"to" lists and "a - b" ranges. Anything else gives no values. */
export function cellValues(raw: string | undefined, parser = "parseCell"): number[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  if (parser === "pctO2InText") return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*O2/gi)].map((m) => Number(m[1]));
  const parts = text.replace(/~/g, "").split(/;|\bor\b|,|\bto\b|(?<=\d)\s+-\s+(?=\d)/).map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d*\.?\d+)\s*(atm|bar|mmhg|cm\/s|%|mm|cm)?$/i.exec(p);
    if (!m) return [];
    out.push(Number(m[1]));
  }
  return out;
}

/** A cell with no measurement: a lone dash (NASA's "not measured") or a character lost in export (U+FFFD). */
export const isNoValue = (v: string) => /^(\uFFFD+|[–—-])$/.test(v.trim());

/** Display form of a NASA column header (whitespace collapsed, the lost µ in Saffire-II named). */
export function cleanHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().replace(/^\?-g/, "µ-g (written ?-g in the NASA file)");
}
