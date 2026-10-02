/**
 * AAE 3.4 - cli diagnose <testbestand> [revisie]: de enige manier om zonder GO projectcode te draaien, en bewust klein.
 * Precies één concreet *.test.mjs-bestand (geen map, suite, package script, build of install), in een tijdelijke git-worktree buiten de werkmap met alleen
 * gevolgde, niet-geheime bestanden, een schone omgeving (PATH, tijdelijke HOME en TMPDIR), onder het permissiemodel van Node (lezen in de kopie, schrijven
 * alleen in de eigen tijdmap; geen kindprocessen), met een timeout van hoogstens 5 minuten, begrensde uitvoer en altijd opruimen.
 * Vóór elke run wordt aangetoond dat netwerk geblokkeerd is (een echte verbindingspoging naar een lokale server); lukt dat niet, dan weigert diagnose te starten.
 */
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {secretPath} from './secrets.mjs';
import {veiligPad} from './gitlezen.mjs';
import {trackedFingerprint} from './gitops.mjs';

export const MAX_TIMEOUT = 300000;
const MAX_UIT = 64 * 1024;
const TEST = /^(?![-\/:.~])[A-Za-z0-9_.\/@-]{1,250}\.test\.mjs$/;
const REV = /^(?![-:.])[A-Za-z0-9_.\/~^@-]{1,120}$/;
const git = (cwd, args) => spawnSync('git', args, {cwd, encoding: 'utf8', shell: false, timeout: 60000, maxBuffer: 32 * 1024 * 1024});
const schoneEnv = tmp => ({PATH: process.env.PATH || '/usr/bin:/bin', HOME: path.join(tmp, 'home'), TMPDIR: path.join(tmp, 'tmp'), TEMP: path.join(tmp, 'tmp'), TMP: path.join(tmp, 'tmp'), LANG: 'C', NO_COLOR: '1', CI: '1'});
const permissie = (lees, schrijf) => ['--permission', ...lees.map(p => '--allow-fs-read=' + p), '--allow-fs-write=' + schrijf];

function draai(args, opts) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, {...opts, shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'});
    let uit = '', klaar = false;
    const neem = b => { uit = (uit + b.toString('utf8')).slice(-MAX_UIT); };
    child.stdout.on('data', neem); child.stderr.on('data', neem);
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }, opts.timeout);
    const einde = (code, signal, fout) => { if (klaar) return; klaar = true; clearTimeout(timer); resolve({code, signal, uit, fout}); };
    child.on('error', e => einde(null, null, e.message));
    child.on('close', (code, signal) => einde(code, signal, null));
  });
}
/** Toont aan dat een verbinding vanuit een kindproces onder dezelfde permissies geweigerd wordt. true alleen bij een aantoonbare weigering en geen enkele verbinding. */
export async function netwerkGeblokkeerd(tmp) {
  const dir = path.join(tmp, 'netproef'); fs.mkdirSync(dir, {recursive: true});
  const proef = path.join(dir, 'proef.mjs');
  fs.writeFileSync(proef, "import net from 'node:net';\ntry { const s = net.connect(Number(process.argv[2]), '127.0.0.1'); s.on('connect', () => { console.log('VERBONDEN'); process.exit(0); }); s.on('error', e => { console.log('FOUT ' + (e.code || e.message)); process.exit(0); }); }\ncatch (e) { console.log('GEWEIGERD ' + (e.code || e.message)); }\n");
  let verbindingen = 0;
  const server = net.createServer(s => { verbindingen++; s.destroy(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const r = await draai([...permissie([dir], dir), proef, String(server.address().port)], {cwd: dir, env: schoneEnv(tmp), timeout: 15000});
    await new Promise(r2 => setTimeout(r2, 50));
    const geweigerd = /ERR_ACCESS_DENIED/.test(r.uit) && !/VERBONDEN/.test(r.uit);
    return {ok: geweigerd && verbindingen === 0, uitvoer: r.uit.trim().slice(0, 300), verbindingen};
  } finally { server.close(); }
}
/**
 * Het permissiemodel van Node had een symlink-omzeiling (CVE-2025-55130), opgelost in 20.20.0, 22.22.0, 24.13.0 en 25.3.0 (beveiligingsrelease januari 2026).
 * Op een oudere versie weigert diagnose te starten. (Versielijst uit de release-aankondiging; niet op deze machine geverifieerd.)
 */
export function nodeVersieOk(v = process.versions.node) {
  const [ma, mi] = String(v).split('.').map(Number);
  if (ma >= 26) return true;
  const min = {25: 3, 24: 13, 22: 22, 20: 20}[ma];
  return min !== undefined && mi >= min;
}
/** Verwijdert alle symlinks uit de wegwerpkopie (diepte-eerst), zodat een testbestand niet via een gevolgde symlink buiten de kopie kan komen. */
function verwijderSymlinks(dir) {
  let n = 0;
  for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, d.name);
    if (d.isSymbolicLink()) { fs.unlinkSync(p); n++; } else if (d.isDirectory() && d.name !== '.git') n += verwijderSymlinks(p);
  }
  return n;
}
function staat(root) {
  const s = git(root, ['status', '--porcelain', '--untracked-files=all']);
  return crypto.createHash('sha256').update(String(trackedFingerprint(root)) + '\n' + (s.status === 0 ? s.stdout : 'status-fout')).digest('hex');
}
/** Draait één testbestand in een wegwerpkopie. Gooit bij een weigering; geeft anders het resultaat (ook bij een rode test). */
export async function diagnose(root, testRel, rev = 'HEAD', opts = {}) {
  const timeout = Math.min(Number(opts.timeoutMs) || 120000, MAX_TIMEOUT);
  if (!(typeof testRel === 'string' && TEST.test(testRel) && veiligPad(testRel))) throw new Error('cli diagnose accepteert precies één concreet *.test.mjs-bestand (geen map, suite, script of build; geen geheim pad).');
  if (!(typeof rev === 'string' && REV.test(rev) && !rev.includes(':'))) throw new Error('Ongeldige revisie voor cli diagnose: ' + String(rev).slice(0, 60));
  if (!nodeVersieOk()) throw new Error('cli diagnose geweigerd: Node ' + process.version + ' is ouder dan de versie waarin de symlink-omzeiling van het permissiemodel is opgelost.');
  const sha = git(root, ['rev-parse', '--verify', rev + '^{commit}']);
  if (sha.status !== 0) throw new Error('Onbekende revisie: ' + rev);
  // Alleen de huidige commit of een voorouder daarvan: geen testcode uit een vreemde branch zonder GO.
  if (git(root, ['merge-base', '--is-ancestor', sha.stdout.trim(), 'HEAD']).status !== 0) throw new Error('cli diagnose draait alleen op HEAD of een voorouder daarvan, niet op ' + rev + '.');
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae-diagnose-'))), wt = path.join(tmp, 'kopie');
  for (const d of ['home', 'tmp', 'netproef']) fs.mkdirSync(path.join(tmp, d), {recursive: true});
  const voor = staat(root);
  let gemaakt = false;
  try {
    const netwerk = await netwerkGeblokkeerd(tmp);
    if (!netwerk.ok) throw new Error('cli diagnose geweigerd: netwerkblokkade is op Node ' + process.version + ' niet aantoonbaar werkzaam (' + (netwerk.uitvoer || 'geen uitvoer') + ').');
    const w = git(root, ['worktree', 'add', '--detach', wt, sha.stdout.trim()]);
    if (w.status !== 0) throw new Error('Wegwerpkopie kon niet worden gemaakt: ' + String(w.stderr).slice(0, 200));
    gemaakt = true;
    const lijst = git(wt, ['ls-files', '-z']);
    let weggelaten = 0;
    for (const f of (lijst.stdout || '').split('\0').filter(Boolean)) if (secretPath(f)) { fs.rmSync(path.join(wt, ...f.split('/')), {force: true, recursive: true}); weggelaten++; }
    const symlinks = verwijderSymlinks(wt);
    if (!fs.existsSync(path.join(wt, ...testRel.split('/')))) throw new Error('Het testbestand bestaat niet in revisie ' + rev + ': ' + testRel);
    const start = Date.now();
    const r = await draai([...permissie([wt, tmp], tmp), '--test', '--test-isolation=none', testRel], {cwd: wt, env: schoneEnv(tmp), timeout});
    const na = staat(root);
    return {ok: r.code === 0, exit_code: r.code, timed_out: r.signal === 'SIGKILL' && Date.now() - start >= timeout - 50, duur_ms: Date.now() - start, test: testRel, revisie: rev, sha: sha.stdout.trim(), netwerk_geblokkeerd: true, geheimen_weggelaten: weggelaten, symlinks_verwijderd: symlinks, werkmap_ongewijzigd: voor === na, uitvoer: r.uit};
  } finally {
    if (gemaakt) git(root, ['worktree', 'remove', '--force', wt]);
    git(root, ['worktree', 'prune']);
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}
