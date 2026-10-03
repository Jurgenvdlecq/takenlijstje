/**
 * AAE 3.4 - alleen-lezen git zonder GO, veilig voor geheimen: uitsluitend namen, hashes en statistiek (direct via Bash):
 *   status, log, diff/show met --stat|--name-only|--name-status|--numstat, ls-files, ls-tree --name-only, rev-parse (ook <rev>^{tree}), merge-base,
 *   branch (alleen tonen), cat-file -t|-s|-e.
 * De inhoud van bestanden lezen via git (diff, show <rev>:<pad>, cat-file -p, grep, blame) kan zonder GO niet: dat onderdeel is in AAE-V34-AF bewust
 * verwijderd. Binnen een werkpakket met GO kan het als gepland commando (cli run).
 */
import {spawnSync} from 'node:child_process';
import {secretPath} from './secrets.mjs';

const REV = /^(?![-:.])[A-Za-z0-9_.\/~^@-]{1,120}$/;
const REV_TREE = /^(?![-:.])[A-Za-z0-9_.\/~^@-]{1,120}\^\{(tree|commit)\}$/;
/** Een pad dat zonder GO gebruikt mag worden: relatief, zonder .., jokertekens of pathspec-magie, en geen geheim. */
export function veiligPad(p) {
  if (typeof p !== 'string' || !p.length || p.length > 300) return false;
  if (/^[-:\/~]/.test(p) || /[*?\[\]{}\\\0\s'"`$!#;&|<>()]/.test(p)) return false;
  if (p.replace(/\/+$/, '').split('/').some(s => s === '..' || s === '.' || s === '')) return false; // ook geen // (git normaliseert dat naar een ander pad dan het filter zag)
  return !secretPath(p.replace(/\/+$/, ''));
}
const isRev = t => REV.test(t) && !t.includes(':');
const vlag = (t, set) => set.includes(t);
const BREED_DIFF = ['--stat', '--name-only', '--name-status', '--numstat'];
const LOG_VLAG = ['--oneline', '--stat', '--name-only', '--name-status', '--numstat', '--decorate', '--no-decorate', '--reverse', '--first-parent', '--no-merges', '--merges', '--follow', '--all'];
/** Splitst argv in [vóór '--', paden]. Paden moeten veilig zijn. */
function splitsPaden(rest) {
  const i = rest.indexOf('--');
  if (i < 0) return {voor: rest, paden: []};
  return {voor: rest.slice(0, i), paden: rest.slice(i + 1)};
}
/** Mag dit argv zonder GO direct via Bash (alleen namen, hashes en statistiek)? Geeft true/false. */
export function breedLezen(argv, root = null) {
  if (!Array.isArray(argv) || argv[0] !== 'git' || argv.length < 2) return false;
  const [, sub, ...rest] = argv;
  const {voor, paden} = splitsPaden(rest);
  if (!paden.every(veiligPad)) return false;
  // git show/diff/log met een blob-hash tonen de inhoud van die blob, ook met --stat: alleen revisies die een commit, tag of tree zijn (vastgesteld met git, fail-closed).
  if (['show', 'diff', 'log', 'ls-tree'].includes(sub) && !voor.filter(isRev).every(t => geenBlob(root, t))) return false;
  if (sub === 'status') return voor.every(t => vlag(t, ['--porcelain', '--short', '--branch', '-s', '-b', '--untracked-files=all', '--untracked-files=no', '--untracked-files=normal']));
  if (sub === 'log') return voor.every(t => vlag(t, LOG_VLAG) || /^-n\d{1,5}$/.test(t) || /^--max-count=\d{1,5}$/.test(t) || /^--(format|pretty)=[%A-Za-z0-9,:|._-]{0,80}$/.test(t) || isRev(t));
  if (sub === 'diff' || sub === 'show') {
    if (!voor.some(t => BREED_DIFF.includes(t))) return false;
    return voor.every(t => vlag(t, [...BREED_DIFF, '--cached', '--staged', '--oneline', '--no-color']) || isRev(t));
  }
  if (sub === 'ls-files') return voor.every(t => vlag(t, ['--cached', '-c', '--others', '-o', '--modified', '-m', '--deleted', '-d', '--exclude-standard']));
  if (sub === 'ls-tree') return voor.includes('--name-only') && voor.every(t => vlag(t, ['--name-only', '-r', '-d', '-t']) || isRev(t)) && voor.filter(isRev).length <= 1;
  if (sub === 'rev-parse') return !paden.length && voor.every(t => vlag(t, ['--abbrev-ref', '--short', '--verify', '--show-toplevel', '--is-inside-work-tree']) || isRev(t) || REV_TREE.test(t));
  if (sub === 'merge-base') return !paden.length && voor.every(t => vlag(t, ['--is-ancestor']) || isRev(t)) && voor.filter(isRev).length >= 2;
  if (sub === 'branch') return !paden.length && voor.every(t => vlag(t, ['--show-current', '--list', '-a', '-r', '-v', '-vv'])); // nooit een naam: dat zou een branch maken of verwijderen
  if (sub === 'cat-file') return !paden.length && voor.length === 2 && vlag(voor[0], ['-t', '-s', '-e']) && (isRev(voor[1]) || REV_TREE.test(voor[1]));
  return false;
}

// Paden zijn altijd letterlijk (GIT_LITERAL_PATHSPECS).
const GIT_OPTS = {encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 16 * 1024 * 1024, env: {...process.env, GIT_LITERAL_PATHSPECS: '1'}};
const run = (root, args) => spawnSync('git', args, {cwd: root, ...GIT_OPTS});
/**
 * Wijst deze revisie (of elke kant van een bereik a..b / a...b), na het volledig uitpakken van tags, naar een commit of tree? Een (annotated) tag, ook een tag op een
 * tag, die uiteindelijk naar een blob wijst, telt dus als blob. Zonder projectmap of bij twijfel: nee. Gebruikt door de brede route en de blob-controle in cli run.
 */
export function geenBlob(root, rev) {
  if (!root) return false;
  const delen = rev.includes('..') ? rev.split(/\.\.\.?/) : [rev];
  return delen.every(d => { if (!d) return true; const r = run(root, ['cat-file', '-t', d + '^{}']); return r.status === 0 && ['commit', 'tree'].includes(String(r.stdout).trim()); });
}
