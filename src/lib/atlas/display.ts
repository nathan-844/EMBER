// Display-only formatting of atlas values. Rounding here never decides a match or a calculation.
const shown = (v: number) => String(Number(v.toFixed(2)));

/** Text for a value or span, rounded to two decimals ("21", "21.5–21.7"); null when not recorded. */
export function displayValue(v: number | null, span?: [number, number]): string | null {
  if (v !== null) return shown(v);
  if (!span) return null;
  return span[0] === span[1] ? shown(span[0]) : `${shown(span[0])}–${shown(span[1])}`;
}
