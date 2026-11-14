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
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

const W = 1280, H = 720;
const browser = await chromium.launch();

// ---- Stills for the deck and project page (1600×1000 at 2× for crisp slides) ----
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await page.goto(base + "/#lab");
  await page.waitForSelector(".insight-title");
  await page.screenshot({ path: join(out, "shot-lab.png") });
  await page.locator(".analysis button.btn-primary").click();
  await page.waitForSelector(".verdict", { timeout: 15000 });
  await page.locator(".analysis").screenshot({ path: join(out, "shot-ai.png") });
  await page.locator(".insight").screenshot({ path: join(out, "shot-insight.png") });
  await page.locator(".coverage").first().screenshot({ path: join(out, "shot-coverage.png") });
  await page.goto(base + "/#credibility");
  await page.waitForSelector("h1");
  await page.screenshot({ path: join(out, "shot-credibility.png") });
  await page.close();
}

// ---- The 30-second video ----
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "dark", recordVideo: { dir: raw, size: { width: W, height: H } } });
const page = await ctx.newPage();
const t0 = Date.now();
const marks = [];
const mark = (text) => marks.push({ at: (Date.now() - t0) / 1000, text });
const wait = (ms) => page.waitForTimeout(ms);
const smooth = async (selector, block = "start") => {
  await page.locator(selector).first().evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await wait(900);
};

await page.goto(base + "/#lab");
await page.waitForSelector(".insight-title");
await page.addStyleTag({ content: "html{scroll-behavior:smooth}" });
const start = (Date.now() - t0) / 1000;

mark("A Moon base may breathe 30% oxygen at 10.2 psi. Does NASA’s fire data cover it?");
await wait(3200);

mark("EMBER ranks 20 NASA combustion investigations against your habitat");
await page.selectOption("#env", "iss");
await wait(1100);
await page.selectOption("#env", "lunar-habitat");
await smooth(".insight", "center");
await wait(2000);

mark("…and says plainly what is missing: here, gravity, oxygen and pressure");
await wait(2800);

mark("Ranges come from 21 NASA run tables: 2,001 real test rows");
await smooth(".coverage", "center");
await wait(2600);

mark("Gemini writes the analysis. EMBER rejects any quote or number not found in NASA’s sources");
// Jump (not glide) back up to the analysis card: a long smooth scroll upward passes through the hero.
await page.evaluate(() => {
  const a = document.querySelector(".analysis");
  if (a) window.scrollTo({ top: window.scrollY + a.getBoundingClientRect().top - 70, behavior: "instant" });
});
await wait(700);
await page.locator(".analysis button.btn-primary").click({ noWaitAfter: true });
await page.waitForSelector(".verdict");
// Put the verdict and the first verified claims in view, then drift down through the quotes.
await page.evaluate(() => {
  const v = document.querySelector(".verdict");
  if (v) window.scrollTo({ top: window.scrollY + v.getBoundingClientRect().top - 90, behavior: "smooth" });
});
await wait(2200);
await page.evaluate(() => window.scrollBy({ top: 240, behavior: "smooth" }));
await wait(2600);

mark("Every ranking is stress-tested, every limit stated");
await smooth(".robust", "center");
await page.locator(".robust-head").click();
await wait(2600);

mark("Open NASA data, checked AI, honest limits");
await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;background:#121A24;color:#F5F2EB;font-family:'Segoe UI',Arial,sans-serif">
  <div style="font-size:22px;letter-spacing:4px;color:#F08A60;font-weight:600">NASA SPACE APPS 2026 · FLAME IN FREEFALL</div>
  <div style="font-size:120px;font-weight:800;letter-spacing:-2px">EMBER</div>
  <div style="font-size:30px;color:#BCC8D6">Fire-safety evidence for crews beyond Earth</div>
</body></html>`);
await wait(3000);
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
