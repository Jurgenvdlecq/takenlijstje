#!/usr/bin/env node
// Fixture-probe voor W-03 (afvalkalender), zie docs/wijzigingen/W-03/solution-architect-r2.md §18.1.6.
//
// Haalt de echte antwoorden van de huisvuilkalender van de gemeente Den Haag op voor het
// OPENBARE testadres 2591 BB 87 (geen persoonsgegeven) en bewaart ze als ruwe fixtures:
//   A  /rest/adressen/{POSTCODE}-{nummer}        adres -> kandidaten met bagId
//   B  /rest/adressen/{bagId}/afvalstromen       afvalsoorten (id, title, icon, ...)
//   C  /rest/adressen/{bagId}/kalender/{jaar}    alle ophaaldagen van jaar J en J+1
//   R  /robots.txt                               mag /rest/ geautomatiseerd worden bevraagd?
//
//   node scripts/waste-probe.mjs [--postcode 2591BB] [--nummer 87] [--map docs/wijzigingen/W-03/probe]
//
// Alleen GET via curl (volgt de proxy-instellingen van de omgeving). Geen redirects volgen,
// maximaal 1 MB per antwoord, 20 s per verzoek. Schrijft alleen in de opgegeven map.

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const BASE = "https://huisvuilkalender.denhaag.nl";
const UA = "Takenlijstje/1 (prive gezinsapp; fixture-probe)";
const MAX_BYTES = 1024 * 1024;
const PROJECT = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : def;
}

const postcode = String(opt("postcode", "2591BB")).toUpperCase().replace(/\s+/g, "");
const nummer = Number.parseInt(String(opt("nummer", "87")), 10);
const outRel = String(opt("map", "docs/wijzigingen/W-03/probe"));
const outDir = path.resolve(PROJECT, outRel);

if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(postcode)) fail(`Ongeldige postcode: ${postcode}`);
if (!Number.isInteger(nummer) || nummer < 1 || nummer > 99999) fail(`Ongeldig huisnummer: ${nummer}`);
if (!outDir.startsWith(PROJECT + path.sep)) fail("Uitvoermap moet binnen het project liggen.");
fs.mkdirSync(outDir, { recursive: true });

function fail(msg) {
  process.stderr.write(`probe: ${msg}\n`);
  process.exit(2);
}
function log(msg) {
  process.stdout.write(msg + "\n");
}

// Eén GET. Geeft status, content-type, duur en het pad van de bewaarde body terug.
async function get(name, url, accept = "application/json") {
  const body = path.join(outDir, name);
  const headers = path.join(outDir, name.replace(/\.[a-z]+$/, "") + ".headers.txt");
  const argv = [
    "-sS",
    "--max-time", "20",
    "--max-filesize", String(MAX_BYTES),
    "-o", body,
    "-D", headers,
    "-w", "%{http_code}\t%{content_type}\t%{time_total}\t%{num_redirects}\t%{redirect_url}\t%{size_download}",
    "-H", `Accept: ${accept}`,
    "-A", UA,
    url,
  ];
  const result = { name, url: url.replace(BASE, ""), status: 0, contentType: "", seconds: 0, redirectUrl: "", bytes: 0, curlError: null };
  try {
    const { stdout } = await run("curl", argv, { timeout: 30000 });
    const [status, contentType, seconds, , redirectUrl, bytes] = stdout.trim().split("\t");
    Object.assign(result, {
      status: Number(status),
      contentType: contentType || "",
      seconds: Number(Number(seconds).toFixed(3)),
      redirectUrl: redirectUrl || "",
      bytes: Number(bytes),
    });
  } catch (e) {
    // curl exit 63 = body groter dan max-filesize, 28 = time-out, 22 nvt (geen -f).
    result.curlError = `curl exit ${e.code ?? "?"}: ${String(e.stderr || e.message).trim().slice(0, 200)}`;
  }
  log(`${name.padEnd(24)} ${result.status || "-"} ${result.contentType || "-"} ${result.seconds}s ${result.bytes} B${result.redirectUrl ? " redirect->" + result.redirectUrl : ""}${result.curlError ? " " + result.curlError : ""}`);
  return result;
}

function readJson(name) {
  const file = path.join(outDir, name);
  if (!fs.existsSync(file)) return { ok: false, reason: "geen body" };
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) return { ok: false, reason: "lege body", text };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "geen geldige JSON", text: text.slice(0, 300) };
  }
}

const keysOf = (x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x) : []);

async function main() {
  const today = new Date();
  const year = today.getUTCFullYear();
  const summary = {
    probedAt: today.toISOString(),
    base: BASE,
    address: { postcode, nummer, note: "openbaar testadres uit de HACS-integratie; geen persoonsgegeven" },
    requests: [],
    findings: {},
  };

  // R: robots.txt
  const robots = await get("robots.txt", `${BASE}/robots.txt`, "*/*");
  summary.requests.push(robots);
  if (robots.status === 200) {
    const txt = fs.readFileSync(path.join(outDir, "robots.txt"), "utf8");
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    summary.findings.robots = {
      lines: lines.length,
      disallow: lines.filter((l) => /^disallow\s*:/i.test(l)),
      mentionsRest: lines.some((l) => /\/rest/i.test(l)),
    };
  } else {
    summary.findings.robots = { status: robots.status, note: "geen robots.txt (of niet 200): geen uitsluiting gevonden" };
  }

  // A: adres -> kandidaten
  const a = await get("A-adressen.json", `${BASE}/rest/adressen/${encodeURIComponent(postcode)}-${encodeURIComponent(String(nummer))}`);
  summary.requests.push(a);
  const aJson = readJson("A-adressen.json");
  let bagId = null;
  if (aJson.ok) {
    const rows = Array.isArray(aJson.value) ? aJson.value : [aJson.value];
    const first = rows[0];
    const idKey = first ? Object.keys(first).find((k) => /^bag/i.test(k)) : null;
    const ids = rows.map((r) => (idKey ? String(r[idKey]) : null)).filter(Boolean);
    summary.findings.A = {
      isArray: Array.isArray(aJson.value),
      count: rows.length,
      keys: keysOf(first),
      bagIdKey: idKey,
      bagIds: ids,
      bagIdMatches16Digits: ids.map((id) => /^[0-9]{16}$/.test(id)),
      // alleen de typen van de velden, zodat de parser (zod) klopt
      types: Object.fromEntries(keysOf(first).map((k) => [k, first[k] === null ? "null" : typeof first[k]])),
    };
    if (rows.length === 1 && ids[0]) bagId = ids[0];
    else if (rows.length > 1) {
      const plain = rows.find((r) => !r.huisletter && !r.huisnummerToevoeging);
      bagId = plain && idKey ? String(plain[idKey]) : ids[0] || null;
      summary.findings.A.note = "meer dan één kandidaat; probe kiest de rij zonder letter/toevoeging";
    }
  } else {
    summary.findings.A = { error: aJson.reason, sample: aJson.text };
  }

  if (!bagId) {
    summary.findings.stop = "Geen bagId uit A; B en C niet opgevraagd.";
  } else {
    // B: afvalstromen
    const b = await get("B-afvalstromen.json", `${BASE}/rest/adressen/${encodeURIComponent(bagId)}/afvalstromen`);
    summary.requests.push(b);
    const bJson = readJson("B-afvalstromen.json");
    if (bJson.ok && Array.isArray(bJson.value)) {
      summary.findings.B = {
        count: bJson.value.length,
        keys: keysOf(bJson.value[0]),
        streams: bJson.value.map((s) => ({
          id: s.id,
          title: s.title,
          menu_title: s.menu_title,
          icon: s.icon,
          ophaaldatum: s.ophaaldatum ?? null,
        })),
      };
    } else {
      summary.findings.B = { error: bJson.ok ? "geen array" : bJson.reason, sample: bJson.text };
    }

    // C: kalender J en J+1
    for (const y of [year, year + 1]) {
      const c = await get(`C-kalender-${y}.json`, `${BASE}/rest/adressen/${encodeURIComponent(bagId)}/kalender/${y}`);
      summary.requests.push(c);
      const cJson = readJson(`C-kalender-${y}.json`);
      if (cJson.ok && Array.isArray(cJson.value)) {
        const rows = cJson.value;
        const dates = rows.map((r) => r.ophaaldatum).filter((d) => typeof d === "string").sort();
        const perStream = {};
        for (const r of rows) perStream[r.afvalstroom_id] = (perStream[r.afvalstroom_id] || 0) + 1;
        summary.findings[`C${y}`] = {
          count: rows.length,
          keys: keysOf(rows[0]),
          firstDate: dates[0] ?? null,
          lastDate: dates.at(-1) ?? null,
          dateFormatIsYMD: dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
          nullDates: rows.filter((r) => r.ophaaldatum == null).length,
          perStream,
        };
      } else {
        summary.findings[`C${y}`] = { status: c.status, error: cJson.ok ? "geen array" : cJson.reason, sample: cJson.text };
      }
    }
  }

  fs.writeFileSync(path.join(outDir, "probe-summary.json"), JSON.stringify(summary, null, 2) + "\n");
  log("");
  log(JSON.stringify(summary.findings, null, 2));
  const core = summary.requests.filter((r) => /^(A|B|C-kalender-\d{4}\.json$)/.test(r.name) && !r.name.endsWith(`${year + 1}.json`));
  const ok = core.length >= 3 && core.every((r) => r.status === 200 && !r.curlError);
  log("");
  log(ok ? "PROBE OK: A, B en C(J) gaven 200." : "PROBE ONVOLLEDIG: zie statuscodes hierboven.");
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => fail(String(e && e.stack ? e.stack : e)));
