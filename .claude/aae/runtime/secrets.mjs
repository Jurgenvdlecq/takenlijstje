/**
 * AAE 3.3 - één gedeelde controle voor Read, Grep en Glob (ook voor subagents): nooit een geheim lezen via een pad, een glob of een brede zoekopdracht.
 * Geheim = elk .env-bestand (behalve .env.example) en alles in of onder .claude/aae/private. Alles wat deze module niet begrijpt wordt geweigerd.
 */
import fs from 'node:fs';
import path from 'node:path';
import {requireThat, safePath, relativeInput} from './core.mjs';

const PARAMS = { // de enige bekende parameters per tool; een onbekende parameter is een weigering
  Read: ['file_path', 'offset', 'limit', 'pages'],
  Grep: ['pattern', 'path', 'glob', 'type', 'output_mode', '-A', '-B', '-C', '-n', '-i', '-o', 'context', 'head_limit', 'offset', 'multiline'],
  Glob: ['pattern', 'path']
};
const MAX_ITEMS = 100000;

// Eén lijst van geheime bestandsnamen en -inhoud, gedeeld door de leescontrole, de git-leesopdrachten, cli diagnose en de commitcontrole (gitops.mjs).
export const SECRET_NAME = [/(^|\/)\.env(\.[^/]*)?$/i, /\.(pem|key|p12|pfx|jks|keystore)$/i, /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i, /(^|\/)\.npmrc$/i, /(^|\/)\.netrc$/i, /(^|\/)credentials(\.json)?$/i, /service[-_]?account[^/]*\.json$/i,
  /(^|\/)\.auth(\/|$)/i, /(^|\/)testauth(\/|$)/i, /storage-?state[^/]*\.json$/i, /\.session$/i];
export const SECRET_OK = [/(^|\/)\.env\.example$/i];
export const SECRET_CONTENT = [
  [new RegExp('-----BEGIN [A-Z ]*PRIVATE ' + 'KEY-----'), 'privésleutel'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS-sleutel'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub-token'], [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/, 'GitHub-token'],
  [/\bsk-[A-Za-z0-9_-]{32,}\b/, 'API-sleutel'], [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack-token'],
  [/SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*['"]?[A-Za-z0-9._-]{20,}/, 'Supabase service-role-sleutel']
];
/** Bevat deze tekst een bekend geheimpatroon? Geeft de soort terug (nooit de inhoud), of null. */
export const secretContent = tekst => (SECRET_CONTENT.find(([re]) => re.test(String(tekst))) || [])[1] || null;

/** Is dit (relatieve) pad een geheim? Hoofdletterongevoelig; .claude/aae/private met en zonder slash; .env*, test-auth- en sessiebestanden en bekende geheime bestandsnamen. */
export function secretPath(rel) {
  const r = String(rel).replace(/\\/g, '/').replace(/^\.\/+/, ''), l = r.toLowerCase();
  if (l === '.claude/aae/private' || l.startsWith('.claude/aae/private/')) return true;
  if (l.split('/').some(s => /^\.env(?:\.|$)/.test(s) && s !== '.env.example')) return true;
  return SECRET_NAME.some(re => re.test(r)) && !SECRET_OK.some(re => re.test(r));
}
// Conservatief: raakt deze eenvoudige glob (alleen letters, cijfers, _ . / * -) dit pad, een deel van het pad of een map erin? Liever te veel dan te weinig.
const globRe = g => new RegExp('^' + g.replace(/^\.?\/+/, '').replace(/\/+$/, '').split('**').map(d => d.split('*').map(x => x.replace(/\./g, '\\.')).join('[^/]*')).join('.*') + '$', 'i');
function globRaakt(g, rel) {
  const re = globRe(g), d = rel.split('/');
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j <= d.length; j++) if (re.test(d.slice(i, j).join('/'))) return true;
  return false;
}
/** Alle bestaande geheimen onder een map (volledige paden vanaf de projectroot). Te groot om te beoordelen = fail-closed. */
function bestaandeGeheimen(base, dir) {
  const uit = []; let n = 0;
  const loop = rel => {
    for (const d of fs.readdirSync(path.join(base, rel), {withFileTypes: true})) {
      requireThat(++n <= MAX_ITEMS, 'De map is te groot om veilig breed te doorzoeken. Kies een kleinere map of een eenvoudige glob zoals *.ts.');
      const r = rel ? rel + '/' + d.name : d.name;
      if (d.isDirectory()) loop(r); else if (secretPath(r)) uit.push(r);
    }
  };
  loop(dir);
  return uit;
}

/** Controleert één leesactie. Geeft het genormaliseerde pad (relatief aan de projectroot) terug, of null als er geen pad gekozen is. */
export function guardSecretRead(root, e) {
  const name = e.tool_name, input = e.tool_input || {}, cwd = e.cwd || root;
  requireThat(Object.keys(input).every(k => PARAMS[name].includes(k)), 'Onbekende parameter voor ' + name + ': AAE weigert wat het niet begrijpt.');
  const base = fs.realpathSync(root), kies = name === 'Read' ? input.file_path : input.path;
  requireThat(kies === undefined || (typeof kies === 'string' && kies.length > 0), 'Ongeldig pad.');
  const doel = kies !== undefined && path.resolve(cwd, kies) !== base ? kies : null;
  const p = doel ? relativeInput(root, doel, cwd) : null;
  if (p) {
    safePath(root, p);
    requireThat(!(p.toLowerCase() === '.claude/aae/private' || p.toLowerCase().startsWith('.claude/aae/private/')), 'Lees geen testauthcookies met modeltools. Gebruik alleen de fixturehelper.');
    requireThat(!secretPath(p), 'Lees geen secrets. Gebruik .env.example of namen zonder waarden.');
  }
  if (name === 'Read') return p;
  const g = name === 'Glob' ? input.pattern : input.glob;
  requireThat(g === undefined || (typeof g === 'string' && /^[A-Za-z0-9_./*-]+$/.test(g) && !/(^|\/)\.\.(\/|$)/.test(g) && !g.startsWith('/') && !/\.env|private/i.test(g)), 'Deze glob wordt niet toegelaten (alleen letters, cijfers, _ . / * - ; zonder .env of private). Kies een eenvoudige glob zoals *.ts.');
  const stuk = p || '', doelPad = path.join(base, stuk);
  if (fs.existsSync(doelPad) && fs.statSync(doelPad).isDirectory()) { // een brede zoekopdracht over een map met een bestaand geheim vraagt een veilige afbakening
    const geheimen = bestaandeGeheimen(base, stuk);
    requireThat(!geheimen.length || (typeof g === 'string' && geheimen.every(s => !globRaakt(g, s))), 'Deze zoekopdracht is te breed: de map bevat een geheim (.env of .claude/aae/private). Kies een kleinere map of een eenvoudige glob zoals *.ts.');
  }
  return p;
}
