#!/usr/bin/env node
// Screenshot-hulpmiddel voor visual QA, UX-review en accessibility-review.
// Beschermd door de poort (alleen te wijzigen na /onderhoud-go).
//
//   node scripts/visual-check.mjs capability
//        Bewijst of echte screenshots mogelijk zijn en legt dat vast in .claude/state/visual-capability.json.
//   node scripts/visual-check.mjs shot <url | pad-naar-html-of-map> --naam <naam> [--map <submap>]
//        [--viewports 390x844,1440x900] [--volledig] [--wacht 800] [--donker]
//        Maakt screenshots in docs/screenshots/<submap>/<naam>-<breedte>x<hoogte>.png
//        en meldt console-fouten, paginafouten en mislukte verzoeken.
//
// Browser zoeken (in deze volgorde): $CHROME_PATH, standaard Playwright-browser,
// ~/.cache/chrome-hs (chrome-headless-shell), ~/.cache/ms-playwright, /opt/pw-browsers.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const PROJECT = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const SHOTS = path.join(PROJECT, "docs/screenshots");
const CAP = path.join(PROJECT, ".claude/state/visual-capability.json");
const [, , mode = "capability", ...rest] = process.argv;

function opt(name, def) {
  const i = rest.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = rest[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
function log(msg) { process.stdout.write(msg + "\n"); }

async function loadPlaywright() {
  const tries = [];
  const reqs = [createRequire(path.join(PROJECT, "package.json"))];
  try { reqs.push(createRequire(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "noop.js"))); } catch {}
  for (const req of reqs) for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
    try { const m = req(name); return { pw: m.chromium ? m : m.default || m, name }; } catch (e) { tries.push(name); }
  }
  throw new Error("Playwright niet gevonden. Installeer buiten het project: npm i -g playwright-core");
}
function findExecutables() {
  const out = [];
  if (process.env.CHROME_PATH) out.push(process.env.CHROME_PATH);
  const roots = [path.join(os.homedir(), ".cache/chrome-hs"), path.join(os.homedir(), ".cache/ms-playwright"), "/opt/pw-browsers", process.env.PLAYWRIGHT_BROWSERS_PATH].filter(Boolean);
  const names = new Set(["chrome-headless-shell", "chrome", "headless_shell"]);
  const walk = (dir, depth) => {
    if (depth > 6 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (names.has(e.name)) { try { fs.accessSync(p, fs.constants.X_OK); out.push(p); } catch {} }
    }
  };
  roots.forEach((r) => walk(r, 0));
  return [...new Set(out)];
}
async function launch(pw) {
  const args = ["--no-proxy-server", "--no-sandbox", "--disable-dev-shm-usage"];
  const errors = [];
  try { return { browser: await pw.chromium.launch({ args }), how: "standaard Playwright-browser" }; } catch (e) { errors.push(`standaard: ${e.message.split("\n")[0]}`); }
  for (const exe of findExecutables()) {
    try { return { browser: await pw.chromium.launch({ executablePath: exe, args }), how: exe }; } catch (e) { errors.push(`${exe}: ${e.message.split("\n")[0]}`); }
  }
  throw new Error("Geen werkende browser.\n  " + errors.join("\n  "));
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2" };
function serveDir(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(dir, p);
      if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end("niet gevonden"); }
      res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}
function parseViewports(v) {
  return String(v).split(",").map((s) => { const [w, h] = s.trim().split("x").map(Number); return { width: w, height: h }; }).filter((x) => x.width && x.height);
}
function writeCap(obj) {
  fs.mkdirSync(path.dirname(CAP), { recursive: true });
  fs.writeFileSync(CAP, JSON.stringify({ ...obj, op: new Date().toISOString() }, null, 2) + "\n");
}
function blocked(reason) {
  writeCap({ ok: false, reden: reason });
  log("\nVISUAL QA GEBLOKKEERD — echte gerenderde screenshots konden niet worden gemaakt/bekeken.");
  log(`Reden: ${reason}`);
  log("\nOplossingen (zie .claude/INSTALLATIE.md, stap 'Screenshots in de cloud'):");
  log("  A. npm i -g playwright-core && npx -y @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/chrome-hs");
  log("     (download via storage.googleapis.com, staat op de standaard 'Trusted'-lijst)");
  log("  B. Cloud-omgeving op 'Custom' netwerk met cdn.playwright.dev en playwright.download.prss.microsoft.com,");
  log("     setup-script: npx -y playwright install --with-deps chromium");
  process.exit(3);
}

async function capability() {
  let pw;
  try { pw = (await loadPlaywright()).pw; } catch (e) { return blocked(e.message); }
  let b;
  try { b = await launch(pw); } catch (e) { return blocked(e.message); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;font:600 28px system-ui,sans-serif}#blok{background:#1f5eff;color:#fff;height:50vh;display:flex;align-items:center;justify-content:center}#onder{background:#ffb000;height:50vh}</style><div id=blok>CAPABILITY OK</div><div id=onder></div>`);
  const srv = await serveDir(dir);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const out = path.join(SHOTS, "_capability");
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const ctx = await b.browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const resp = await page.goto(url, { waitUntil: "load", timeout: 15000 });
      if (!resp || !resp.ok()) throw new Error(`lokale pagina niet bereikbaar (${resp && resp.status()})`);
      const width = await page.evaluate(() => document.getElementById("blok").getBoundingClientRect().width);
      if (Math.round(width) !== vp.width) throw new Error(`viewport klopt niet: ${width} i.p.v. ${vp.width}`);
      const file = path.join(out, `capability-${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: file });
      const s = pngSize(file);
      if (!s || s.w !== vp.width || s.h !== vp.height || s.bytes < 1000) throw new Error(`screenshot ongeldig (${JSON.stringify(s)})`);
      results.push(path.relative(PROJECT, file));
      await ctx.close();
    }
  } catch (e) {
    await b.browser.close(); srv.close();
    return blocked(e.message);
  }
  const version = b.browser.version();
  await b.browser.close(); srv.close();
  writeCap({ ok: true, browser: `${b.how} (${version})`, screenshots: results, bekeken: "moet door de agent worden bevestigd door het PNG-bestand met Read te openen" });
  log("SCREENSHOT-CAPABILITY TECHNISCH BEWEZEN.");
  log(`Browser: ${b.how} (${version})`);
  log(`Screenshots: ${results.join(", ")}`);
  log("\nLAATSTE STAP (verplicht): open docs/screenshots/_capability/capability-390x844.png met het Read-tool.");
  log("Verwacht beeld: bovenste helft blauw met witte tekst 'CAPABILITY OK', onderste helft oranje-geel.");
  log("Noteer in docs/PROGRESS.md onder 'Capabilities' wat je daadwerkelijk ziet. Zie je het niet, dan is visual QA GEBLOKKEERD.");
}

async function shot() {
  const valued = new Set(["--naam", "--map", "--viewports", "--wacht"]);
  const target = rest.find((a, i) => !a.startsWith("--") && !valued.has(rest[i - 1]));
  const naam = opt("naam", "scherm");
  const sub = opt("map", "los");
  const vps = parseViewports(opt("viewports", "390x844"));
  const wacht = Number(opt("wacht", 600));
  if (!target) { log("Gebruik: node scripts/visual-check.mjs shot <url|pad> --naam <naam> [--map <submap>] [--viewports 390x844]"); process.exit(1); }
  let pw;
  try { pw = (await loadPlaywright()).pw; } catch (e) { return blocked(e.message); }
  let b;
  try { b = await launch(pw); } catch (e) { return blocked(e.message); }
  let url = target, srv = null;
  if (!/^https?:\/\//.test(target)) {
    const abs = path.resolve(PROJECT, target);
    const dir = fs.statSync(abs).isDirectory() ? abs : path.dirname(abs);
    srv = await serveDir(dir);
    url = `http://127.0.0.1:${srv.address().port}/${fs.statSync(abs).isDirectory() ? "" : path.basename(abs)}`;
  } else url = target.replace("localhost", "127.0.0.1");
  const out = path.join(SHOTS, String(sub));
  fs.mkdirSync(out, { recursive: true });
  const report = { url: target, screenshots: [], consoleFouten: [], paginaFouten: [], misluktVerzoek: [] };
  for (const vp of vps) {
    const ctx = await b.browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: opt("donker", false) ? "dark" : "light" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") report.consoleFouten.push(m.text()); });
    page.on("pageerror", (e) => report.paginaFouten.push(e.message));
    page.on("requestfailed", (r) => report.misluktVerzoek.push(`${r.url()} (${r.failure()?.errorText})`));
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      if (resp && !resp.ok()) report.paginaFouten.push(`HTTP ${resp.status()}`);
    } catch (e) { report.paginaFouten.push(`laden mislukt: ${e.message.split("\n")[0]}`); }
    await page.waitForTimeout(wacht);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth).catch(() => null);
    if (overflow) report.paginaFouten.push(`horizontale overflow op ${vp.width}px`);
    const file = path.join(out, `${naam}-${vp.width}x${vp.height}.png`);
    await page.screenshot({ path: file, fullPage: !!opt("volledig", false) });
    report.screenshots.push(path.relative(PROJECT, file));
    await ctx.close();
  }
  await b.browser.close();
  if (srv) srv.close();
  log(JSON.stringify(report, null, 2));
  log("\nOpen elk screenshot met het Read-tool voordat je er iets over zegt. Een oordeel zonder bekeken screenshot is niet toegestaan.");
}

if (mode === "capability") await capability();
else if (mode === "shot") await shot();
else { log("Onbekende opdracht. Gebruik 'capability' of 'shot'."); process.exit(1); }
