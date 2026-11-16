// Records the 30-second Space Apps demo video and still screenshots from the real app.
// Nothing is mocked: Playwright drives a running EMBER server.
//
//   npx vite build
//   npm run preview:demo   (replays recorded Gemini answers)
//   npm run video:record
//
// Options: --base <url> (default http://127.0.0.1:4173)  --out <dir> (default media)
// Writes media/ember-demo-30s.mp4, media/ember-demo-poster.jpg and shot-*.png.
// Captions are drawn on the page itself during recording, so ffmpeg only trims and encodes.
// Needs Playwright with Chromium (npx playwright install chromium) and ffmpeg (ffmpeg-static or on PATH).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
let ffmpeg = "ffmpeg";
try { ffmpeg = require("ffmpeg-static") || ffmpeg; } catch { /* use ffmpeg on PATH */ }

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
const W = 1280, H = 720;
const browser = await chromium.launch();

// ---- Stills for the deck and project page (1600×1000 at 2×) ----
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const shot = (file) => page.screenshot({ path: join(out, file) });
  await page.goto(base + "/");
  await page.waitForSelector(".land-hero h1");
  await shot("shot-home.png");
  await page.goto(base + "/#lab");
  await page.waitForSelector(".o2-stage");
  await shot("shot-lab.png");
  await page.getByRole("button", { name: /recorded analysis of this scenario/ }).click();
  await page.waitForSelector(".tile-dialog[open] .verdict", { timeout: 20000 });
  await page.locator(".tile-dialog[open] .tile-dialog-inner").screenshot({ path: join(out, "shot-ai.png") });
  await page.keyboard.press("Escape");
  await page.goto(base + "/#findings");
  await page.waitForSelector(".f-tiles");
  await shot("shot-findings.png");
  await page.locator("#F3").screenshot({ path: join(out, "shot-finding-f3.png") });
  await page.goto(base + "/#mission");
  await page.waitForSelector(".mission-answer");
  await shot("shot-mission.png");
  await page.goto(base + "/#credibility");
  await page.waitForSelector("h1");
  await shot("shot-credibility.png");
  await page.goto(base + "/#data");
  await page.waitForSelector("#audit");
  await page.evaluate(() => document.getElementById("audit").scrollIntoView());
  await page.waitForTimeout(400);
  await shot("shot-audit.png");
  await page.close();
}

// ---- The 30-second video ----
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: raw, size: { width: W, height: H } } });
const page = await ctx.newPage();
const t0 = Date.now();
const wait = (ms) => page.waitForTimeout(ms);

// A glass caption bar that matches the site, kept on the page across hash navigation.
const CAPTION_CSS = `
  #demo-cap { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 9999; max-width: 980px;
    padding: 14px 26px; border-radius: 22px; background: rgb(17 17 19 / 0.78); color: #fff; text-align: center;
    font: 600 22px/1.3 -apple-system, "Inter", "Segoe UI", sans-serif; letter-spacing: -0.01em;
    -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), 0 18px 40px -12px rgb(0 0 0 / 0.45);
    transition: opacity 0.35s ease, transform 0.35s ease; pointer-events: none; }
  #demo-cap.out { opacity: 0; transform: translate(-50%, 8px); }
  #demo-cap b { color: #ff9a72; font-weight: 700; }
  html { scroll-behavior: smooth; }
  /* Scroll-in fades would leave cards blank in a fast cut; show them straight away. */
  html.motion .reveal { opacity: 1 !important; transform: none !important; }`;
const ensureCaption = () => page.evaluate((css) => {
  if (document.getElementById("demo-cap")) return;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
  const d = document.createElement("div"); d.id = "demo-cap"; d.className = "out"; document.body.appendChild(d);
}, CAPTION_CSS);
const caption = async (html) => {
  await ensureCaption();
  await page.evaluate((h) => {
    const d = document.getElementById("demo-cap");
    // An open dialog draws above everything else, so the caption moves inside it while it is open.
    const host = document.querySelector("dialog[open]") ?? document.body;
    if (d.parentElement !== host) host.appendChild(d);
    d.classList.add("out");
    setTimeout(() => { d.innerHTML = h; d.classList.remove("out"); }, 180);
  }, html);
};
// Hash navigation keeps one document, so the recording has no reload flash.
const go = async (hash, selector) => {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForSelector(selector);
};
const scrollTo = (selector, block = "center") => page.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: b }), [selector, block]);

await page.goto(base + "/");
await page.waitForSelector(".land-hero h1");
await wait(400);
const start = (Date.now() - t0) / 1000;

// 1. The question (home)
await caption("A Moon base may breathe <b>30% oxygen</b>. Does NASA’s fire data cover it?");
await wait(2800);

// 2. Explore: switch habitats and watch the chart move
await go("#lab", ".o2-stage");
await caption("EMBER ranks <b>20 NASA investigations</b> against your habitat");
await wait(900);
await page.selectOption("#env-rail", "iss");
await wait(1100);
await page.selectOption("#env-rail", "lunar-habitat");
await wait(1500);
await caption("NASA PSI’s solid-material tests stop at <b>22.2% oxygen</b>: 7.8 points short");
await wait(2600);

// 3. Findings
await go("#findings", ".f-tiles");
await caption(`<b>${COUNTS.findings.count} findings</b> calculated by code from NASA’s own test rows`);
await wait(2600);
await page.evaluate(() => { const el = document.getElementById("F3"); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: "instant" }); });
await caption("On the ground, Saffire-II samples burned <b>further than in orbit</b>");
await wait(2700);

// 4. Ask EMBER: a recorded, source-checked answer
await go("#lab", ".chat-card .ask-whole");
await page.locator(".chat-card .ask-whole").click();
await page.waitForSelector(".tile-dialog[open] .verdict", { timeout: 20000 });
await caption(`The AI’s every quote and number is checked against NASA’s text: <b>${AI.correct} of ${AI.answers}</b> graded answers correct`);
await wait(1800);
await page.locator(".tile-dialog[open] .tile-dialog-body").evaluate((el) => el.scrollBy({ top: 380, behavior: "smooth" }));
await wait(1500);
await page.keyboard.press("Escape");
await page.evaluate(() => { const d = document.getElementById("demo-cap"); if (d) document.body.appendChild(d); });

// 5. Analyze: does a material's evidence carry over?
await go("#mission", ".mission-answer");
await page.evaluate(() => { const el = document.querySelector(".mission-answer"); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 110, behavior: "smooth" }); });
const nums = await page.$$eval(".mission-funnel .mission-answer-num", (els) => els.map((e) => e.textContent.trim()));
await caption(`Check a material: PMMA has <b>${nums[1] ?? "?"}</b> NASA tests in ISS air, <b>${nums[2] ?? "?"}</b> in Moon-base air`);
await wait(3200);

// 6. Data audit
await go("#data/audit", "#audit");
await wait(300);
await page.evaluate(() => { const el = document.getElementById("audit"); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: "smooth" }); });
await caption(`We read every cell of NASA’s ${COUNTS.audit.tablesChecked} tables and documented <b>${COUNTS.audit.issues} data issues</b>`);
await wait(2500);

// 7. End card
await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;background:#ffffff;color:#111113;font-family:-apple-system,'Inter','Segoe UI',sans-serif">
  <div style="font-size:18px;letter-spacing:4px;color:#b8431a;font-weight:600">NASA SPACE APPS 2026 · FLAME IN FREEFALL</div>
  <div style="display:flex;align-items:center;gap:22px"><div style="width:84px;height:84px;border-radius:50%;background:linear-gradient(180deg,#3a3a40,#111113);display:grid;place-items:center;box-shadow:inset 0 1px 0 rgb(255 255 255 / .22),0 10px 24px -8px rgb(0 0 0 / .45)"><svg width="40" height="40" viewBox="0 0 24 24" fill="#ff8a5c"><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.9 2.5-5 .2 1.6 1 2.6 2 3 0-3 .5-5.5.5-8z"/></svg></div>
  <div style="font-size:120px;font-weight:700;letter-spacing:-4px">EMBER</div></div>
  <div style="font-size:28px;color:#6e6e73">Fire-safety evidence for crews beyond Earth</div>
</body></html>`);
await wait(2600);
const end = (Date.now() - t0) / 1000;

const video = page.video();
await ctx.close();
await browser.close();
const webm = join(out, "raw.webm");
renameSync(await video.path(), webm);
rmSync(raw, { recursive: true, force: true });

const duration = Math.min(end - start, 30);
if (end - start > 30) console.warn(`Recording ran ${(end - start).toFixed(1)} s; the last ${(end - start - 30).toFixed(1)} s are cut.`);
const mp4 = join(out, "ember-demo-30s.mp4");
execFileSync(ffmpeg, [
  "-y", "-ss", start.toFixed(2), "-i", webm, "-t", duration.toFixed(2),
  "-vf", "scale=1920:1080:flags=lanczos,fps=30",
  "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  mp4,
], { stdio: "inherit" });
// Poster: the Explore chart, a few seconds in.
execFileSync(ffmpeg, ["-y", "-ss", "7.5", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(out, "ember-demo-poster.jpg")], { stdio: "inherit" });
rmSync(webm, { force: true });
console.log(`Video: ${mp4} (${duration.toFixed(1)} s); stills: ${readdirSync(out).filter((f) => f.startsWith("shot-")).join(", ")}`);
