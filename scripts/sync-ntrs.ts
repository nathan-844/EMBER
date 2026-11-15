// Checks every NTRS quote in src/data/ntrs-evidence.ts against the PDF NASA serves, and records
// what was checked in src/data/ntrs-manifest.json.
//
// Usage: npm run sync:ntrs [-- --cache <dir>]
// Needs pdftotext (poppler-utils). Behind a proxy, run with NODE_USE_ENV_PROXY=1.
// With --cache, PDFs are read from and saved to <dir>/<ntrs id>.pdf.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NTRS_QUOTES, NTRS_SOURCES } from "../src/data/ntrs-evidence";
import { normaliseNtrsText, quoteHash } from "../src/lib/ntrs-text";

const API = "https://ntrs.nasa.gov";
const cacheArg = process.argv.indexOf("--cache");
const cache = cacheArg > 0 ? process.argv[cacheArg + 1] : mkdtempSync(join(tmpdir(), "ntrs-"));
mkdirSync(cache, { recursive: true });

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

async function pdfPath(id: string): Promise<string> {
  const meta = await (await fetch(`${API}/api/citations/${id}`)).json();
  const link = meta.downloads?.find((d: any) => d.links?.pdf)?.links.pdf;
  if (!link) throw new Error(`${id}: NTRS lists no PDF`);
  const file = join(cache, `${id}.pdf`);
  if (!existsSync(file)) {
    const res = await fetch(API + link);
    if (!res.ok) throw new Error(`${id}: PDF download failed (${res.status})`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

const manifest: any = { checkedOn: new Date().toISOString().slice(0, 10), tool: "", sources: {}, quotes: {} };
const version = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
manifest.tool = (version.stderr || version.stdout).split("\n")[0].trim() || "pdftotext";
let missing = 0;

for (const s of NTRS_SOURCES) {
  const file = await pdfPath(s.id);
  const pdf = readFileSync(file);
  const raw = execFileSync("pdftotext", [file, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
  const pages = raw.split("\f").map(normaliseNtrsText);
  const whole = normaliseNtrsText(raw);
  manifest.sources[s.id] = { pdfSha256: sha256(pdf), pages: pages.filter(Boolean).length };
  for (const q of NTRS_QUOTES.filter((x) => x.source === s.id)) {
    const text = normaliseNtrsText(q.text);
    if (!whole.includes(text)) {
      console.error(`NOT FOUND  ${q.id} in ${s.id}: ${q.text}`);
      missing++;
      continue;
    }
    // A quote that crosses a page break is credited to the page it starts on.
    let page = pages.findIndex((p) => p.includes(text)) + 1;
    if (page === 0) page = pages.findIndex((p) => p.includes(text.slice(0, 40))) + 1;
    manifest.quotes[q.id] = { source: s.id, page: page || null, sha256: quoteHash(q.text) };
  }
}

if (missing) {
  console.error(`${missing} quote(s) not found; manifest not written.`);
  process.exit(1);
}
writeFileSync("src/data/ntrs-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`Checked ${Object.keys(manifest.quotes).length} quotes in ${NTRS_SOURCES.length} NTRS PDFs.`);
