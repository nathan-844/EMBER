import { createHash } from "node:crypto";

/**
 * Text from a PDF made comparable with a quote: ligatures spelled out, curly quotes and
 * apostrophes made straight, soft hyphens dropped and all whitespace collapsed to one space.
 * Nothing else changes, so a quote that matches is the paper's own wording.
 */
export function normaliseNtrsText(s: string): string {
  return s
    .replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl").replace(/ﬀ/g, "ff").replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hash of a quote as checked, so an edited quote no longer matches the manifest. */
export function quoteHash(text: string): string {
  return createHash("sha256").update(normaliseNtrsText(text)).digest("hex");
}
