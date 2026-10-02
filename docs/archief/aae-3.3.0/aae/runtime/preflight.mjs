/** Preflight vóór uitgebreid werk en deploy-detectie per project (merge naar een auto-deploy-branch valt onder de deploy-gate). */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {requireThat, safePath, atomicJson, now, readJson} from './core.mjs';

export const PROJECT_FILE = 'docs/aae/project.json';
const PROTECTED = /^(main|master|production|prod|release\/.*)$/;

/** Detecteert uit het project zelf of een branch automatisch naar productie gaat. Onbekend geldt als auto (veilige standaard). */
export function detectDeploy(root, branch = 'main') {
  const bewijs = []; let trigger = 'unknown';
  const base = fs.realpathSync(root);
  const heeft = p => fs.existsSync(path.join(base, p));
  if (heeft('vercel.json')) { bewijs.push('vercel.json aanwezig'); trigger = 'auto'; }
  if (heeft('.vercel/project.json')) { bewijs.push('.vercel/project.json aanwezig'); trigger = 'auto'; }
  if (heeft('netlify.toml')) { bewijs.push('netlify.toml aanwezig'); trigger = 'auto'; }
  const wf = path.join(base, '.github/workflows');
  if (fs.existsSync(wf)) {
    for (const f of fs.readdirSync(wf).filter(x => /\.ya?ml$/.test(x))) {
      const t = fs.readFileSync(path.join(wf, f), 'utf8');
      if (/deploy/i.test(t) && new RegExp('push:[\\s\\S]{0,200}' + branch).test(t)) { bewijs.push('workflow ' + f + ' deployt bij push naar ' + branch); trigger = 'auto'; }
    }
  }
  return {target: 'production', trigger, bewijs, bepaald: now()};
}
export function loadProject(root) { try { return readJson(root, PROJECT_FILE); } catch { return {version: 1, deploy: {branches: {}}}; } }
/** Een door een mens vastgelegd feit (trigger: manual|auto) wint van detectie. */
export function deployInfo(root, branch) {
  const p = loadProject(root);
  const b = p.deploy?.branches?.[branch];
  if (b && ['manual', 'auto'].includes(b.trigger) && b.bron === 'mens') return b;
  const d = detectDeploy(root, branch);
  return b && ['manual', 'auto'].includes(b.trigger) ? b : d;
}
export function recordDeploy(root, branch = 'main') {
  const p = loadProject(root);
  p.deploy ??= {branches: {}}; p.deploy.branches ??= {};
  const bestaand = p.deploy.branches[branch];
  if (!bestaand || bestaand.bron !== 'mens') p.deploy.branches[branch] = {...detectDeploy(root, branch), bron: 'detectie'};
  atomicJson(root, PROJECT_FILE, p);
  return p.deploy.branches[branch];
}

const defaultIo = {
  exec: (cmd, args, cwd) => { const r = spawnSync(cmd, args, {cwd, encoding: 'utf8', shell: false, timeout: 15000}); return {code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), error: r.error?.code || null}; },
  reach: async host => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 6000);
    try { const r = await fetch('https://' + host, {method: 'HEAD', signal: c.signal}); return {ok: true, status: r.status}; }
    catch (e) { return {ok: false, status: null, fout: String(e.cause?.code || e.name || e.message).slice(0, 80)}; }
    finally { clearTimeout(t); }
  },
  env: process.env
};
/**
 * Controleert vooraf wat het werk nodig heeft. Retourneert controles met status pass | fail | info.
 * Een fail met human:true kan alleen de gebruiker oplossen en wordt gebundeld gemeld.
 */
export async function runPreflight(root, c, io = {}) {
  const x = {...defaultIo, ...io}; const checks = [];
  const add = (name, status, detail, human = false, actie = null) => checks.push({name, status, detail, human, actie});
  add('node', Number(process.versions.node.split('.')[0]) >= 20 ? 'pass' : 'fail', process.version);
  const pf = c.plan.preflight || {};
  const git = x.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], root);
  if (git.code === 0) {
    const tak = git.out;
    const toegestaan = c.envelope.git.push.length ? c.envelope.git.push.includes(tak) : !PROTECTED.test(tak);
    add('git-branch', toegestaan ? 'pass' : 'fail', 'huidige branch: ' + tak + (toegestaan ? '' : ' (niet de afgesproken werkbranch)'), false, toegestaan ? null : 'Schakel naar een afgesproken werkbranch.');
  } else add('git-branch', 'info', 'geen git-repository of git niet beschikbaar');
  for (const t of pf.tools || []) { const r = x.exec(t, ['--version'], root); add('tool ' + t, r.code === 0 ? 'pass' : 'fail', r.code === 0 ? r.out.split('\n')[0] : 'niet beschikbaar'); }
  if (fs.existsSync(path.join(fs.realpathSync(root), 'package.json')) && !fs.existsSync(path.join(fs.realpathSync(root), 'node_modules'))) add('dependencies', 'info', 'node_modules ontbreekt');
  for (const h of pf.hosts || []) {
    const r = await x.reach(h);
    add('netwerk ' + h, r.ok ? 'pass' : 'fail', r.ok ? 'bereikbaar (HTTP ' + r.status + ')' : 'niet bereikbaar (' + r.fout + ')', !r.ok, r.ok ? null : 'Sta ' + h + ' toe in de netwerkinstellingen van de omgeving.');
  }
  for (const n of pf.env_names || []) { const bestaat = Boolean(x.env[n]); add('configuratie ' + n, bestaat ? 'pass' : 'fail', bestaat ? 'aanwezig (waarde niet getoond)' : 'ontbreekt', !bestaat, bestaat ? null : 'Voeg ' + n + ' toe aan de omgevingsinstellingen.'); }
  for (const f of pf.fixtures || []) {
    let ok = false; try { ok = fs.existsSync(safePath(root, f.path)); } catch { ok = false; }
    add('fixture ' + f.source, ok ? 'pass' : 'fail', ok ? 'bewaard in ' + f.path : 'probe eerst en bewaar bewijs in ' + f.path);
  }
  if (c.envelope.git.merge || c.envelope.git.deploy !== 'none') {
    const d = deployInfo(root, c.envelope.git.merge?.to || 'main');
    add('deploy ' + (c.envelope.git.merge?.to || 'main'), 'info', 'trigger: ' + d.trigger + (d.bewijs?.length ? ' (' + d.bewijs.join('; ') + ')' : ''));
  }
  return checks;
}
export function bundleActions(checks) {
  return checks.filter(x => x.status === 'fail' && x.human).map(x => x.actie).filter(Boolean);
}
