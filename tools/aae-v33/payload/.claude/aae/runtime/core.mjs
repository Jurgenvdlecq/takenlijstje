/** AAE 3.3 - lokale werkstroombewaking, geen OS-beveiligingsgrens. Geen afhankelijkheden. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const VERSION = '3.3.0';
export const WORK = 'docs/aae/work';
export const STATE_DIR = '.claude/aae/state';
export const ROLES = ['aae-product-partner', 'aae-architect', 'aae-reviewer'];
export const FOCI = ['code', 'security', 'ux', 'data', 'tests', 'visual', 'performance', 'accessibility', 'plan'];
export const CLASSES = ['LIGHT', 'STANDARD', 'HIGH'];
export const RISK_CHECKS = {
  ui: ['visual', 'accessibility'],
  authorization: ['authorization-positive', 'authorization-negative', 'tenant-isolation'],
  migration: ['migration', 'rollback', 'data-preservation'],
  financial: ['calculations', 'rounding'],
  sensitive_data: ['data-handling'],
  background_jobs: ['idempotency', 'retry'],
  external_effects: ['failure-handling']
};
export const HIGH_FLAGS = ['authorization', 'financial', 'sensitive_data'];
export const PURPOSES = ['read', 'test', 'build', 'preview', 'commit', 'push', 'merge', 'deploy', 'install', 'destructive'];
export const LOCAL = ['read', 'test', 'build', 'preview'];
export const SUPABASE_TOOLS_ALL = ['get_project_url', 'list_tables', 'list_extensions', 'list_migrations', 'query_logs', 'get_advisors', 'generate_typescript_types', 'search_docs', 'execute_sql', 'apply_migration'];
export const GITHUB_WRITE_TOOLS = ['create_pull_request', 'merge_pull_request'];
const CHECKS = new Set(['scope', 'functional', 'regression', 'analysis', ...Object.values(RISK_CHECKS).flat()]);
const DOCS = new Set(['docs/aae/PROJECT_PROFILE.md', 'docs/aae/PROGRESS.md', 'docs/aae/DECISIONS.md']);
const SKIP = new Set(['node_modules', '.git', '.claude', '.next', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__']);

export class GuardError extends Error { constructor(message) { super(message); this.name = 'GuardError'; } }
export const requireThat = (condition, message) => { if (!condition) throw new GuardError(message); };
export const sha = x => crypto.createHash('sha256').update(x).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => sha(stable(value));
export const now = () => new Date().toISOString();
export const clock = {ms: () => Date.now()};

// ---- validatie-hulpjes ----
export function keys(obj, allowed, required, label) {
  requireThat(obj && typeof obj === 'object' && !Array.isArray(obj), label + ' moet een object zijn.');
  for (const key of Object.keys(obj)) requireThat(allowed.includes(key), label + ': onbekend veld ' + key);
  for (const key of required) requireThat(Object.hasOwn(obj, key), label + ': ontbrekend veld ' + key);
}
export const text = (x, name, max = 2000) => {
  requireThat(typeof x === 'string' && x.trim().length >= 3 && x.length <= max && !/[\x00-\x08]/.test(x), name + ': geef concrete tekst.');
  requireThat(!/^(TODO|TBD|VUL IN|PLACEHOLDER|\.\.\.|<.*>)$/i.test(x.trim()), name + ': sjabloon is niet ingevuld.');
};
export const number = (x, min, max, name) => requireThat(Number.isInteger(x) && x >= min && x <= max, name + ': verwacht geheel getal ' + min + '..' + max);
export const choice = (x, values, name) => requireThat(values.includes(x), name + ': ongeldige waarde ' + String(x));
export const array = (x, min, max, name) => requireThat(Array.isArray(x) && x.length >= min && x.length <= max, name + ': verwacht lijst met ' + min + '..' + max + ' items');
export const identifier = (x, name) => requireThat(typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(x), name + ': gebruik een korte unieke code');

// ---- paden ----
export function relName(value) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length < 1024, 'Ongeldig bestandspad.');
  requireThat(!/[\\\x00-\x1f*?\[\]{}:]/.test(value) && !value.startsWith('/') && !value.startsWith('~'), 'Pad moet relatief, exact en zonder glob zijn: ' + value);
  const p = value.replace(/\/$/, '');
  requireThat(p && p.split('/').every(s => s !== '.' && s !== '..' && s !== ''), 'Onveilig pad: ' + value);
  // Windows/macOS: afsluitende punt of spatie en 8.3-korte namen kunnen een beschermd pad aanduiden.
  requireThat(p.split('/').every(s => !/[. ]$/.test(s) && !/~\d/.test(s)), 'Onveilig pad (afsluitende punt/spatie of korte naam): ' + value);
  return p;
}
export function protectedPath(p) {
  const l = p.toLowerCase(); // hoofdletterongevoelige bestandssystemen (macOS, Windows)
  return l === 'claude.md' || l.startsWith('.claude/') || l === '.claude' || l === '.git' || l.startsWith('.git/') || l === '.gitignore' || l.startsWith('.aae-backups/') ||
    l.split('/').some(s => /^\.env(?:\.|$)/.test(s) && s !== '.env.example') || l.startsWith('docs/aae/') || l === 'docs/aae';
}
export function controlDocument(p) {
  return DOCS.has(p) || /^docs\/aae\/notes\/[A-Za-z0-9_-]+\.md$/.test(p) || /^docs\/aae\/work\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\/(proposal|result)\.json$/.test(p);
}
/**
 * Eén simpele regel. 'tracked': projectbesluiten in gevolgde bestanden (PROGRESS, DECISIONS, PROJECT_PROFILE): alleen onder een GO.
 * 'technical': lokale genegeerde administratie (notities, resultaat en het voorstel proposal.json van een werkpakket): vrij, tenzij het bestand
 * in deze repository toch gevolgd wordt (dan GO). De duurzame, gevolgde snapshots (approved/) en contract.json schrijft alleen de runtime, nooit het model.
 */
export function controlKind(p) {
  if (DOCS.has(p)) return 'tracked';
  if (controlDocument(p)) return 'technical';
  return null;
}
/** Wordt dit bestand door git gevolgd? Geen git-map: nee. Git-map maar git faalt: ja (veilig kant). */
export function isTracked(root, p) {
  if (!fs.existsSync(path.join(fs.realpathSync(root), '.git'))) return false;
  const r = spawnSync('git', ['ls-files', '--error-unmatch', '--', p], {cwd: root, encoding: 'utf8', timeout: 10000, windowsHide: true});
  // Status 1 = "pathspec did not match": niet gevolgd (taalonafhankelijk). Elke andere uitkomst (0 = gevolgd, 128/fout/timeout) geldt als gevolgd.
  return r.error || r.status === null ? true : r.status !== 1;
}
/** Gevolgde bestanden onder een pad. Geen git-map: geen. Git faalt: onbekend, dus als gevolgd behandelen (fout=true). */
export function trackedUnder(root, rel) {
  if (!fs.existsSync(path.join(fs.realpathSync(root), '.git'))) return {bestanden: [], fout: false};
  const r = spawnSync('git', ['ls-files', '-z', '--', rel], {cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true});
  if (r.error || r.status !== 0) return {bestanden: [], fout: true};
  return {bestanden: (r.stdout || '').split('\0').filter(Boolean), fout: false};
}
/** Staat dit bestand in de laatste commit (HEAD) én is het sindsdien niet gewijzigd? Geen git-map: onbekend (null). */
export function committedInHead(root, rel) {
  if (!fs.existsSync(path.join(fs.realpathSync(root), '.git'))) return null;
  const inHead = spawnSync('git', ['cat-file', '-e', 'HEAD:' + rel], {cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true});
  if (inHead.error || inHead.status !== 0) return false;
  const schoon = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', rel], {cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true});
  return !schoon.error && schoon.status === 0;
}
export function workIdFromPath(p) { const m = /^docs\/aae\/work\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})\/(proposal|result)\.json$/.exec(p); return m ? {id: m[1], kind: m[2]} : null; }
/** Reject symlinks in every existing path component, including symlinked parents. */
export function safePath(root, relative, {allowMissing = true} = {}) {
  const p = relName(relative), base = fs.realpathSync(root);
  let cursor = base;
  for (const part of p.split('/')) {
    cursor = path.join(cursor, part);
    try { const st = fs.lstatSync(cursor); requireThat(!st.isSymbolicLink(), 'Symbolische link niet toegestaan in bewaakt pad: ' + p); }
    catch (e) { if (e.code === 'ENOENT' && allowMissing) continue; throw e; }
  }
  requireThat(cursor.startsWith(base + path.sep), 'Pad buiten project.');
  return cursor;
}
export function relativeInput(root, absolute, cwd = root) {
  requireThat(typeof absolute === 'string' && absolute.length > 0, 'Bestandspad ontbreekt.');
  const target = path.resolve(cwd, absolute), base = fs.realpathSync(root);
  const rel = path.relative(base, target).split(path.sep).join('/');
  return relName(rel);
}
export function readJson(root, p) { return JSON.parse(fs.readFileSync(safePath(root, p, {allowMissing: false}), 'utf8')); }
export function atomicJson(root, p, value) {
  const file = safePath(root, p);
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const tmp = file + '.tmp-' + crypto.randomUUID();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  fs.renameSync(tmp, file);
}
export function atomicText(root, p, body) {
  const file = safePath(root, p);
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const tmp = file + '.tmp-' + crypto.randomUUID();
  fs.writeFileSync(tmp, body, {mode: 0o600, flag: 'wx'});
  fs.renameSync(tmp, file);
}
export function scopeContains(scope, p) { return scope.some(s => { s = relName(s); return s === p || p.startsWith(s + '/'); }); }

// ---- gebieden (envelop) ----
const SUPPORT = {
  tests: p => /^(tests|supabase\/tests)\//.test(p),
  lockfile: p => p === 'package-lock.json',
  types: p => p === 'src/types/database.ts',
  docs: p => p === 'docs/PROGRESS.md'
};
export const SUPPORT_KINDS = Object.keys(SUPPORT);
export const SUPPORT_ROOTS = {tests: ['tests', 'supabase/tests'], lockfile: ['package-lock.json'], types: ['src/types/database.ts'], docs: ['docs/PROGRESS.md']};
export const areaWrite = c => c.envelope.areas.flatMap(a => a.write);
/** Mag dit bestand zonder nieuwe goedkeuring worden geschreven? Binnen een gebiedspatroon of een vooraf goedgekeurde ondersteunende categorie van een gebied. */
export function areaAllows(c, p) {
  for (const a of c.envelope.areas) {
    if (scopeContains(a.write, p)) return true;
    for (const k of a.support || []) if (SUPPORT[k]?.(p)) return true;
  }
  return false;
}

// ---- risico en bewijs ----
export function requiredChecks(c) {
  const impl = c.envelope.phase === 'implementation';
  return [...new Set([...(impl ? ['scope', 'functional', 'regression'] : ['analysis']), ...c.risk_flags.flatMap(f => impl ? RISK_CHECKS[f] : [])])];
}
const LEVEL = {LIGHT: 0, STANDARD: 1, HIGH: 2};
export const level = x => LEVEL[x] ?? 9;
const DB_LEVEL = {none: 0, A: 1, B: 2, C: 3};
export const dbLevel = x => DB_LEVEL[x] ?? 9;
const DEPLOY_LEVEL = {none: 0, verify: 1, trigger: 2};

// ---- veilige lokale argv (uit v3.2: B1/B3/B6) ----
const nodeTestOperand = a => /\.(test|spec)\.[cm]?[jt]sx?$/.test(a.split('/').pop());
const SAFE_LOCAL_ARGV = [
  {prefix: ['node', '--test'], flags: [], operand: nodeTestOperand},
  {prefix: ['npx', 'vitest', 'run'], flags: []},
  {prefix: ['npx', 'tsc', '--noEmit'], flags: ['--pretty']},
  {prefix: ['npx', 'eslint'], flags: ['--max-warnings=0']},
  {prefix: ['npx', 'playwright', 'test'], flags: []},
  {prefix: ['git', 'status'], flags: ['--porcelain', '--short', '--branch']},
  // diff en show alleen als samenvatting (--stat of --name-only): zonder die vlag tonen ze bestandsinhoud, ook van een gevolgd .env.
  {prefix: ['git', 'diff'], flags: ['--stat', '--name-only', '--cached'], needsFlag: ['--stat', '--name-only']},
  {prefix: ['git', 'log'], flags: ['--oneline', '--stat'], pattern: /^(-n\d{1,4}|--max-count=\d{1,4})$/},
  {prefix: ['git', 'show'], flags: ['--stat', '--name-only'], needsFlag: ['--stat', '--name-only']},
  {prefix: ['git', 'rev-parse'], flags: ['--abbrev-ref', '--short']},
  {prefix: ['git', 'merge-base'], flags: ['--is-ancestor']}
];
const SAFE_OPERAND = /^(?![-\/])(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9_.\/@^~-]{1,200}$/;
export function safeLocalArgv(argv) {
  if (!Array.isArray(argv) || !argv.every(a => typeof a === 'string')) return false;
  const rule = SAFE_LOCAL_ARGV.find(r => argv.length >= r.prefix.length && r.prefix.every((x, i) => argv[i] === x));
  if (!rule) return false;
  if (rule.operand && argv.length === rule.prefix.length) return false; // B6: node --test zonder concreet testbestand scant mappen
  if (rule.needsFlag && !argv.some(a => rule.needsFlag.includes(a))) return false;
  return argv.slice(rule.prefix.length).every(a => rule.flags.includes(a) || Boolean(rule.pattern?.test(a)) || SAFE_OPERAND.test(a) && (!rule.operand || rule.operand(a)));
}
/** Shell-metatekens: een Bash-opdracht met een van deze tekens wordt nooit als argv geaccepteerd. */
export const SHELL_META = /[;&|<>$`(){}\n\r\\'"*?\[\]~!#]/;
export function bashArgv(command) {
  const s = String(command || '').trim();
  if (!s || SHELL_META.test(s)) return null;
  return s.split(/\s+/);
}

// ---- git-regels per capability ----
const BRANCH_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,200}$/;
const PROTECTED_BRANCH = /^(main|master|production|prod|release\/.*)$/i;
/** Een gewone branchnaam: geen HEAD-achtige verwijzing, geen refs/-voorvoegsel, geen git-revisiesyntaxis, niet beschermd. */
export const branchName = b => typeof b === 'string' && BRANCH_SHAPE.test(b) && !/^(HEAD|FETCH_HEAD|ORIG_HEAD|MERGE_HEAD|CHERRY_PICK_HEAD)$/i.test(b) && !/^(refs|heads|tags|remotes)\//i.test(b) && !b.includes('..') && !b.includes('//') && !/(\.lock|\/|\.)$/.test(b) && !/@\{/.test(b);
const BRANCH = {test: branchName};
const sameArgv = (a, b) => stable(a) === stable(b);
export function addAllowed(c, p) {
  try { p = relName(p); } catch { return false; }
  return areaAllows(c, p) || scopeContains(areaWrite(c), p) || p === 'docs/aae/PROGRESS.md' || p === 'docs/aae/work/' + c.id || p.startsWith('docs/aae/work/' + c.id + '/');
}
function gitCommitOk(c, argv) {
  if (argv[1] === 'add') {
    return argv[2] === '-A' && argv[3] === '--' && argv.length >= 5 && argv.slice(4).every(p => addAllowed(c, p));
  }
  if (argv[1] === 'commit') {
    const rest = argv.slice(2);
    return rest.length >= 2 && rest.length % 2 === 0 && rest.every((x, i) => i % 2 === 0 ? x === '-m' : typeof x === 'string' && x.length > 0 && x.length < 4000);
  }
  return false;
}
function gitPushOk(c, argv) {
  let rest = argv.slice(2);
  if (rest[0] === '-u' || rest[0] === '--set-upstream') rest = rest.slice(1);
  if (rest.length !== 2 || rest[0] !== 'origin') return false;
  const b = rest[1];
  return BRANCH.test(b) && !PROTECTED_BRANCH.test(b) && c.envelope.git.push.includes(b);
}
function gitMergeOk(c, argv) {
  const m = c.envelope.git.merge;
  if (!m || argv.length !== 4 || argv[1] !== 'push' || argv[2] !== 'origin') return false;
  const x = /^([^:+]+):([^:+]+)$/.exec(argv[3]);
  return Boolean(x) && BRANCH.test(x[1]) && c.envelope.git.push.includes(x[1]) && x[2] === m.to && BRANCH.test(x[2]);
}
// ---- inhoudelijke commandocontrole voor extra commando's (voor elk doel gelijk) ----
// Programma's die publiceren, uitrollen, samenvoegen, de database of het netwerk raken: nooit een extra commando, ook niet met doel install of destructive.
// Dat loopt uitsluitend via de eigen capabilities (git push/merge, providertools) en hun gates; het doel-label wijzigt dit nooit.
const FORBIDDEN_PROGRAMS = new Set(['gh', 'hub', 'glab', 'curl', 'wget', 'http', 'https', 'xh', 'ssh', 'scp', 'sftp', 'ftp', 'rsync', 'nc', 'ncat', 'netcat', 'socat', 'telnet', 'docker', 'docker-compose', 'podman', 'kubectl', 'helm', 'terraform', 'pulumi', 'ansible', 'ansible-playbook',
  'vercel', 'netlify', 'supabase', 'aws', 'az', 'gcloud', 'gsutil', 'bq', 'doctl', 'flyctl', 'fly', 'heroku', 'railway', 'render', 'wrangler', 'firebase', 'serverless', 'sls', 'sam', 'amplify', 'eas', 'psql', 'pg_dump', 'pg_restore', 'mysql', 'mysqldump', 'mongosh', 'mongo', 'redis-cli', 'sqlcmd']);
// Wrappers en indirecte uitvoering: ze starten een ander programma zonder dat de controle het ziet (env git push …, sh script.sh, xargs curl).
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'csh', 'tcsh', 'fish', 'ash', 'busybox', 'pwsh', 'powershell', 'cmd', 'wsl', 'start']);
const WRAPPERS = new Set(['env', 'xargs', 'sudo', 'doas', 'su', 'nohup', 'nice', 'ionice', 'timeout', 'time', 'stdbuf', 'command', 'exec', 'setsid', 'watch', 'flock', 'chroot', 'unshare', 'nsenter', 'strace', 'ltrace', 'script', 'parallel', 'at', 'batch', 'eval', 'source', 'taskset', 'chrt', 'runuser', 'caffeinate', 'builtin', 'xdg-open', 'open',
  'awk', 'gawk', 'mawk', 'nawk']); // awk draagt zijn programma als gewoon argument (BEGIN{system(…)}): niet te onderscheiden van een bestand, dus nooit toegestaan
const INTERPRETERS = new Set(['node', 'nodejs', 'deno', 'bun', 'python', 'python3', 'py', 'ruby', 'perl', 'php', 'lua', 'osascript']);
const CODE_FLAGS = /^(-e|-E|--eval|-p|--print|-c|-C|-r|--require|--import|--loader|--experimental-loader|-x|-)$/;
// Een codevlag ook als --eval=code of als gecombineerde korte vlaggen (-pe, -Sc): de vlag vóór een "=" telt, en een cluster van letters met e, E, p, c, C, r of x is een codevlag.
const codeVlag = a => CODE_FLAGS.test(a.split('=')[0]) || (/^-[A-Za-z]{2,6}$/.test(a) && /[eEpcCrx]/.test(a));
const PYTHON_MODULES = new Set(['pip', 'venv', 'pytest', 'unittest', 'compileall']);
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'npx', 'pnpx', 'bunx', 'corepack']);
const PM_INSTALL = new Set(['install', 'i', 'ci', 'add', 'remove', 'rm', 'uninstall', 'update', 'upgrade', 'up', 'rebuild', 'dedupe', 'prune']);
const PM_RUN = new Set(['run', 'run-script', 'test', 'start', 't', 'tst', 'build']);
const PM_INFO = new Set(['ls', 'list', 'outdated', 'audit', 'why', 'explain', 'view', 'info', 'pack', 'help', 'version', '-v', '--version']);
const PM_INDIRECT = new Set(['exec', 'x', 'dlx', 'create', 'init', 'link', 'unlink', 'config', 'set', 'get', 'login', 'logout', 'adduser', 'whoami', 'token', 'access', 'owner', 'team', 'org', 'profile', 'dist-tag', 'deprecate', 'unpublish', 'publish', 'deploy', 'release', 'cache', 'explore']);
const RISKY_SCRIPT = /(publish|deploy|release|ship|upload|push|migrat|prod|rollout|provision|db[:_-]|sync[:_-]remote|merge)/i; // een scriptnaam die op uitrollen wijst; de inhoud van projectscripts blijft projectcode (geen sandbox)
const PUBLISH_WORDS = /^(publish|deploy|release|login|adduser|unpublish|dist-tag|token)$/i;
const GIT_VIA_CAPABILITY = new Set(['push', 'commit', 'merge', 'tag', 'rebase', 'cherry-pick', 'am', 'apply', 'remote', 'config', 'fetch', 'pull', 'update-ref', 'send-pack', 'bundle', 'notes', 'revert']);
const GIT_EXTRA_OK = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'ls-tree', 'branch', 'checkout', 'switch', 'restore', 'reset', 'clean', 'stash', 'rm', 'mv']);
const GIT_DANGEROUS_ARG = /^(-c|--config|--config-env|--exec-path|--upload-pack|--receive-pack|--exec|--ext-diff|--textconv|--output|--git-dir|--work-tree|-C|--namespace)(=|$)/;
const programName = a => String(a || '').split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
const firstNonFlag = a => a.find(x => !String(x).startsWith('-'));
/**
 * Waarom een extra commando niet is toegestaan (null = toegestaan als het in de envelop staat). Dezelfde inhoudelijke controle voor elk doel
 * (read, test, build, preview, install, destructive); merge en deploy accepteren helemaal geen extra commando's: samenvoegen en uitrollen
 * lopen uitsluitend via hun eigen capabilities en gates. Een doel-label verandert nooit wat een programma kan.
 */
export function extraRefusal(argv, purpose) {
  if (!Array.isArray(argv) || !argv.length || !argv.every(a => typeof a === 'string' && a.length)) return 'Een commando heeft een leeg of ongeldig argument.';
  if (['merge', 'deploy'].includes(purpose)) return 'Doel ' + purpose + ' accepteert geen extra commando\'s: samenvoegen en uitrollen lopen uitsluitend via hun eigen capabilities en gates (git push/merge-capability, deploy-capability, providertools).';
  if (['commit', 'push'].includes(purpose)) return 'Commit en push lopen nooit via een extra commando (' + purpose + ').';
  const prog = programName(argv[0]);
  if (/[\\/]/.test(argv[0])) return 'Een commando met een pad (' + argv[0] + ') kan een willekeurig script zijn; gebruik de programmanaam (bijvoorbeeld node scripts/x.mjs) zodat de controle het kan beoordelen.';
  if (FORBIDDEN_PROGRAMS.has(prog)) return prog + ' publiceert, rolt uit, raakt de database of gebruikt het netwerk en is nooit een extra commando (ook niet met doel ' + purpose + '): dat loopt uitsluitend via de eigen capabilities en gates.';
  if (SHELLS.has(prog) || WRAPPERS.has(prog)) return prog + ' start indirect een ander programma en omzeilt daarmee de controle: niet toegestaan als commando (' + purpose + ').';
  if (prog === 'find' && argv.some(a => /^-(exec|execdir|ok|okdir)$/.test(a))) return 'find met -exec/-execdir/-ok start indirect een ander programma: niet toegestaan.';
  if (prog === 'git') {
    // Publiceren, vastleggen en samenvoegen alleen via de capabilities en hun gate; verder een vaste lijst zonder configuratie- of aliasingang.
    const a = argv.slice(1); let i = 0;
    while (i < a.length && a[i].startsWith('-')) { if (!/^(--no-pager|-P)$/.test(a[i])) return 'git-opties vóór het subcommando (' + a[i] + ') zijn niet toegestaan: ze kunnen configuratie of uitvoerbare hulpprogramma\'s binnenhalen.'; i++; }
    const sub = String(a[i] || '').toLowerCase();
    if (!sub || GIT_VIA_CAPABILITY.has(sub)) return 'git ' + (sub || '') + ' loopt nooit via een extra commando (ook niet met doel ' + purpose + '): commit, push en merge alleen via de capabilities en hun gate.';
    if (!GIT_EXTRA_OK.has(sub)) return 'git ' + sub + ' staat niet op de lijst van toegestane git-handelingen voor een extra commando (een onbekend subcommando kan een alias of extern programma zijn).';
    if (a.slice(i + 1).some(x => GIT_DANGEROUS_ARG.test(x))) return 'git-argument niet toegestaan (configuratie, extern hulpprogramma of uitvoerbestand).';
    if (LOCAL.includes(purpose)) return 'git ' + sub + ' is geen lokaal extra commando (' + purpose + ').';
    return null;
  }
  const rest = argv.slice(1);
  if (INTERPRETERS.has(prog) && prog !== 'bun') {
    const eerste = rest.findIndex(a => !a.startsWith('-') || a === '-'), opties = eerste < 0 ? rest : rest.slice(0, eerste + 1); // alleen de opties vóór het scriptbestand tellen; argumenten van het script zelf niet
    if (opties.some(codeVlag)) return prog + ' met een codevlag (-e/-c/--eval/-p/-r/…) voert willekeurige code uit buiten de controle.';
    if (prog === 'deno' && ['eval', 'repl', 'install', 'upgrade', 'publish', 'deploy'].includes(rest[0])) return 'deno ' + rest[0] + ' voert willekeurige code uit of publiceert en loopt niet via een extra commando.';
    if ((prog === 'deno' ? rest : opties).some(a => /^[a-z][a-z0-9+.-]*:\/\//i.test(a))) return prog + ' met een URL als argument haalt code van het netwerk en loopt niet via een extra commando.';
    if (/^python/.test(prog) || prog === 'py') { const mi = rest.indexOf('-m'); if (mi >= 0 && !PYTHON_MODULES.has(rest[mi + 1])) return 'python -m met een onbekende module kan alles starten.'; }
  }
  if (PACKAGE_MANAGERS.has(prog)) {
    if (['npx', 'pnpx', 'bunx'].includes(prog)) return prog + ' start willekeurige pakketten buiten de controle (alleen de vaste testprogramma\'s npx vitest/playwright/eslint/tsc staan op de lijst).';
    if (rest.some(a => FORBIDDEN_PROGRAMS.has(programName(a)))) return 'publiceren of uitrollen via ' + prog + ' loopt niet via een extra commando.';
    const sub = String(firstNonFlag(rest) || '').toLowerCase();
    if (!sub) return prog + ' zonder subcommando is niet toegestaan.';
    if (PM_INDIRECT.has(sub) || PUBLISH_WORDS.test(sub)) return prog + ' ' + sub + ' publiceert, rolt uit of start indirect andere pakketten en is nooit een extra commando (' + purpose + ').';
    if (prog === 'bun' && sub === 'x') return 'bun x start willekeurige pakketten.';
    if (PM_INSTALL.has(sub)) return purpose === 'install' ? null : prog + ' ' + sub + ' installeert pakketten en hoort bij doel install (niet ' + purpose + ').';
    if (PM_RUN.has(sub)) {
      const script = sub === 'run' || sub === 'run-script' ? rest.slice(rest.indexOf(sub) + 1).find(x => !x.startsWith('-')) : sub;
      if (RISKY_SCRIPT.test(String(script || ''))) return 'Het script ' + script + ' wijst op publiceren of uitrollen en loopt niet via een extra commando.';
      return null;
    }
    if (PM_INFO.has(sub)) return null;
    return prog + ' ' + sub + ' staat niet op de lijst van toegestane pakketbeheer-handelingen.';
  }
  if (['make', 'just', 'task', 'gmake'].includes(prog)) { const t = firstNonFlag(rest); if (RISKY_SCRIPT.test(String(t || ''))) return prog + ' ' + t + ' wijst op publiceren of uitrollen en loopt niet via een extra commando.'; }
  if (['pip', 'pip3'].includes(prog) && ['install', 'uninstall'].includes(rest[0]) && purpose !== 'install') return 'pip ' + rest[0] + ' installeert pakketten en hoort bij doel install (niet ' + purpose + ').';
  return null;
}
/** Voert dit extra commando willekeurige code uit (interpreter met -e/-c)? Alleen voor de zichtbaarheid in het voorstel. */
export const runsArbitraryCode = argv => {
  const prog = programName(argv[0]);
  return (['node', 'nodejs', 'deno', 'bun'].includes(prog) && argv.slice(1).some(a => /^(-e|--eval|-p|--print)$/.test(a))) || (['python', 'python3', 'sh', 'bash', 'zsh', 'pwsh', 'powershell', 'cmd', 'ruby', 'perl'].includes(prog) && argv.slice(1).some(a => /^(-c|-e|-Command|\/c)$/i.test(a)));
};
/** Classificeert een commando tegen de envelop. ok=false betekent: niet toegestaan binnen deze GO. */
/** Een GO-vrije analyse voert uitsluitend alleen-lezen git uit (status/log/diff/show met --stat of --name-only, rev-parse, merge-base): nooit projectcode zoals node --test, vitest, playwright, eslint of tsc. */
export const analysisArgv = argv => Array.isArray(argv) && argv[0] === 'git' && safeLocalArgv(argv);
export function classifyCommand(c, cmd) {
  const argv = cmd.argv, purpose = cmd.purpose;
  const extra = (c.envelope.extra_commands || []).some(x => x.purpose === purpose && sameArgv(x.argv, argv));
  // Vooraf geweigerd, niet achteraf ontdekt: een analyse zonder GO mag geen projectcode starten (die kan gevolgde bestanden schrijven).
  if (c.envelope.phase === 'analysis' && !(purpose === 'read' && analysisArgv(argv))) return {ok: false, reason: 'Een analyse zonder GO voert alleen alleen-lezen git-commando\'s uit (status, log, diff of show met --stat of --name-only, rev-parse, merge-base); geen tests, eslint, tsc of ander projectprogramma: dat kan gevolgde bestanden schrijven.'};
  if (LOCAL.includes(purpose)) {
    if (safeLocalArgv(argv)) return {ok: true, kind: 'lokaal'};
    if (!extra) return {ok: false, reason: 'Lokaal commando staat niet op de toegestane lijst en niet in de goedgekeurde extra commando\'s.'};
    const nee = extraRefusal(argv, purpose); return nee ? {ok: false, reason: nee} : {ok: true, kind: 'extra'};
  }
  if (purpose === 'commit') {
    if (argv[0] !== 'git' || !c.envelope.git.commit) return {ok: false, reason: 'Commit is niet toegestaan in deze envelop.'};
    return gitCommitOk(c, argv) ? {ok: true, kind: 'git-commit'} : {ok: false, reason: 'Alleen git add -A -- <toegestane paden> en git commit -m <tekst> zijn toegestaan.'};
  }
  if (purpose === 'push') {
    if (argv[0] !== 'git' || argv[1] !== 'push') return {ok: false, reason: 'Alleen git push naar een afgesproken werkbranch.'};
    return gitPushOk(c, argv) ? {ok: true, kind: 'git-push'} : {ok: false, reason: 'Push alleen naar een branch uit envelop.git.push, nooit naar main, zonder force of refspec.'};
  }
  if (purpose === 'merge') {
    // Samenvoegen loopt uitsluitend via de merge-capability (git push origin <werkbranch>:<doelbranch>) en haar gate; nooit via een extra commando.
    return argv[0] === 'git' && gitMergeOk(c, argv) ? {ok: true, kind: 'git-merge'} : {ok: false, reason: 'Merge alleen als git push origin <werkbranch>:<doelbranch> met een doel uit envelop.git.merge; merge accepteert geen extra commando\'s.'};
  }
  if (purpose === 'deploy') return {ok: false, reason: 'Een los deploy-commando bestaat niet: uitrollen loopt uitsluitend via de deploy-capability en de gate (bijvoorbeeld via de merge naar een automatisch uitrollende branch), nooit via een extra commando.'};
  if (purpose === 'install' || purpose === 'destructive') {
    if (!extra) return {ok: false, reason: purpose + '-commando moet exact in de goedgekeurde extra commando\'s staan.'};
    const nee = extraRefusal(argv, purpose); return nee ? {ok: false, reason: nee} : {ok: true, kind: 'extra'};
  }
  return {ok: false, reason: 'Onbekend doel ' + purpose};
}

// ---- contract (schema 4) ----
export function validateProviders(p, c) {
  keys(p, ['supabase', 'github'], [], 'Providers');
  if (p.supabase) {
    const x = p.supabase;
    keys(x, ['project_ref', 'tools', 'max_calls'], ['project_ref', 'tools', 'max_calls'], 'Supabase');
    requireThat(typeof x.project_ref === 'string' && /^[a-z0-9][a-z0-9-]{4,63}$/i.test(x.project_ref), 'Supabase project_ref is ongeldig.');
    array(x.tools, 1, SUPABASE_TOOLS_ALL.length, 'Supabase-tools');
    requireThat(new Set(x.tools).size === x.tools.length, 'Dubbele Supabase-tool.');
    for (const t of x.tools) choice(t, SUPABASE_TOOLS_ALL, 'Supabase-tool');
    number(x.max_calls, 1, 60, 'Supabase-aanroepen');
    if (x.tools.includes('apply_migration')) requireThat(dbLevel(c.envelope.db_max) >= 1, 'apply_migration vereist envelop.db_max A of B.');
  }
  if (p.github) {
    const x = p.github;
    keys(x, ['tools', 'max_calls', 'base', 'head', 'owner', 'repo'], ['tools', 'max_calls', 'owner', 'repo', 'head'], 'GitHub');
    for (const k of ['owner', 'repo']) requireThat(typeof x[k] === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(x[k]), 'GitHub ' + k + ' is verplicht en moet een gewone naam zijn.');
    requireThat(typeof x.head === 'string' && BRANCH.test(x.head) && (c.envelope.git.push || []).includes(x.head), 'GitHub head is verplicht en moet een werkbranch uit envelop.git.push zijn.');
    array(x.tools, 1, GITHUB_WRITE_TOOLS.length, 'GitHub-tools');
    requireThat(new Set(x.tools).size === x.tools.length, 'Dubbele GitHub-tool.');
    for (const t of x.tools) choice(t, GITHUB_WRITE_TOOLS, 'GitHub-tool');
    number(x.max_calls, 1, 10, 'GitHub-aanroepen');
    if (Object.hasOwn(x, 'base')) requireThat(typeof x.base === 'string' && BRANCH.test(x.base), 'GitHub base ongeldig.');
    if (Object.hasOwn(x, 'head')) requireThat(typeof x.head === 'string' && BRANCH.test(x.head), 'GitHub head ongeldig.');
    if (x.tools.includes('merge_pull_request')) requireThat(Boolean(c.envelope.git.merge), 'merge_pull_request vereist envelop.git.merge.');
  }
}
/** Preflight voert alleen bekende programma's met --version uit en bevraagt alleen gewone hostnamen; nooit een pad of vrije opdracht. */
export const PREFLIGHT_TOOLS = ['node', 'npm', 'npx', 'git', 'supabase', 'psql', 'deno', 'python3', 'pnpm', 'yarn'];
export function validatePreflight(pf) {
  keys(pf, ['tools', 'hosts', 'env_names', 'fixtures'], [], 'Preflight');
  pf.tools ??= []; pf.hosts ??= []; pf.env_names ??= []; pf.fixtures ??= [];
  array(pf.tools, 0, 10, 'Preflight-programma\'s'); for (const t of pf.tools) requireThat(PREFLIGHT_TOOLS.includes(t), 'Preflight-programma niet toegestaan: ' + String(t));
  array(pf.hosts, 0, 10, 'Preflight-hosts'); for (const h of pf.hosts) requireThat(typeof h === 'string' && /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(h), 'Preflight-host is geen gewone hostnaam: ' + String(h));
  array(pf.env_names, 0, 20, 'Preflight-configuratienamen'); for (const n of pf.env_names) requireThat(typeof n === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(n), 'Preflight-configuratienaam ongeldig: ' + String(n));
  array(pf.fixtures, 0, 10, 'Preflight-fixtures'); for (const f of pf.fixtures) { keys(f, ['source', 'path'], ['source', 'path'], 'Preflight-fixture'); text(f.source, 'Fixturebron', 120); relName(f.path); }
}
export function validateContract(c) {
  keys(c, ['schema_version', 'id', 'title', 'goal', 'risk_class', 'risk_flags', 'envelope', 'plan'], ['schema_version', 'id', 'title', 'goal', 'risk_class', 'risk_flags', 'envelope', 'plan'], 'Contract');
  requireThat(c.schema_version === 4, 'Contract vereist schema_version 4.');
  identifier(c.id, 'Werkpakket-ID'); text(c.title, 'Titel', 200); text(c.goal, 'Doel');
  choice(c.risk_class, CLASSES, 'Risicoklasse');
  array(c.risk_flags, 0, 7, 'Risicovlaggen');
  requireThat(new Set(c.risk_flags).size === c.risk_flags.length, 'Dubbele risicovlag');
  for (const f of c.risk_flags) choice(f, Object.keys(RISK_CHECKS), 'Risicovlag');
  if (c.risk_flags.some(f => HIGH_FLAGS.includes(f))) requireThat(c.risk_class === 'HIGH', 'Autorisatie, financieel of gevoelige gegevens vereisen risicoklasse HIGH.');
  const e = c.envelope;
  keys(e, ['phase', 'areas', 'db_max', 'providers', 'git', 'budgets', 'acceptance', 'assumptions', 'decision_defaults', 'decision_points', 'extra_commands'], ['phase', 'areas', 'git', 'budgets', 'acceptance'], 'Envelop');
  choice(e.phase, ['analysis', 'implementation'], 'Fase');
  e.db_max ??= 'none'; e.providers ??= {}; e.assumptions ??= []; e.decision_defaults ??= []; e.decision_points ??= []; e.extra_commands ??= [];
  array(e.decision_points, 0, 8, 'Beslisgrenzen'); for (const t of e.decision_points) text(t, 'Beslisgrens', 300);
  requireThat(new Set(e.decision_points).size === e.decision_points.length, 'Dubbele beslisgrens');
  choice(e.db_max, ['none', 'A', 'B'], 'DB-maximum');
  array(e.areas, 0, 12, 'Gebieden');
  for (const a of e.areas) {
    keys(a, ['name', 'write', 'support'], ['name', 'write'], 'Gebied');
    text(a.name, 'Gebiedsnaam', 120);
    array(a.write, 1, 20, 'Schrijfpatronen');
    for (const p of a.write) requireThat(!protectedPath(relName(p)), 'Systeembestanden/administratie horen niet in een gebied: ' + p);
    a.support ??= [];
    array(a.support, 0, 4, 'Ondersteunende categorieën');
    for (const k of a.support) choice(k, SUPPORT_KINDS, 'Ondersteunende categorie');
  }
  const mutatingGit = e.git && (e.git.commit || (e.git.push || []).length || e.git.merge);
  if (e.phase === 'analysis') {
    requireThat(e.areas.length === 0, 'Analyse mag geen schrijfgebieden hebben.');
    requireThat(!mutatingGit && e.db_max === 'none', 'Analyse mag geen git-schrijfacties of databasewijzigingen bevatten.');
  } else requireThat(e.areas.length > 0 || mutatingGit || e.db_max !== 'none', 'Implementatie vereist een gebied of een expliciete externe wijziging.');
  keys(e.git, ['commit', 'push', 'merge', 'deploy'], ['commit', 'push', 'merge', 'deploy'], 'Git');
  requireThat(typeof e.git.commit === 'boolean', 'git.commit moet een boolean zijn.');
  array(e.git.push, 0, 4, 'Pushbranches');
  for (const b of e.git.push) requireThat(typeof b === 'string' && BRANCH.test(b) && !PROTECTED_BRANCH.test(b), 'Pushbranch ongeldig of beschermd: ' + b);
  if (e.git.push.length) requireThat(e.git.commit, 'push vereist commit.');
  if (e.git.merge !== null) { keys(e.git.merge, ['to'], ['to'], 'Merge'); requireThat(typeof e.git.merge.to === 'string' && BRANCH.test(e.git.merge.to), 'Merge-doel ongeldig.'); requireThat(e.git.push.length > 0, 'merge vereist een pushbranch.'); }
  choice(e.git.deploy, ['none', 'verify', 'trigger'], 'Deploy');
  keys(e.budgets, ['agent_calls', 'command_runs', 'external_calls', 'max_parallel'], ['agent_calls', 'command_runs'], 'Budget');
  keys(e.budgets.agent_calls, ['soft', 'hard'], ['soft', 'hard'], 'Agentbudget');
  number(e.budgets.agent_calls.hard, 0, 12, 'Agentbudget hard'); number(e.budgets.agent_calls.soft, 0, e.budgets.agent_calls.hard, 'Agentbudget soft');
  number(e.budgets.command_runs, 0, 200, 'Commandobudget');
  e.budgets.external_calls ??= 0; e.budgets.max_parallel ??= 2;
  number(e.budgets.external_calls, 0, 60, 'Extern toolbudget'); number(e.budgets.max_parallel, 1, 3, 'Parallelisme');
  validateProviders(e.providers, c);
  const ext = (e.providers.supabase?.max_calls || 0) + (e.providers.github?.max_calls || 0);
  requireThat(e.budgets.external_calls >= ext, 'Extern toolbudget kleiner dan providerlimieten.');
  array(e.acceptance, 1, 12, 'Acceptatiecriteria');
  for (const a of e.acceptance) { keys(a, ['id', 'text'], ['id', 'text'], 'Acceptatiecriterium'); identifier(a.id, 'Criterium-ID'); text(a.text, 'Criterium'); }
  requireThat(new Set(e.acceptance.map(a => a.id)).size === e.acceptance.length, 'Dubbele criterium-ID');
  array(e.assumptions, 0, 8, 'Aannames'); for (const t of e.assumptions) text(t, 'Aanname', 300);
  array(e.decision_defaults, 0, 8, 'Beslisstandaarden'); for (const t of e.decision_defaults) text(t, 'Beslisstandaard', 300);
  array(e.extra_commands, 0, 10, 'Extra commando\'s');
  for (const x of e.extra_commands) {
    keys(x, ['argv', 'purpose'], ['argv', 'purpose'], 'Extra commando'); array(x.argv, 1, 40, 'Argumenten'); choice(x.purpose, PURPOSES, 'Doel');
    // Dezelfde inhoudelijke controle voor elk doel, al bij de envelop zelf (niet pas als een plan-commando ernaar verwijst); merge en deploy accepteren geen extra commando's.
    const nee = extraRefusal(x.argv, x.purpose); requireThat(!nee, 'Extra commando ' + x.argv.join(' ').slice(0, 80) + ' (' + x.purpose + ') is niet toegestaan: ' + nee);
  }
  if (e.phase === 'analysis') requireThat(e.extra_commands.length === 0, 'Een analyse heeft geen extra commando\'s: ze zou projectcode kunnen starten zonder GO.');
  const p = c.plan;
  keys(p, ['test_plan', 'agents', 'commands', 'read', 'open_product_questions', 'keep_raw', 'preflight'], ['test_plan'], 'Plan');
  p.agents ??= []; p.commands ??= []; p.read ??= []; p.open_product_questions ??= []; p.keep_raw ??= false;
  if (p.preflight !== undefined) validatePreflight(p.preflight);
  array(p.read, 0, 30, 'Leesscope'); for (const x of p.read) relName(x);
  array(p.test_plan, 1, 24, 'Bewijsplan');
  for (const t of p.test_plan) { keys(t, ['kind', 'method', 'description'], ['kind', 'method', 'description'], 'Bewijsplan'); choice(t.kind, [...CHECKS], 'Controle'); choice(t.method, ['command', 'inspection', 'manual'], 'Bewijsmethode'); text(t.description, 'Bewijsomschrijving'); }
  requireThat(new Set(p.test_plan.map(t => t.kind)).size === p.test_plan.length, 'Dubbele controle in bewijsplan.');
  for (const k of requiredChecks(c)) requireThat(p.test_plan.some(t => t.kind === k), 'Ontbrekende kwaliteitsondergrens: ' + k);
  array(p.agents, 0, 8, 'Agents');
  for (const a of p.agents) {
    keys(a, ['name', 'focus', 'question', 'files', 'model'], ['name', 'question', 'files'], 'Agent');
    choice(a.name, ROLES, 'Agentnaam'); if (a.focus) choice(a.focus, FOCI, 'Focus'); text(a.question, 'Agentvraag');
    array(a.files, 0, 20, 'Agentbestanden'); for (const f of a.files) relName(f);
    if (a.model) choice(a.model, ['haiku', 'sonnet', 'opus', 'fable'], 'Modelalias');
  }
  array(p.commands, 0, 30, 'Commando\'s');
  for (const m of p.commands) {
    keys(m, ['id', 'argv', 'purpose', 'why', 'watch', 'timeout_ms', 'max_runs'], ['id', 'argv', 'purpose', 'why', 'watch', 'timeout_ms', 'max_runs'], 'Commando');
    identifier(m.id, 'Commando-ID'); array(m.argv, 1, 40, 'Argumenten');
    for (const arg of m.argv) requireThat(typeof arg === 'string' && arg.length < 8000 && !arg.includes('\0'), 'Ongeldig commandoargument');
    requireThat(m.argv[0].length > 0 && !/[\r\n]/.test(m.argv[0]), 'Executable ontbreekt');
    choice(m.purpose, PURPOSES, 'Commandodoel'); text(m.why, 'Commandoreden');
    array(m.watch, 0, 30, 'Commandobronnen'); for (const w of m.watch) relName(w);
    number(m.timeout_ms, 1000, 300000, 'Timeout');
    number(m.max_runs, 1, ['install', 'destructive', 'merge', 'deploy'].includes(m.purpose) ? 1 : 30, 'Aantal uitvoeringen');
    if (e.phase === 'analysis') requireThat(m.purpose === 'read', 'Analyse staat alleen leescommando\'s toe (geen tests: projectcode kan gevolgde bestanden schrijven).');
    const k = classifyCommand(c, m);
    requireThat(k.ok, 'Commando ' + m.id + ' valt buiten de envelop: ' + k.reason);
  }
  requireThat(new Set(p.commands.map(m => m.id)).size === p.commands.length, 'Dubbel commando-ID');
  array(p.open_product_questions, 0, 8, 'Openstaande productvragen'); for (const q of p.open_product_questions) text(q, 'Productvraag', 400);
  requireThat(typeof p.keep_raw === 'boolean', 'plan.keep_raw moet een boolean zijn.');
  requireThat(Buffer.byteLength(JSON.stringify(c)) < 64000, 'Contract is te groot; splits het werkpakket.');
  return c;
}
const norm = s => String(s).normalize('NFC').replace(/\s+/g, ' ').trim();
const uniqSorted = a => [...new Set(a)].sort();
/**
 * Canonieke envelop: alleen wat de gebruiker goedkeurt. Zet verzamelingen op volgorde, normaliseert witruimte en laat weg wat geen
 * goedkeuring is: titel, gebiedsnamen, zachte budgetten, plan (agents, commando's, leesscope, testbeschrijvingen) en aannames.
 * Doel, ID, fase, acceptatie, schrijfgebieden, risico, DB-maximum, providers, git/merge/deploy, harde budgetten en beslisgrenzen tellen wel mee.
 */
export function envelopeOf(c) {
  const e = c.envelope, pv = {};
  for (const k of ['supabase', 'github']) if (e.providers?.[k]) pv[k] = {...e.providers[k], tools: uniqSorted(e.providers[k].tools)};
  return {
    id: c.id, goal: norm(c.goal), phase: e.phase, risk_class: c.risk_class, risk_flags: uniqSorted(c.risk_flags),
    acceptance: e.acceptance.map(a => ({id: a.id, text: norm(a.text)})).sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
    write: uniqSorted(e.areas.flatMap(a => a.write)), support: uniqSorted(e.areas.flatMap(a => a.support || [])),
    db_max: e.db_max ?? 'none', providers: pv,
    git: {commit: e.git.commit, push: uniqSorted(e.git.push), merge: e.git.merge ? {to: e.git.merge.to} : null, deploy: e.git.deploy},
    budgets: {agent_calls_hard: e.budgets.agent_calls.hard, command_runs: e.budgets.command_runs, external_calls: e.budgets.external_calls ?? 0, max_parallel: e.budgets.max_parallel ?? 2},
    decision_points: uniqSorted((e.decision_points || []).map(norm)), decision_defaults: uniqSorted((e.decision_defaults || []).map(norm)),
    extra_commands: (e.extra_commands || []).map(x => stable({argv: x.argv, purpose: x.purpose})).sort()
  };
}
export const envelopeHash = c => digest(envelopeOf(c));
/** Korte herkenning voor de gebruiker; intern telt alleen de volledige hash. */
/** De korte hash is alleen ter herkenning voor de gebruiker; 12 hextekens (48 bits) maken een per ongeluk of opzettelijk gelijke korte hash praktisch onmogelijk. Intern bindt alleen de volledige hash. */
export const SHORT_HASH_LENGTH = 12;
export const shortHash = h => String(h).slice(0, SHORT_HASH_LENGTH);
const sub = (a, b) => a.every(x => b.includes(x));
const sameSet = (a, b) => sub(a, b) && sub(b, a);
/**
 * Waarom een nieuw contract buiten het eerder goedgekeurde contract valt. Lege lijst = binnen de envelop.
 * Wat de gebruiker goedkeurde (gebieden, risico, database, providers, git, budgetten, criteria, bewijsvloer) mag niet breder of lichter
 * worden. Agents en commando's zijn plan en vrij, mits de commandoklassen kloppen (dat checkt validateContract).
 */
export function materialChanges(a, n) {
  const why = [], ea = a.envelope, en = n.envelope;
  if (n.id !== a.id) why.push('werkpakket-ID');
  if (norm(n.goal) !== norm(a.goal)) why.push('doel');
  if (en.phase !== ea.phase) why.push('fase');
  if (level(n.risk_class) < level(a.risk_class)) why.push('risicoklasse lager (bewijs lichter)');
  if (level(n.risk_class) > level(a.risk_class)) why.push('risicoklasse hoger');
  if (!sub(a.risk_flags, n.risk_flags)) why.push('risicovlaggen');
  if (!sub(n.risk_flags, a.risk_flags)) why.push('risicovlaggen uitgebreid');
  for (const ar of en.areas) for (const w of ar.write) if (!scopeContains(ea.areas.flatMap(x => x.write), relName(w))) why.push('schrijfgebied ' + w);
  const oudeSteun = new Set(ea.areas.flatMap(x => x.support || []));
  for (const ar of en.areas) for (const k of ar.support || []) if (!oudeSteun.has(k)) why.push('ondersteunende categorie ' + k);
  if (dbLevel(en.db_max) > dbLevel(ea.db_max)) why.push('database-klasse');
  for (const prov of ['supabase', 'github']) {
    const pa = ea.providers[prov], pn = en.providers[prov];
    if (pn && (!pa || !sub(pn.tools, pa.tools) || pn.max_calls > pa.max_calls || (prov === 'supabase' && pn.project_ref !== pa.project_ref) || (prov === 'github' && ((pn.base ?? null) !== (pa.base ?? null) || (pn.head ?? null) !== (pa.head ?? null) || (pn.owner ?? null) !== (pa.owner ?? null) || (pn.repo ?? null) !== (pa.repo ?? null))))) why.push('provider ' + prov);
  }
  if (en.git.commit && !ea.git.commit) why.push('git commit');
  if (!sub(en.git.push, ea.git.push)) why.push('git push');
  if (en.git.merge && (!ea.git.merge || ea.git.merge.to !== en.git.merge.to)) why.push('git merge');
  if (!en.git.merge && ea.git.merge) why.push('merge-gate verdwenen');
  if ((DEPLOY_LEVEL[en.git.deploy] ?? 9) > (DEPLOY_LEVEL[ea.git.deploy] ?? 0)) why.push('deploy');
  if (!sub(en.extra_commands.map(x => stable(x)), ea.extra_commands.map(x => stable(x)))) why.push('extra commando\'s');
  const ba = ea.budgets, bn = en.budgets;
  if (bn.agent_calls.hard > ba.agent_calls.hard || bn.command_runs > ba.command_runs || bn.external_calls > ba.external_calls || bn.max_parallel > ba.max_parallel) why.push('budget');
  if (!ea.acceptance.every(x => en.acceptance.some(y => y.id === x.id && y.text === x.text))) why.push('acceptatiecriteria');
  if (!sub(en.assumptions, ea.assumptions)) why.push('nieuwe aannames');
  if (!sub(en.decision_defaults, ea.decision_defaults)) why.push('nieuwe beslisstandaarden');
  if (!sub(ea.decision_points || [], en.decision_points || [])) why.push('beslisgrenzen');
  // Bewijsvloer (B2): soort, methode én omschrijving van de goedgekeurde controles blijven minstens gelijk; bewijs wordt nooit stil lichter.
  if (!a.plan.test_plan.every(x => n.plan.test_plan.some(y => y.kind === x.kind && y.method === x.method && y.description === x.description))) why.push('bewijsplan');
  return [...new Set(why)];
}
/** Commando's die buiten de allowlist vallen, moeten exact in extra_commands staan; goedgekeurde fingerprint voor niet-lokale doelen. */
export function commandRefs(root, c) {
  const automatic = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'Cargo.lock', 'Makefile', 'justfile'];
  return [...new Set([...automatic, ...c.watch])].sort().map(p => {
    const f = safePath(root, p); if (!fs.existsSync(f)) return [p, 'absent'];
    const st = fs.statSync(f); requireThat(st.isFile() && st.size < 20 * 1024 * 1024, 'Commando-watch moet een normaal, klein bestand zijn: ' + p);
    return [p, sha(fs.readFileSync(f))];
  });
}
export const commandFingerprint = (root, m) => digest({argv: m.argv, purpose: m.purpose, timeout_ms: m.timeout_ms, refs: commandRefs(root, m)});
export function sourceDigest(root, c) {
  const found = new Map(); let bytes = 0;
  function visit(p) {
    // .claude telt alleen op het hoogste niveau als systeemmap over te slaan; een geneste .claude (bijvoorbeeld een pakket-payload) is gewone bron.
    if (p === 'docs/aae' || p.startsWith('docs/aae/') || p.split('/').some((s, i) => SKIP.has(s) && (s !== '.claude' || i === 0))) return;
    const f = safePath(root, p); let st;
    try { st = fs.lstatSync(f); } catch (e) { if (e.code === 'ENOENT') { found.set(p, 'absent'); return; } throw e; }
    if (st.isDirectory()) { for (const n of fs.readdirSync(f).sort()) visit(p + '/' + n); }
    else if (st.isFile()) {
      bytes += st.size; requireThat(bytes < 64 * 1024 * 1024 && found.size < 3000, 'Scope-fingerprint te groot. Kies gerichtere bronpaden.');
      found.set(p, sha(fs.readFileSync(f)));
    }
  }
  // Ook de vooraf goedgekeurde ondersteunende categorieën (tests, lockfile, types, docs) tellen mee: een wijziging daar is een bronwijziging.
  const steun = c.envelope.areas.flatMap(a => (a.support || []).flatMap(k => SUPPORT_ROOTS[k] || []));
  for (const p of [...areaWrite(c), ...c.plan.read, ...steun]) visit(relName(p));
  return digest([...found.entries()].sort(([x], [y]) => x.localeCompare(y)));
}
