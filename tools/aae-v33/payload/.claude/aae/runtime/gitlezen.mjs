/**
 * AAE 3.4 - alleen-lezen git zonder GO, veilig voor geheimen.
 * Breed (namen, hashes en statistiek; direct via Bash): status, log, diff/show met --stat|--name-only|--name-status|--numstat, ls-files, ls-tree --name-only,
 *   rev-parse (ook <rev>^{tree}), merge-base, branch (alleen tonen), cat-file -t|-s|-e.
 * Inhoudelijk (alleen via `node .claude/aae/runtime/cli.mjs git ...`, met expliciete paden die door het geheimenfilter gaan en een scan van de uitvoer):
 *   diff <rev> [<rev>] -- <pad...>, show <rev>:<pad>, cat-file -p <rev>:<pad>, grep [vlaggen] -e <patroon> [<rev>] -- <pad...>, blame [<rev>] -- <pad>.
 * Mappen worden eerst uitgeschreven naar losse bestanden; elk geheim bestand valt daarbij weg. Uitvoer met een bekend geheimpatroon wordt geweigerd, niet ingekort.
 */
import {spawnSync} from 'node:child_process';
import {secretPath, secretContent} from './secrets.mjs';

const REV = /^(?![-:.])[A-Za-z0-9_.\/~^@-]{1,120}$/;
const REV_TREE = /^(?![-:.])[A-Za-z0-9_.\/~^@-]{1,120}\^\{(tree|commit)\}$/;
/** Een pad dat zonder GO gelezen mag worden: relatief, zonder .., jokertekens of pathspec-magie, en geen geheim. */
export function veiligPad(p) {
  if (typeof p !== 'string' || !p.length || p.length > 300) return false;
  if (/^[-:\/~]/.test(p) || /[*?\[\]{}\\\0\s'"`$!#;&|<>()]/.test(p)) return false;
  if (p.split('/').some(s => s === '..' || s === '.')) return false;
  return !secretPath(p.replace(/\/+$/, ''));
}
const isRev = t => REV.test(t) && !t.includes(':');
const vlag = (t, set) => set.includes(t);
const BREED_DIFF = ['--stat', '--name-only', '--name-status', '--numstat'];
const LOG_VLAG = ['--oneline', '--stat', '--name-only', '--name-status', '--numstat', '--decorate', '--no-decorate', '--reverse', '--first-parent', '--no-merges', '--merges', '--follow', '--all'];
/** Splitst argv in [vóór '--', paden]. Paden moeten veilig zijn. */
function splitsPaden(rest) {
  const i = rest.indexOf('--');
  if (i < 0) return {voor: rest, paden: [], metStreep: false};
  return {voor: rest.slice(0, i), paden: rest.slice(i + 1), metStreep: true};
}
/**
 * Mag dit argv zonder GO direct via Bash (alleen namen, hashes en statistiek)? Geeft true/false.
 * Inhoud tonen (diff zonder --stat, show <rev>:<pad>, cat-file -p, grep, blame) kan alleen via cli git.
 */
export function breedLezen(argv) {
  if (!Array.isArray(argv) || argv[0] !== 'git' || argv.length < 2) return false;
  const [, sub, ...rest] = argv;
  const {voor, paden} = splitsPaden(rest);
  if (!paden.every(veiligPad)) return false;
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

const GIT_OPTS = {encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 16 * 1024 * 1024};
const run = (root, args) => spawnSync('git', args, {cwd: root, ...GIT_OPTS});
/** Schrijft paden (bestanden of mappen) uit naar losse, niet-geheime bestanden voor de gegeven revisie (of de werkmap). */
function bestanden(root, rev, paden, gewijzigdTussen = null) {
  const args = gewijzigdTussen ? ['diff', '--name-only', '-z', ...gewijzigdTussen, '--', ...paden] : rev ? ['ls-tree', '-r', '--name-only', '-z', rev, '--', ...paden] : ['ls-files', '-z', '--', ...paden];
  const r = run(root, args);
  if (r.status !== 0) throw new Error('Bestanden konden niet worden bepaald: ' + String(r.stderr || '').slice(0, 160));
  const alle = (r.stdout || '').split('\0').filter(Boolean);
  const veilig = alle.filter(f => !secretPath(f));
  if (veilig.length > 500) throw new Error('Te veel bestanden (' + veilig.length + '); kies een kleiner pad.');
  return {veilig, weggelaten: alle.length - veilig.length};
}
/**
 * Voert een inhoudelijke alleen-lezen git-opdracht uit (cli git). Geeft {uitvoer, weggelaten} of gooit een fout met de reden.
 * De uitvoer wordt alleen teruggegeven als hij geen bekend geheimpatroon bevat.
 */
export function inhoudLezen(root, argv) {
  if (breedLezen(['git', ...argv])) return toon(run(root, argv), 0);
  const [sub, ...rest] = argv;
  const {voor, paden, metStreep} = splitsPaden(rest);
  const eis = (ok, reden) => { if (!ok) throw new Error(reden); };
  if (sub === 'show' || sub === 'cat-file') {
    const kale = sub === 'cat-file' ? (eis(voor.length === 2 && voor[0] === '-p', 'Gebruik: git cat-file -p <rev>:<pad> (een kale blob-hash wordt geweigerd: het pad is dan onbekend).'), voor[1]) : (eis(voor.length === 1, 'Gebruik: git show <rev>:<pad>.'), voor[0]);
    eis(!metStreep, 'Gebruik: git ' + sub + ' <rev>:<pad>.');
    const i = kale.indexOf(':'); eis(i > 0, 'Een pad is verplicht: <rev>:<pad> (een kale blob-hash of revisie zonder pad wordt geweigerd).');
    const rev = kale.slice(0, i), pad = kale.slice(i + 1);
    eis(isRev(rev) && veiligPad(pad), 'Revisie of pad niet toegestaan (geheim, jokerteken, .. of pathspec-magie): ' + kale);
    return toon(run(root, sub === 'show' ? ['show', '--no-ext-diff', '--no-textconv', rev + ':' + pad] : ['cat-file', '-p', rev + ':' + pad]), 0);
  }
  if (sub === 'diff') {
    eis(metStreep && paden.length > 0, 'Een inhoudelijke diff vraagt expliciete paden na --.');
    eis(paden.every(veiligPad), 'Een pad is niet toegestaan (geheim, jokerteken, .. of pathspec-magie).');
    const revs = voor.filter(t => t !== '--cached' && t !== '--staged');
    eis(revs.every(isRev) && revs.length <= 2 && voor.every(t => isRev(t) || t === '--cached' || t === '--staged'), 'Alleen revisies en --cached zijn toegestaan vóór --.');
    const lijst = bestanden(root, null, paden, [...voor]); // dezelfde vergelijking, alleen namen: zo valt elk geheim bestand weg vóór de inhoud wordt opgevraagd
    if (!lijst.veilig.length) return {uitvoer: '', weggelaten: lijst.weggelaten};
    return toon(run(root, ['diff', '--no-ext-diff', '--no-textconv', ...voor, '--', ...lijst.veilig]), lijst.weggelaten);
  }
  if (sub === 'grep') {
    eis(metStreep && paden.length > 0, 'git grep vraagt expliciete paden na -- (grep zonder pad wordt geweigerd).');
    eis(paden.every(veiligPad), 'Een pad is niet toegestaan (geheim, jokerteken, .. of pathspec-magie).');
    const ei = voor.indexOf('-e'); eis(ei >= 0 && voor[ei + 1], 'Gebruik: git grep [vlaggen] -e <patroon> [<rev>] -- <pad...>.');
    const vlaggen = voor.slice(0, ei), na = voor.slice(ei + 2);
    eis(vlaggen.every(t => ['-n', '-i', '-l', '-c', '-w', '-F', '-E', '-I', '--count', '--line-number', '--ignore-case', '--files-with-matches'].includes(t)) && na.length <= 1 && na.every(isRev), 'Vlag of revisie niet toegestaan in git grep.');
    const rev = na[0] || null, lijst = bestanden(root, rev, paden);
    if (!lijst.veilig.length) return {uitvoer: '', weggelaten: lijst.weggelaten};
    return toon(run(root, ['grep', ...vlaggen, '-e', voor[ei + 1], ...(rev ? [rev] : []), '--', ...lijst.veilig]), lijst.weggelaten, true);
  }
  if (sub === 'blame') {
    eis(metStreep && paden.length === 1 && veiligPad(paden[0]), 'Gebruik: git blame [<rev>] -- <pad> (één niet-geheim bestand).');
    eis(voor.length <= 1 && voor.every(isRev), 'Alleen één revisie is toegestaan vóór --.');
    return toon(run(root, ['blame', ...voor, '--', paden[0]]), 0);
  }
  throw new Error('Deze git-opdracht is zonder GO niet toegestaan (alleen diff/show/cat-file/grep/blame met veilige paden, of de brede opdrachten met --stat/--name-only).');
}
function toon(r, weggelaten, grepGeenTreffer = false) {
  if (grepGeenTreffer && r.status === 1) return {uitvoer: '', weggelaten};
  if (r.status !== 0) throw new Error('git faalde: ' + String(r.stderr || r.error || '').slice(0, 200));
  const soort = secretContent(r.stdout);
  if (soort) throw new Error('De uitvoer bevat een mogelijk geheim (' + soort + ') en wordt niet getoond.');
  return {uitvoer: r.stdout, weggelaten};
}
