/** Alleen-lezen git-hulpfuncties voor de gates en de geheimencontrole. Geen shell; falen betekent "onbekend", nooit "veilig". */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

export function git(root, args) {
  const r = spawnSync('git', args, {cwd: root, encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 32 * 1024 * 1024});
  return {code: r.status, out: (r.stdout || '').replace(/\r?\n$/, ''), err: (r.stderr || '').trim()};
}
export function gitHead(root) { const r = git(root, ['rev-parse', '--verify', 'HEAD']); return r.code === 0 && /^[0-9a-f]{40,64}$/.test(r.out) ? r.out : null; }
export function refCommit(root, branch) { const r = git(root, ['rev-parse', '--verify', 'refs/heads/' + branch]); return r.code === 0 && /^[0-9a-f]{40,64}$/.test(r.out) ? r.out : null; }
/** Vingerafdruk van alle wijzigingen aan gevolgde bestanden (git diff HEAD). null = geen git-map of niet te bepalen. */
export function trackedFingerprint(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return null;
  const r = spawnSync('git', ['diff', 'HEAD', '--no-ext-diff'], {cwd: root, encoding: 'buffer', shell: false, timeout: 30000, maxBuffer: 64 * 1024 * 1024});
  return r.status === 0 ? crypto.createHash('sha256').update(r.stdout).digest('hex') : null;
}
/** De commit waar de gepushte werkbranch op de remote (lokaal bijgehouden als origin/<branch>) op staat; null als onbekend. */
export function remoteRefCommit(root, branch) { const r = git(root, ['rev-parse', '--verify', 'refs/remotes/origin/' + branch]); return r.code === 0 && /^[0-9a-f]{40,64}$/.test(r.out) ? r.out : null; }
/** Bestanden in commits die nog niet naar de remote zijn (origin/<branch>..HEAD, of alles als de branch nog niet bestaat). Falen is een fout, nooit "geen bestanden". */
export function unpushedFiles(root, branch) {
  const basis = remoteRefCommit(root, branch);
  const args = basis ? ['diff', '--name-only', '-z', '--diff-filter=ACMR', basis + '..HEAD'] : ['ls-tree', '-r', '--name-only', '-z', 'HEAD'];
  const r = spawnSync('git', args, {cwd: root, encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 32 * 1024 * 1024});
  if (r.status !== 0) throw new Error('Geheimencontrole bij push niet mogelijk: ' + String(r.stderr || r.error || 'time-out').slice(0, 120) + '.');
  return (r.stdout || '').split('\0').filter(Boolean);
}
/** Niet-vastgelegde wijzigingen (incl. ongevolgde bestanden die niet genegeerd worden) binnen de paden. */
export function dirtyPaths(root, paths) {
  if (!paths.length) return [];
  const r = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...paths]);
  return r.code === 0 ? r.out.split('\n').filter(Boolean).map(l => l.slice(3)) : ['(git status mislukt)'];
}
// Falen is hier nooit "geen bestanden": een commit zonder werkende geheimencontrole mag niet doorgaan.
export function candidateFiles(root, paths) {
  const r = spawnSync('git', ['ls-files', '-o', '-m', '--exclude-standard', '-z', '--', ...paths], {cwd: root, encoding: 'utf8', shell: false, timeout: 30000});
  if (r.status !== 0) throw new Error('Geheimencontrole niet mogelijk: git ls-files faalde (' + String(r.stderr || r.error || 'time-out').slice(0, 120) + ').');
  return (r.stdout || '').split('\0').filter(Boolean);
}
export function stagedFiles(root) {
  const r = spawnSync('git', ['diff', '--cached', '--name-only', '-z'], {cwd: root, encoding: 'utf8', shell: false, timeout: 30000});
  if (r.status !== 0) throw new Error('Geheimencontrole niet mogelijk: git diff --cached faalde (' + String(r.stderr || r.error || 'time-out').slice(0, 120) + ').');
  return (r.stdout || '').split('\0').filter(Boolean);
}

// Namen en inhoud die nooit in een commit horen. De inhoud van een treffer wordt nooit getoond of bewaard.
const SECRET_NAME = [/(^|\/)\.env(\.[^/]*)?$/, /\.(pem|key|p12|pfx|jks|keystore)$/i, /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/, /(^|\/)\.npmrc$/, /(^|\/)\.netrc$/, /(^|\/)credentials(\.json)?$/i, /service[-_]?account[^/]*\.json$/i];
const SECRET_OK = [/(^|\/)\.env\.example$/];
const SECRET_CONTENT = [
  [new RegExp('-----BEGIN [A-Z ]*PRIVATE ' + 'KEY-----'), 'privésleutel'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS-sleutel'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub-token'], [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/, 'GitHub-token'],
  [/\bsk-[A-Za-z0-9_-]{32,}\b/, 'API-sleutel'], [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack-token'],
  [/SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*['"]?[A-Za-z0-9._-]{20,}/, 'Supabase service-role-sleutel']
];
export function secretHits(root, files) {
  const hits = [];
  for (const f of files) {
    if (SECRET_NAME.some(re => re.test(f)) && !SECRET_OK.some(re => re.test(f))) { hits.push({path: f, reden: 'bestandsnaam van een geheim'}); continue; }
    try {
      const abs = path.join(root, ...f.split('/')), st = fs.lstatSync(abs);
      if (!st.isFile() || st.size > 1024 * 1024) continue;
      const tekst = fs.readFileSync(abs, 'utf8');
      const m = SECRET_CONTENT.find(([re]) => re.test(tekst));
      if (m) hits.push({path: f, reden: m[1]});
    } catch { /* verdwenen of onleesbaar: niets te controleren */ }
  }
  return hits;
}
