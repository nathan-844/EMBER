// Records the 30-second Space Apps demo video and still screenshots from the real app.
// Nothing is mocked: Playwright drives a running EMBER server.
//
//   npm run build
//   npm run preview:demo   (replays recorded Gemini answers)
//   npm run video:record
//
// Options: --base <url> (default http://127.0.0.1:4173)  --out <dir> (default media)
// Writes media/ember-demo-30s.mp4 (captions burned in), ember-demo-30s.srt and shot-*.png.
// Needs Playwright with Chromium (local or global install) and ffmpeg with libass.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const root = execFileSync("npm", ["root", "-g"], { shell: process.platform === "win32" }).toString().trim();
  ({ chromium } = require(join(root, "playwright")));
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const base = arg("base", "http://127.0.0.1:4173").replace(/\/$/, "");
const out = resolve(arg("out", "media"));
const raw = join(out, "raw");
mkdirSync(raw, { recursive: true });

// Counts quoted in the captions come from the same generated files the app shows.
const COUNTS = JSON.parse(readFileSync("src/data/counts.json", "utf8"));
const AI = JSON.parse(readFileSync("src/data/ai-benchmark-summary.json", "utf8"));
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const W = 1280, H = 720;
const browser = await chromium.launch();

// ---- Stills for the deck and project page (1600×1000 at 2× for crisp slides) ----
// The lab is a grid of tiles; each tile opens its full panel in a dialog.
const openTile = async (page, id) => {
  await page.locator(`#${id}-tile button`).click();
  await page.waitForSelector(".tile-dialog[open] .tile-dialog-body > *");
  await page.waitForTimeout(500);
};
const closeDialog = async (page) => {
  await page.locator(".tile-dialog[open] .tile-close").click();
  await page.waitForTimeout(250);
};
const dialogShot = (page, file) => page.locator(".tile-dialog[open] .tile-dialog-inner").screenshot({ path: join(out, file) });
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await page.goto(base + "/#lab");
  await page.waitForSelector(".tile-headline");
  await page.screenshot({ path: join(out, "shot-lab.png") });
  await page.locator("#answer-tile").locator("xpath=ancestor::article").screenshot({ path: join(out, "shot-insight.png") });
  await page.getByRole("button", { name: /recorded analysis of this scenario/ }).click();
  await page.waitForSelector(".tile-dialog[open] .verdict", { timeout: 15000 });
  await dialogShot(page, "shot-ai.png");
  await closeDialog(page);
  for (const [id, file] of [["gap", "shot-gapmap.png"], ["tables", "shot-explorer.png"], ["equipment", "shot-equipment.png"], ["earth", "shot-earth.png"], ["coverage", "shot-coverage.png"]]) {
    await openTile(page, id);
    await dialogShot(page, file);
    await closeDialog(page);
  }
  await openTile(page, "near");
  await dialogShot(page, "shot-nearby.png");
  await closeDialog(page);
  await page.goto(base + "/#credibility");
  await page.waitForSelector("h1");
  await page.screenshot({ path: join(out, "shot-credibility.png") });
  await page.goto(base + "/#findings");
  await page.waitForSelector("#F1 .viz-dot");
  await page.screenshot({ path: join(out, "shot-findings.png") });
  await page.locator("#F3").screenshot({ path: join(out, "shot-finding-f3.png") });
  await page.goto(base + "/#data");
  await page.waitForSelector(".atlas-table tbody tr");
  await page.locator("#atlas").screenshot({ path: join(out, "shot-atlas.png") });
  await page.locator("#audit").scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById("audit").scrollIntoView());
  await page.screenshot({ path: join(out, "shot-audit.png") });
  await page.close();
}

// ---- The 30-second video ----
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "dark", recordVideo: { dir: raw, size: { width: W, height: H } } });
const page = await ctx.newPage();
const t0 = Date.now();
const marks = [];
const mark = (text) => marks.push({ at: (Date.now() - t0) / 1000, text });
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(base + "/#lab");
await page.waitForSelector(".tile-headline");
await page.addStyleTag({ content: "html{scroll-behavior:smooth}" });
const start = (Date.now() - t0) / 1000;

mark("A Moon base may breathe 30% oxygen at 10.2 psi. Does NASA’s fire data cover it?");
await wait(2700);

mark("EMBER ranks 20 NASA investigations against your habitat and says what each one covers");
await page.selectOption("#env", "iss");
await wait(1100);
await page.selectOption("#env", "lunar-habitat");
await wait(1700);

mark("Key finding: no solid-material test in NASA’s PSI data goes above 22.2% oxygen");
await openTile(page, "gap");
// Bring the plot (and the solid-material band) above the caption.
await page.locator(".tile-dialog[open] .tile-dialog-body").evaluate((el) => el.scrollBy({ top: 330, behavior: "instant" }));
await wait(2700);
await closeDialog(page);

// Hash navigation keeps one document, so the recording has no reload flash.
const go = async (hash, selector) => {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForSelector(selector);
  await wait(350);
};

mark(`${WORDS[COUNTS.findings.count]} findings computed from NASA’s own rows: on the ground, Saffire-II samples burned further than in orbit`);
await go("#findings/F3", "#F3 .pairs");
await wait(2900);

mark("Every number is one click from the cells NASA wrote");
await page.locator("#F3 details", { hasText: "NASA rows" }).locator("summary").click();
await page.waitForSelector("#F3 .cited-list li");
await page.locator("#F3 .cited-list").scrollIntoViewIfNeeded();
await wait(2500);

mark(`We read every cell of NASA’s ${COUNTS.audit.tablesChecked} tables and documented ${COUNTS.audit.issues} data-quality issues`);
await go("#data/audit", ".atlas-table tbody tr");
await page.evaluate(() => document.getElementById("audit").scrollIntoView());
await wait(2700);

await go("#lab", ".tile-headline");
mark(`Gemini answers; EMBER checks every quote and number. ${AI.correct} of ${AI.answers} graded answers correct`);
await page.getByRole("button", { name: /recorded analysis of this scenario/ }).click();
await page.waitForSelector(".tile-dialog[open] .verdict");
await wait(1900);
await page.locator(".tile-dialog[open] .tile-dialog-body").evaluate((el) => el.scrollBy({ top: 420, behavior: "smooth" }));
await wait(1700);
await closeDialog(page);

mark("Move a material from the ISS to the Moon and see which NASA tests still apply");
await go("#mission", ".mission-compare");
await page.evaluate(() => document.querySelector(".mission-result").scrollIntoView());
await wait(2900);

mark("Open NASA data, measured findings, checked AI, honest limits");
await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;background:#121A24;color:#F5F2EB;font-family:'Segoe UI',Arial,sans-serif">
  <div style="font-size:22px;letter-spacing:4px;color:#F08A60;font-weight:600">NASA SPACE APPS 2026 · FLAME IN FREEFALL</div>
  <div style="font-size:120px;font-weight:800;letter-spacing:-2px">EMBER</div>
  <div style="font-size:30px;color:#BCC8D6">Fire-safety evidence for crews beyond Earth</div>
</body></html>`);
await wait(2400);
const end = (Date.now() - t0) / 1000;

const video = page.video();
await ctx.close();
await browser.close();
const webm = join(out, "raw.webm");
renameSync(await video.path(), webm);
rmSync(raw, { recursive: true, force: true });

// ---- Captions (SRT, offsets from `start`) ----
const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = marks
  .map((m, i) => `${i + 1}\n${ts(m.at - start)} --> ${ts((marks[i + 1]?.at ?? end) - start - 0.05)}\n${m.text}\n`)
  .join("\n");
const srtPath = join(out, "ember-demo-30s.srt");
writeFileSync(srtPath, srt);

const duration = Math.min(end - start, 30);
// ffmpeg's subtitles filter needs a path with escaped drive colon on Windows.
const subPath = srtPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
const style = "FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H22101820,BackColour=&H33101820,BorderStyle=3,Outline=10,Shadow=0,MarginV=40,Alignment=2";
execFileSync("ffmpeg", [
  "-y", "-ss", start.toFixed(2), "-i", webm, "-t", duration.toFixed(2),
  "-vf", `subtitles='${subPath}':force_style='${style}',scale=1920:1080:flags=lanczos,fps=30`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  join(out, "ember-demo-30s.mp4"),
], { stdio: "inherit" });
rmSync(webm, { force: true });
console.log(`Video: ${join(out, "ember-demo-30s.mp4")} (${duration.toFixed(1)} s); stills: ${readdirSync(out).filter((f) => f.startsWith("shot-")).join(", ")}`);
