#!/usr/bin/env node
/**
 * W-03 / TD §18.1.6 — eenmalige probe van de huisvuilkalender Den Haag.
 * Alleen-lezen GET's voor het openbare testadres 2591 BB 87 (uit open-source integraties, geen persoonsgegeven),
 * plus robots.txt en de startpagina (gemeenteregels). Geen redirects volgen.
 * Schrijft de ruwe antwoorden als fixtures naar src/server/waste/__tests__/fixtures/real-*.
 * Gebruikt curl (volgt de proxy en CA-instellingen van de ontwikkelomgeving).
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/server/waste/__tests__/fixtures');
const BASE = 'https://huisvuilkalender.denhaag.nl';
const TEST_ADDRESS = '2591BB-87';
fs.mkdirSync(OUT, {recursive: true});

function get(name, url, accept = 'application/json') {
  const file = path.join(OUT, name);
  const r = spawnSync('curl', ['-sS', '--max-time', '15', '-o', file, '-w', '%{http_code}|%{content_type}|%{time_total}|%{size_download}|%{redirect_url}',
    '-H', 'Accept: ' + accept, '-A', 'Takenlijstje/1 (prive gezinsapp)', url], {encoding: 'utf8'});
  const [status, type, time, size, redirect] = (r.stdout || '').split('|');
  const res = {name, url: url.replace(BASE, ''), status: Number(status) || 0, type, seconds: Number(time), bytes: Number(size), redirect: redirect || null, error: (r.stderr || '').trim() || null};
  console.log(JSON.stringify(res));
  let body = null;
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    try { body = JSON.parse(text); } catch { body = text; }
    if (res.status !== 200) fs.rmSync(file);
  }
  return {...res, body};
}
function shape(value) {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first !== 'object') return typeof first;
  return Object.fromEntries(Object.entries(first).map(([k, v]) => [k, v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v]));
}

const robots = get('real-robots.txt', BASE + '/robots.txt', 'text/plain');
if (typeof robots.body === 'string') console.log('robots.txt:\n' + robots.body.slice(0, 2000));
const home = get('real-home.html', BASE + '/', 'text/html');
if (typeof home.body === 'string') {
  const text = home.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const re of [/[^.]{0,120}(22[.:]00|7[.:]45|07[.:]45|7[.:]30|07[.:]30)[^.]{0,120}/gi]) for (const m of text.matchAll(re)) console.log('regel: ' + m[0].trim());
  const links = [...home.body.matchAll(/(?:href|src)="([^"]*(?:voorwaarden|privacy|disclaimer|terms)[^"]*)"/gi)].map(m => m[1]);
  console.log('links voorwaarden/privacy: ' + JSON.stringify([...new Set(links)].slice(0, 10)));
}

const a = get('real-adressen.json', `${BASE}/rest/adressen/${TEST_ADDRESS}`);
console.log('A vorm: ' + JSON.stringify(shape(a.body)) + ' aantal: ' + (Array.isArray(a.body) ? a.body.length : '-'));
const candidate = Array.isArray(a.body) ? a.body[0] : null;
const bagId = candidate && String(candidate.bagId ?? candidate.bagid ?? candidate.id ?? '');
console.log('bagId: ' + bagId + ' (lengte ' + (bagId || '').length + ')');
if (bagId) {
  const b = get('real-afvalstromen.json', `${BASE}/rest/adressen/${encodeURIComponent(bagId)}/afvalstromen`);
  console.log('B vorm: ' + JSON.stringify(shape(b.body)));
  if (Array.isArray(b.body)) for (const s of b.body) console.log('stroom: ' + JSON.stringify({id: s.id, title: s.title, menu_title: s.menu_title, icon: s.icon}));
  const year = new Date().getFullYear();
  for (const y of [year, year + 1]) {
    const c = get(`real-kalender-${y === year ? 'J' : 'J1'}.json`, `${BASE}/rest/adressen/${encodeURIComponent(bagId)}/kalender/${y}`);
    console.log(`C ${y} vorm: ` + JSON.stringify(shape(c.body)) + ' aantal: ' + (Array.isArray(c.body) ? c.body.length : '-'));
    if (Array.isArray(c.body)) console.log(`C ${y} eerste: ` + JSON.stringify(c.body.slice(0, 3)));
  }
}
