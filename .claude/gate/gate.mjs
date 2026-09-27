#!/usr/bin/env node
// Design Freeze-poort voor Claude Code.
// Aangeroepen door hooks in .claude/settings.json:
//   node gate.mjs pretool   (PreToolUse)        -> blokkeert schrijfacties (exit 2)
//   node gate.mjs prompt    (UserPromptSubmit / UserPromptExpansion) -> registreert /design-go, /niveau, /onderhoud-go
//   node gate.mjs session   (SessionStart)      -> injecteert projectstatus als context
//   node gate.mjs config    (ConfigChange)      -> voorkomt uitschakelen van hooks
//   node gate.mjs status                        -> leesbare status (handmatig)
// Geen externe afhankelijkheden. Zie .claude/werkwijze-subagents.md, sectie "Technische poort".

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MODE = process.argv[2] || "status";
const PROJECT = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const CONFIG_PATH = path.join(PROJECT, ".claude/gate/gate.config.json");
const STATE_PATH = path.join(PROJECT, ".claude/state/gate.json");
const CAPABILITY_PATH = path.join(PROJECT, ".claude/state/visual-capability.json");
const GENERATED = ["node_modules/**", ".next/**", "dist/**", "build/**", "out/**", "coverage/**", ".turbo/**", ".vercel/**", "test-results/**", "playwright-report/**", ".cache/**"];

// ---------- hulpfuncties ----------
function readStdin() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}
function parseJSON(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}
function readConfig() {
  const cfg = parseJSON(fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, "utf8") : "", null);
  if (!cfg) {
    // Zonder geldige config faalt de poort gesloten: liever blokkeren dan stil openstaan.
    deny("Poortconfiguratie .claude/gate/gate.config.json ontbreekt of is ongeldig. Schrijven naar productiecode is geblokkeerd tot Jurgen dit herstelt (/onderhoud-go).");
  }
  return cfg;
}
function readState() {
  return parseJSON(fs.existsSync(STATE_PATH) ? fs.readFileSync(STATE_PATH, "utf8") : "", {}) || {};
}
function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}
function sha256(file) {
  try { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); } catch { return null; }
}
function nowIso() { return new Date().toISOString(); }

const globCache = new Map();
function globToRegex(glob) {
  if (globCache.has(glob)) return globCache.get(glob);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  const rx = new RegExp("^" + re + "$");
  globCache.set(glob, rx);
  return rx;
}
function matchesAny(rel, globs) {
  return (globs || []).some((g) => globToRegex(g).test(rel));
}
// Een doel is ook "raak" als het een bovenliggende map van een beschermd pad is (bijv. rm -rf .claude).
function isAncestorOfAny(rel, globs) {
  const prefix = rel.replace(/\/+$/, "") + "/";
  return (globs || []).some((g) => {
    const root = g.split(/[*?]/)[0].replace(/\/+$/, "");
    return rel === "." || rel === "" || (root + "/").startsWith(prefix);
  });
}
function toRel(p, cwd) {
  if (!p) return null;
  let s = String(p).replace(/^["']|["']$/g, "");
  if (s.startsWith("~")) return { outside: true, abs: s };
  const abs = path.resolve(cwd || PROJECT, s);
  const rel = path.relative(PROJECT, abs).split(path.sep).join("/");
  if (rel.startsWith("..") || path.isAbsolute(rel)) return { outside: true, abs };
  return { outside: false, rel: rel === "" ? "." : rel, abs };
}

function isTmp(abs, input) {
  const a = String(abs);
  return a.startsWith("/tmp/") || (input.scratchpad_dir && a.startsWith(input.scratchpad_dir));
}
function isGlobRoot(rel, globs) {
  return (globs || []).some((g) => g.split(/[*?]/)[0].replace(/\/+$/, "") === rel);
}
function deny(message) {
  process.stderr.write(`POORT: ${message}\n`);
  process.exit(2);
}
function allow() { process.exit(0); }

// ---------- niveau en freeze ----------
function detectSignals(cfg) {
  const found = [];
  const sig = cfg.niveauSignalen || {};
  for (const g of sig.bestanden || []) {
    const root = g.split(/[*?]/)[0];
    if (g.includes("*")) {
      const dir = path.join(PROJECT, root);
      if (fs.existsSync(dir)) found.push(g);
    } else if (fs.existsSync(path.join(PROJECT, g))) found.push(g);
  }
  const pkg = parseJSON(fs.existsSync(path.join(PROJECT, "package.json")) ? fs.readFileSync(path.join(PROJECT, "package.json"), "utf8") : "", null);
  if (pkg) {
    const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    for (const p of sig.pakketten || []) {
      if (deps.some((d) => (p.endsWith("/") ? d.startsWith(p) : d === p))) found.push(`pakket ${p}`);
    }
  }
  for (const envFile of [".env", ".env.local", ".env.example", ".env.production"]) {
    const f = path.join(PROJECT, envFile);
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, "utf8");
    for (const v of sig.omgevingsvariabelen || []) if (new RegExp("^\\s*" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "m").test(txt)) found.push(`${envFile}: ${v}`);
  }
  return [...new Set(found)];
}
function contentIntroducesSignals(cfg, relPath, content) {
  if (!content) return [];
  const sig = cfg.niveauSignalen || {};
  const hits = [];
  if (matchesAny(relPath, sig.bestanden)) hits.push(relPath);
  if (/(^|\/)package\.json$/.test(relPath)) {
    for (const p of sig.pakketten || []) {
      const needle = p.endsWith("/") ? `"${p}` : `"${p}"`;
      if (content.includes(needle)) hits.push(`pakket ${p}`);
    }
  }
  if (/(^|\/)\.env/.test(relPath)) for (const v of sig.omgevingsvariabelen || []) if (content.includes(v)) hits.push(v);
  return hits;
}
function isTemplate(txt) {
  return /<(naam|projectnaam|\.\.\.)>|Welk probleem lost dit op, voor wie, en hoe merk je/.test(txt);
}
function section(txt, head) {
  const i = txt.indexOf(head);
  if (i < 0) return "";
  const rest = txt.slice(i + head.length);
  const j = rest.search(/\n## /);
  return j < 0 ? rest : rest.slice(0, j);
}
function claimedLevel() {
  const f = path.join(PROJECT, "docs/PROGRESS.md");
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, "utf8").match(/Kwaliteitsniveau:\s*\**\s*([123])/i);
  return m ? Number(m[1]) : null;
}
function freezeIntegrity(state, cfg) {
  const fr = state.freeze;
  if (!fr || !fr.goedgekeurd) return { ok: false, reason: "geen Design Freeze" };
  const changed = [];
  for (const [rel, h] of Object.entries(fr.hashes || {})) {
    if (sha256(path.join(PROJECT, rel)) !== h) changed.push(rel);
  }
  for (const rel of cfg.bevrorenDocumenten || []) {
    if (!(rel in (fr.hashes || {})) && fs.existsSync(path.join(PROJECT, rel))) changed.push(`${rel} (nieuw na freeze)`);
  }
  if (changed.length) return { ok: false, reason: `bevroren ontwerpdocumenten zijn na de goedkeuring gewijzigd: ${changed.join(", ")}` };
  return { ok: true };
}
function level1Release(cfg, state, signals) {
  const userLevel = state.niveauJurgen?.niveau ?? null;
  if (userLevel && userLevel > 1) return { ok: false, reason: `Jurgen heeft niveau ${userLevel} vastgezet` };
  const cl = claimedLevel();
  if (cl && cl > 1) return { ok: false, reason: `docs/PROGRESS.md noemt niveau ${cl}` };
  if (userLevel !== 1 && signals.length) return { ok: false, reason: `niveau-2-signalen aanwezig (${signals.join(", ")})` };
  const relFile = cfg.niveau1Vrijgave || "docs/level1-release.json";
  const rel = parseJSON(fs.existsSync(path.join(PROJECT, relFile)) ? fs.readFileSync(path.join(PROJECT, relFile), "utf8") : "", null);
  if (!rel) return { ok: false, reason: `geen niveau-1-vrijgave (${relFile})` };
  if (rel.niveau !== 1 || rel.openVragen !== 0 || rel.persoonsgegevens !== false || !rel.gebruikers || String(rel.reden || "").length < 20)
    return { ok: false, reason: `${relFile} moet bevatten: {"niveau":1,"openVragen":0,"persoonsgegevens":false,"gebruikers":"...","reden":"onderbouwing van minstens één zin"}` };
  const spec = path.join(PROJECT, "docs/SPEC.md");
  if (!fs.existsSync(spec)) return { ok: false, reason: "docs/SPEC.md ontbreekt" };
  const txt = fs.readFileSync(spec, "utf8");
  const missing = ["## Doel", "## Visuele richting", "## Acceptatiecriteria"].filter((h) => !txt.includes(h));
  if (missing.length) return { ok: false, reason: `docs/SPEC.md mist verplichte secties: ${missing.join(", ")}` };
  if (isTemplate(txt)) return { ok: false, reason: "docs/SPEC.md is nog (deels) het lege sjabloon" };
  const visual = section(txt, "## Visuele richting");
  if ((visual.match(/^\s*-\s*[^:\n]+:\s*\S.{3,}/gm) || []).length < 3) return { ok: false, reason: "de visuele richting in docs/SPEC.md is niet ingevuld (minstens lettertype, kleuren en componenten)" };
  const ac = section(txt, "## Acceptatiecriteria");
  if (!/AC-\d+/.test(ac) || !/\bDAN\b/.test(ac) || /GEGEVEN …/.test(ac)) return { ok: false, reason: "docs/SPEC.md heeft nog geen ingevulde acceptatiecriteria (AC-nnn met GEGEVEN/WANNEER/DAN)" };
  return { ok: true };
}
function productionStatus(cfg, state) {
  const signals = detectSignals(cfg);
  const integ = freezeIntegrity(state, cfg);
  if (integ.ok) return { open: true, via: "freeze", level: state.freeze.niveau, signals };
  if (state.freeze?.goedgekeurd && !integ.ok) return { open: false, reason: `Design Freeze is ongeldig geworden: ${integ.reason}. Leg de wijziging vast als wijzigingsverzoek in docs/PROGRESS.md; Jurgen moet opnieuw /design-go geven.`, signals };
  const l1 = level1Release(cfg, state, signals);
  if (l1.ok) return { open: true, via: "niveau1", level: 1, signals };
  return { open: false, reason: `nog geen Design Freeze (${l1.reason}).`, signals };
}
function maintenanceActive(state) {
  return state.onderhoudTot && Date.parse(state.onderhoudTot) > Date.now();
}

// ---------- Bash-analyse ----------
function tokenize(cmd) {
  const tokens = [];
  let cur = "", q = null, i = 0, hasCur = false;
  const push = () => { if (hasCur) tokens.push({ t: "w", v: cur }); cur = ""; hasCur = false; };
  while (i < cmd.length) {
    const c = cmd[i];
    if (q) {
      if (c === q) { q = null; i++; continue; }
      if (c === "\\" && q === '"' && i + 1 < cmd.length) { cur += cmd[i + 1]; i += 2; continue; }
      cur += c; i++; continue;
    }
    if (c === "'" || c === '"') { q = c; hasCur = true; i++; continue; }
    if (c === "\\" && i + 1 < cmd.length) { cur += cmd[i + 1]; hasCur = true; i += 2; continue; }
    if (c === "\n" || c === ";") { push(); tokens.push({ t: "op", v: ";" }); i++; continue; }
    if (c === "&" && cmd[i + 1] === "&") { push(); tokens.push({ t: "op", v: "&&" }); i += 2; continue; }
    if (c === "|" && cmd[i + 1] === "|") { push(); tokens.push({ t: "op", v: "||" }); i += 2; continue; }
    if (c === "|") { push(); tokens.push({ t: "op", v: "|" }); i++; continue; }
    if (c === "&" && cmd[i + 1] === ">") { push(); tokens.push({ t: "redir", v: ">" }); i += cmd[i + 2] === ">" ? 3 : 2; continue; }
    if (c === "&") { push(); tokens.push({ t: "op", v: "&" }); i++; continue; }
    if (c === ">" || (/[0-9]/.test(c) && cmd[i + 1] === ">" && !hasCur)) {
      if (c !== ">") i++;
      push();
      let j = i + 1;
      if (cmd[j] === ">") j++;
      if (cmd[j] === "|") j++;
      if (cmd[j] === "&") { // >&2 e.d.: geen bestand
        j++; while (/[0-9-]/.test(cmd[j] || "")) j++;
        i = j; continue;
      }
      tokens.push({ t: "redir", v: ">" }); i = j; continue;
    }
    if (c === "<") { push(); i++; if (cmd[i] === "<") { i++; if (cmd[i] === "<") i++; } tokens.push({ t: "op", v: "<" }); continue; }
    if (c === " " || c === "\t") { push(); i++; continue; }
    cur += c; hasCur = true; i++;
  }
  push();
  return tokens;
}
function subshells(cmd) {
  const out = [];
  const rx = /\$\(([^()]*(?:\([^()]*\)[^()]*)*)\)|`([^`]*)`/g;
  let m;
  while ((m = rx.exec(cmd))) out.push(m[1] ?? m[2]);
  return out;
}
const WRAPPERS = new Set(["sudo", "time", "nice", "nohup", "env", "command", "exec", "xargs", "timeout", "stdbuf"]);
function analyzeBash(cmd, cwd) {
  // Resultaat: { targets: [pad...], unknownWrite: bool, flags: Set, notes: [] }
  const res = { targets: [], unknownWrite: false, flags: new Set(), notes: [], installs: [], execScripts: [] };
  const addT = (p) => { if (p && p !== "/dev/null" && !p.startsWith("/dev/")) res.targets.push(p); };
  const tokens = tokenize(cmd);
  // redirections
  for (let i = 0; i < tokens.length; i++) if (tokens[i].t === "redir" && tokens[i + 1]?.t === "w") addT(tokens[i + 1].v);
  // segmenten
  const segs = [[]];
  for (const tk of tokens) {
    if (tk.t === "op" && [";", "&&", "||", "|", "&"].includes(tk.v)) segs.push([]);
    else if (tk.t === "redir") segs[segs.length - 1].push({ redir: true });
    else if (tk.t === "w") segs[segs.length - 1].push(tk.v);
  }
  for (const seg0 of segs) {
    const seg = [];
    for (let i = 0; i < seg0.length; i++) { if (seg0[i]?.redir) { i++; continue; } seg.push(seg0[i]); }
    let k = 0;
    while (k < seg.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(seg[k]) || WRAPPERS.has(seg[k]))) {
      if (seg[k] === "timeout") k++; // skip duur
      k++;
    }
    const w = seg.slice(k);
    if (!w.length) continue;
    const base = path.basename(w[0]);
    const args = w.slice(1);
    const nonFlag = args.filter((a) => !a.startsWith("-"));
    const has = (...f) => args.some((a) => f.includes(a) || f.some((x) => x.startsWith("--") && a.startsWith(x + "=")));
    if (base === "claude") res.flags.add("claude-cli");
    if (base === "eval") { res.flags.add("obfuscatie"); res.unknownWrite = true; }
    if (base === "base64" && has("-d", "--decode")) res.flags.add("obfuscatie");
    if (["bash", "sh", "zsh", "dash"].includes(base)) {
      const ci = args.indexOf("-c");
      if (ci >= 0 && args[ci + 1]) {
        const inner = analyzeBash(args[ci + 1], cwd);
        res.targets.push(...inner.targets); inner.flags.forEach((f) => res.flags.add(f));
        res.unknownWrite ||= inner.unknownWrite; res.installs.push(...inner.installs); res.execScripts.push(...inner.execScripts);
      } else if (nonFlag[0]) res.execScripts.push(nonFlag[0]);
    }
    if (["node", "python", "python3", "perl", "ruby", "php", "deno", "bun", "tsx", "ts-node"].includes(base)) {
      const inlineIdx = args.findIndex((a) => ["-e", "-c", "--eval", "-p", "--print", "-E"].includes(a));
      if (inlineIdx >= 0) {
        const code = args.slice(inlineIdx + 1).join(" ");
        if (/writeFile|appendFile|createWriteStream|copyFile|rename|unlink|rmSync|rmdir|mkdir|truncate|open\s*\([^)]*['"][wax+]|shutil|os\.remove|os\.rename|Path\([^)]*\)\.write|\.write_text|\.write_bytes|File\.write|file_put_contents|Deno\.write/.test(code)) {
          res.flags.add("inline-schrijfcode"); res.unknownWrite = true;
        }
      } else {
        const script = args.find((a) => !a.startsWith("-"));
        if (script && base !== "bun") res.execScripts.push(script);
        if (base === "bun" && script && !["install", "add", "run", "test", "x"].includes(script)) res.execScripts.push(script);
      }
      if (base === "perl" && args.some((a) => /^-[a-z]*i/.test(a))) { nonFlag.slice(1).forEach(addT); if (nonFlag.length <= 1) res.unknownWrite = true; }
    }
    switch (base) {
      case "tee": nonFlag.forEach(addT); break;
      case "cp": case "install": case "rsync": case "ln": if (nonFlag.length) addT(nonFlag[nonFlag.length - 1]); break;
      case "mv": nonFlag.forEach(addT); break;
      case "touch": case "mkdir": case "rm": case "rmdir": case "unlink": case "truncate": case "shred": nonFlag.forEach(addT); break;
      case "chmod": case "chown": case "chgrp": nonFlag.slice(1).forEach(addT); break;
      case "sed":
        if (args.some((a) => a === "-i" || a.startsWith("-i") || a.startsWith("--in-place"))) {
          const withE = args.includes("-e") || args.includes("-f");
          const files = withE ? nonFlag.filter((a, idx) => { const prev = args[args.indexOf(a) - 1]; return prev !== "-e" && prev !== "-f"; }) : nonFlag.slice(1);
          files.forEach(addT); if (!files.length) res.unknownWrite = true;
        }
        break;
      case "dd": args.filter((a) => a.startsWith("of=")).forEach((a) => addT(a.slice(3))); break;
      case "curl": { const o = args.findIndex((a) => a === "-o" || a === "--output"); if (o >= 0) addT(args[o + 1]); if (has("-O", "--remote-name")) res.unknownWrite = true; break; }
      case "wget": { const o = args.findIndex((a) => a === "-O"); if (o >= 0) addT(args[o + 1]); else res.unknownWrite = true; break; }
      case "patch": case "unzip": res.unknownWrite = true; break;
      case "tar": if (args.some((a) => /^-?[a-z]*x/.test(a))) res.unknownWrite = true; break;
      case "git": {
        const sub = nonFlag[0];
        if (["checkout", "restore"].includes(sub)) {
          const dd = args.indexOf("--");
          const files = dd >= 0 ? args.slice(dd + 1) : nonFlag.slice(sub === "checkout" ? 2 : 1);
          if (files.length) files.forEach(addT); else res.unknownWrite = true;
        } else if (["rm", "mv"].includes(sub)) nonFlag.slice(1).forEach(addT);
        else if (["apply", "am", "merge", "rebase", "pull", "cherry-pick", "revert", "clean", "reset", "stash", "switch", "worktree", "filter-branch", "filter-repo", "update-index", "read-tree"].includes(sub)) res.unknownWrite = true;
        break;
      }
      case "npm": case "pnpm": case "yarn": {
        const sub = nonFlag[0];
        const globalFlag = has("-g", "--global", "--location=global") || args.some((a) => a.startsWith("--prefix"));
        const pkgs = nonFlag.slice(1);
        if (["i", "install", "add", "remove", "rm", "uninstall", "un", "update", "up", "upgrade"].includes(sub) || (base === "yarn" && !sub)) {
          if (!globalFlag && pkgs.length) { addT("package.json"); res.installs.push(...pkgs); }
        }
        if (["create", "init", "exec", "dlx"].includes(sub)) res.flags.add("scaffold-kandidaat");
        break;
      }
      case "bun": if (["add", "remove"].includes(nonFlag[0]) && !has("-g", "--global")) { addT("package.json"); res.installs.push(...nonFlag.slice(1)); } break;
      case "prettier": if (has("--write", "-w")) { nonFlag.length ? nonFlag.forEach(addT) : (res.unknownWrite = true); } break;
      case "eslint": case "biome": case "ruff": case "black": case "gofmt": case "rustfmt":
        if (has("--fix", "--write", "-w", "format") || nonFlag[0] === "format" || base === "black" || base === "rustfmt") { const f = nonFlag.filter((a) => a !== "format" && a !== "check"); f.length ? f.forEach(addT) : (res.unknownWrite = true); }
        break;
      case "npx": case "bunx": {
        const inner = args.filter((a) => a !== "-y" && a !== "--yes");
        if (inner.length) { const r = analyzeBash(inner.join(" "), cwd); res.targets.push(...r.targets); r.flags.forEach((f) => res.flags.add(f)); res.unknownWrite ||= r.unknownWrite; res.installs.push(...r.installs); }
        break;
      }
    }
  }
  for (const s of subshells(cmd)) {
    const r = analyzeBash(s, cwd);
    res.targets.push(...r.targets); r.flags.forEach((f) => res.flags.add(f)); res.unknownWrite ||= r.unknownWrite; res.execScripts.push(...r.execScripts);
  }
  return res;
}

// ---------- beslislogica per schrijfdoel ----------
function judgeTarget(rel, ctx) {
  const { cfg, state, agent, prod } = ctx;
  if (matchesAny(rel, GENERATED)) return null;
  const maint = maintenanceActive(state) && !agent;
  const isState = matchesAny(rel, [".claude/state/**"]) || isAncestorOfAny(rel, [".claude/state/**"]);
  if (matchesAny(rel, cfg.altijdBeschermd) || isAncestorOfAny(rel, cfg.altijdBeschermd)) {
    if (!maint || isState) return `${rel} is beschermd (poort, status of goedkeuringsmechanisme). ${isState ? "De goedkeuringsstatus is nooit direct te wijzigen; alleen Jurgens eigen /design-go, /niveau en /onderhoud-go doen dat." : "Alleen Jurgen kan dit vrijgeven met /onderhoud-go."}`;
    return null; // onderhoud door de hoofdsessie
  }
  if (matchesAny(rel, cfg.onderhoudBeschermd) || isAncestorOfAny(rel, cfg.onderhoudBeschermd)) {
    if (!maint) return `${rel} hoort bij het agentensysteem. Wijzigen kan alleen tijdens onderhoud dat Jurgen start met /onderhoud-go.`;
    return null;
  }
  const owner = (cfg.exclusieveBestanden || {})[rel];
  if (owner && agent !== owner) return `${rel} mag alleen door de agent '${owner}' worden geschreven; de hoofdsessie en andere agents kunnen dit oordeel niet invullen of aanpassen.`;
  if (agent && cfg.agentSchrijfrechten && agent in cfg.agentSchrijfrechten) {
    const scope = cfg.agentSchrijfrechten[agent];
    if (!matchesAny(rel, scope)) return `agent '${agent}' mag ${rel} niet schrijven. Toegestaan voor deze rol: ${scope.length ? scope.join(", ") : "niets (rapporteert alleen aan de hoofdsessie)"}.`;
  }
  if (prod.open && prod.via === "freeze" && matchesAny(rel, cfg.bevrorenDocumenten)) {
    return `${rel} is bevroren sinds de Design Freeze. Wijzigingen aan goedgekeurde beslissingen gaan als wijzigingsverzoek in docs/PROGRESS.md (sectie 'Wijzigingsverzoeken'); na akkoord geeft Jurgen opnieuw /design-go. Uitvoeringskeuzes horen in docs/DECISIONS.md.`;
  }
  const allowedPre = [...(cfg.voorFreezeToegestaan || []), ...(cfg.prototypePaden || [])];
  if (!prod.open && !matchesAny(rel, allowedPre) && !isGlobRoot(rel, allowedPre)) {
    return `schrijven naar ${rel} is geblokkeerd: ${prod.reason} Vóór de freeze mogen alleen ontwerp- en projectdocumenten (docs/**) en prototypes (docs/prototype/**) worden geschreven.`;
  }
  return null;
}

function levelGuard(rel, content, ctx) {
  const { cfg, state, prod } = ctx;
  if (!prod.open || prod.level !== 1) return null;
  if (state.niveauJurgen?.niveau === 1) return null;
  const hits = contentIntroducesSignals(cfg, rel, content);
  if (hits.length) return `deze wijziging maakt van het project een niveau-2-project (${hits.join(", ")}). Stop, leg dit vast in docs/PROGRESS.md en vraag Jurgen om /niveau 2 (volledige voorbereiding) of bewust /niveau 1.`;
  return null;
}

function runPretool() {
  const input = parseJSON(readStdin(), {});
  const cfg = readConfig();
  const state = readState();
  const tool = input.tool_name || "";
  const ti = input.tool_input || {};
  // Alleen binnen een subagent is agent_id aanwezig; een sessie met --agent telt als hoofdsessie.
  const agent = input.agent_id ? (input.agent_type || "onbekend") : null;
  const cwd = input.cwd || PROJECT;
  const prod = productionStatus(cfg, state);
  const ctx = { cfg, state, agent, prod };
  const restricted = agent && cfg.agentSchrijfrechten && agent in cfg.agentSchrijfrechten;

  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const p = toRel(ti.file_path || ti.notebook_path || ti.path, cwd);
    if (!p) allow();
    if (p.outside) {
      if (restricted && !isTmp(p.abs, input)) deny(`agent '${agent}' mag buiten het project alleen in /tmp schrijven.`);
      allow();
    }
    const why = judgeTarget(p.rel, ctx);
    if (why) deny(why);
    if (p.rel === "CLAUDE.md" && !maintenanceActive(state)) {
      const IMPORT = "@.claude/werkwijze-subagents.md";
      const removes = tool === "Write" ? !String(ti.content || "").includes(IMPORT)
        : String(ti.old_string || "").includes(IMPORT) && !String(ti.new_string || "").includes(IMPORT)
          || (Array.isArray(ti.edits) && ti.edits.some((e) => String(e.old_string).includes(IMPORT) && !String(e.new_string).includes(IMPORT)));
      if (removes) deny("CLAUDE.md moet de regel '@.claude/werkwijze-subagents.md' behouden; zonder die regel laadt de werkwijze niet. Projectregels mogen wel worden toegevoegd.");
    }
    const content = ti.content ?? ti.new_string ?? (Array.isArray(ti.edits) ? ti.edits.map((e) => e.new_string).join("\n") : "") ?? ti.new_source;
    const lv = levelGuard(p.rel, content, ctx);
    if (lv) deny(lv);
    allow();
  }

  if (tool === "Skill") {
    const name = ti.skill || ti.name || ti.command || "";
    if (/design-go|onderhoud-go|niveau/.test(String(name))) deny("deze opdracht is alleen voor Jurgen. Claude kan hem niet zelf uitvoeren.");
    allow();
  }

  if (tool === "Bash" || tool === "PowerShell" || tool === "Monitor") {
    const cmd = String(ti.command || "");
    const a = analyzeBash(cmd, cwd);
    if (a.flags.has("claude-cli")) deny("het starten van een nieuwe Claude Code-sessie vanuit een opdracht is geblokkeerd (dat zou de goedkeuringsstap kunnen omzeilen).");
    const protectedNeedles = [".claude/state", ".claude/gate", ".claude/settings", "skills/design-go", "skills/niveau", "skills/onderhoud-go", "visual-check.mjs"];
    const mentionsProtected = protectedNeedles.some((n) => cmd.includes(n));
    if (mentionsProtected && (a.unknownWrite || a.flags.has("obfuscatie")) && !maintenanceActive(state)) deny("deze opdracht kan beschermde poortbestanden wijzigen en is daarom geblokkeerd.");
    if ((restricted || !prod.open) && a.flags.has("obfuscatie")) deny("versluierde opdrachten (eval, base64 -d) zijn geblokkeerd voor deze rol of vóór de Design Freeze.");
    if (!prod.open || restricted) {
      const scaff = (cfg.scaffoldEnMigratieCommandos || []).find((s) => cmd.includes(s));
      if (scaff) deny(`'${scaff}' maakt of wijzigt productiecode of het databaseschema en is geblokkeerd: ${restricted ? `rol '${agent}' bouwt niet.` : prod.reason}`);
      if (a.unknownWrite) deny(`deze opdracht schrijft naar bestanden die de poort niet kan vaststellen; ${restricted ? `rol '${agent}' mag alleen lezen, testen draaien en vertrouwde scripts gebruiken.` : "dat is vóór de Design Freeze niet toegestaan. Gebruik Write/Edit voor documenten in docs/."}`);
      for (const s of a.execScripts) {
        const p = toRel(s, cwd);
        if (!p || p.outside) { if (restricted) deny(`rol '${agent}' mag geen scripts van buiten het project uitvoeren.`); continue; }
        if ((cfg.vertrouwdeScripts || []).includes(p.rel)) continue;
        if (!prod.open && matchesAny(p.rel, [...(cfg.voorFreezeToegestaan || []), ...(cfg.prototypePaden || [])])) deny(`vóór de Design Freeze mogen geen zelfgeschreven scripts uit ${p.rel} worden uitgevoerd (omweg om productiecode te schrijven).`);
      }
    }
    for (const t of a.targets) {
      const p = toRel(t, cwd);
      if (!p) continue;
      if (p.outside) { if (restricted && !isTmp(p.abs, input)) deny(`rol '${agent}' mag buiten het project alleen in /tmp schrijven.`); continue; }
      const why = judgeTarget(p.rel, ctx);
      if (why) deny(why);
    }
    if (a.installs.length && prod.open && prod.level === 1 && state.niveauJurgen?.niveau !== 1) {
      const sig = (cfg.niveauSignalen?.pakketten || []).filter((p) => a.installs.some((i) => (p.endsWith("/") ? i.startsWith(p) : i.replace(/@[^@/]+$/, "") === p)));
      if (sig.length) deny(`installatie van ${sig.join(", ")} maakt dit een niveau-2-project. Stop en vraag Jurgen om /niveau 2 of bewust /niveau 1.`);
    }
    allow();
  }
  allow();
}

// ---------- gebruikersopdrachten ----------
function parseUserCommand(input) {
  if (input.hook_event_name === "UserPromptExpansion" || input.command_name) {
    const name = String(input.command_name || "").replace(/^\//, "").split(":").pop();
    return { name, args: String(input.command_args || "").trim() };
  }
  const first = String(input.prompt || "").trim().split("\n")[0];
  const m = first.match(/^\/(design-go|niveau|onderhoud-go)\b(.*)$/);
  return m ? { name: m[1], args: m[2].trim() } : null;
}
function contextOut(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
  process.exit(0);
}
function appendProgress(line) {
  const f = path.join(PROJECT, "docs/PROGRESS.md");
  if (!fs.existsSync(f)) return;
  let txt = fs.readFileSync(f, "utf8");
  const head = "## Besluiten van Jurgen";
  if (!txt.includes(head)) txt += `\n\n${head}\n`;
  txt = txt.replace(head, `${head}\n- ${line}`);
  fs.writeFileSync(f, txt);
}
function runPrompt() {
  const input = parseJSON(readStdin(), {});
  const event = input.hook_event_name || "UserPromptSubmit";
  const cmd = parseUserCommand(input);
  if (!cmd || !["design-go", "niveau", "onderhoud-go"].includes(cmd.name)) process.exit(0);
  if (input.agent_id) process.exit(0); // nooit vanuit een subagent
  const cfg = readConfig();
  const state = readState();
  const pid = input.prompt_id || input.session_id || nowIso();
  if (state.laatstVerwerkt === `${cmd.name}:${pid}`) contextOut(event, `Opdracht /${cmd.name} is al verwerkt door de poort.`);
  state.laatstVerwerkt = `${cmd.name}:${pid}`;
  state.geschiedenis = state.geschiedenis || [];

  if (cmd.name === "onderhoud-go") {
    state.onderhoudTot = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    state.geschiedenis.push({ op: nowIso(), actie: "onderhoud-go", tot: state.onderhoudTot });
    writeState(state);
    appendProgress(`${nowIso().slice(0, 16)} — onderhoud aan het agentensysteem vrijgegeven tot ${state.onderhoudTot.slice(11, 16)} UTC`);
    contextOut(event, `Jurgen heeft onderhoud aan het agentensysteem vrijgegeven tot ${state.onderhoudTot} (30 minuten). Alleen de hoofdsessie mag nu .claude/agents, de werkwijze, templates en de poortconfiguratie wijzigen. De goedkeuringsstatus (.claude/state) blijft altijd beschermd.`);
  }

  if (cmd.name === "niveau") {
    const n = Number((cmd.args.match(/[123]/) || [])[0]);
    if (!n) { process.stderr.write("Gebruik: /niveau 1, /niveau 2 of /niveau 3 (optioneel met reden).\n"); process.exit(2); }
    const prev = state.niveauJurgen?.niveau ?? null;
    state.niveauJurgen = { niveau: n, op: nowIso(), reden: cmd.args.replace(/[123]/, "").trim() || null };
    let extra = "";
    if (state.freeze?.goedgekeurd && n > state.freeze.niveau) {
      state.geschiedenis.push({ op: nowIso(), actie: "freeze vervallen door niveauverhoging", van: state.freeze.niveau, naar: n });
      state.freeze = null;
      extra = ` De bestaande Design Freeze is vervallen omdat het niveau omhoog ging; de voorbereiding voor niveau ${n} moet worden aangevuld en Jurgen geeft daarna opnieuw /design-go.`;
    }
    state.geschiedenis.push({ op: nowIso(), actie: "niveau", van: prev, naar: n });
    writeState(state);
    appendProgress(`${nowIso().slice(0, 16)} — Jurgen zet het kwaliteitsniveau op ${n}${state.niveauJurgen.reden ? ` (${state.niveauJurgen.reden})` : ""}`);
    contextOut(event, `Jurgen heeft het kwaliteitsniveau vastgezet op ${n}. Werk docs/PROGRESS.md bij ('Kwaliteitsniveau: ${n}') en volg de agentmatrix voor niveau ${n}.${extra}`);
  }

  // design-go
  if (/intrek|terug|reset/i.test(cmd.args)) {
    state.freeze = null;
    state.geschiedenis.push({ op: nowIso(), actie: "freeze ingetrokken" });
    writeState(state);
    appendProgress(`${nowIso().slice(0, 16)} — Jurgen trekt de Design Freeze in`);
    contextOut(event, "Jurgen heeft de Design Freeze ingetrokken. Productiecode is weer geblokkeerd tot een nieuwe /design-go.");
  }
  const force = /--forceer|--force/.test(cmd.args);
  const signals = detectSignals(cfg);
  const userLevel = state.niveauJurgen?.niveau ?? null;
  const claimed = claimedLevel();
  let level = userLevel ?? claimed;
  const problems = [];
  if (!level) problems.push("het kwaliteitsniveau staat nergens: zet 'Kwaliteitsniveau: X' in docs/PROGRESS.md of gebruik /niveau X");
  if (!userLevel && level && signals.length && level < 2) problems.push(`het plan noemt niveau ${level}, maar het project bevat niveau-2-signalen (${signals.join(", ")}); bevestig bewust met /niveau 1 of verhoog`);
  for (const rel of (cfg.verplichteDocumentenVoorGo || {})[String(level)] || []) {
    const f = path.join(PROJECT, rel);
    if (!fs.existsSync(f)) problems.push(`${rel} ontbreekt`);
    else if (fs.statSync(f).size < 300) problems.push(`${rel} is nog vrijwel leeg`);
    else if (rel !== "docs/PROGRESS.md" && !rel.includes("reviews/") && isTemplate(fs.readFileSync(f, "utf8"))) problems.push(`${rel} bevat nog lege sjabloonvelden`);
  }
  if (level >= 2) {
    const pc = path.join(PROJECT, "docs/reviews/plan-critic.md");
    if (fs.existsSync(pc) && !/DESIGN FREEZE MOGELIJK:\s*\**\s*JA/i.test(fs.readFileSync(pc, "utf8"))) problems.push("de plan-critic heeft nog geen 'DESIGN FREEZE MOGELIJK: JA' gegeven");
  }
  if ((cfg.vereistScreenshotVoorGo || {})[String(level)]) {
    const dir = path.join(PROJECT, "docs/screenshots/prototype");
    const pngs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")) : [];
    if (!pngs.length) problems.push("er zijn geen prototype-screenshots in docs/screenshots/prototype/ (of visual QA is geblokkeerd: dan alleen met --forceer)");
  }
  if (problems.length && !force) {
    process.stderr.write(`Design Freeze NIET geregistreerd. Nog open:\n- ${problems.join("\n- ")}\n\nAls je bewust toch akkoord geeft, typ: /design-go --forceer\n`);
    process.exit(2);
  }
  const hashes = {};
  for (const rel of cfg.bevrorenDocumenten || []) { const h = sha256(path.join(PROJECT, rel)); if (h) hashes[rel] = h; }
  state.freeze = { goedgekeurd: true, op: nowIso(), niveau: level || 2, hashes, bron: event, sessie: input.session_id || null, geforceerd: force, openPuntenBijGo: force ? problems : [] };
  state.geschiedenis.push({ op: nowIso(), actie: "design-go", niveau: state.freeze.niveau, geforceerd: force });
  writeState(state);
  appendProgress(`${nowIso().slice(0, 16)} — DESIGN FREEZE goedgekeurd door Jurgen (niveau ${state.freeze.niveau}${force ? ", geforceerd met open punten: " + problems.join("; ") : ""})`);
  contextOut(event, `DESIGN FREEZE GEREGISTREERD door de poort op basis van Jurgens eigen opdracht. Niveau ${state.freeze.niveau}. Bevroren documenten: ${Object.keys(hashes).join(", ") || "geen"}. Productiecode is nu toegestaan. Werk zelfstandig de work packages uit docs/PROGRESS.md af volgens de werkwijze; kom alleen terug bij de escalatiecriteria.${force ? " LET OP: geforceerd met open punten: " + problems.join("; ") : ""}`);
}

// ---------- sessiestart / status / config ----------
function statusText() {
  const cfg = readConfig();
  const state = readState();
  const prod = productionStatus(cfg, state);
  const cap = parseJSON(fs.existsSync(CAPABILITY_PATH) ? fs.readFileSync(CAPABILITY_PATH, "utf8") : "", null);
  const lines = [];
  lines.push("Projectstatus volgens de Design Freeze-poort:");
  lines.push(`- Kwaliteitsniveau: ${state.niveauJurgen ? `${state.niveauJurgen.niveau} (vastgezet door Jurgen)` : claimedLevel() ? `${claimedLevel()} (volgens docs/PROGRESS.md)` : "nog niet bepaald"}`);
  lines.push(`- Productiecode: ${prod.open ? `toegestaan (${prod.via === "freeze" ? `Design Freeze van ${state.freeze.op.slice(0, 16)}` : "niveau-1-vrijgave"})` : `GEBLOKKEERD — ${prod.reason}`}`);
  if (prod.signals.length) lines.push(`- Niveau-2-signalen in het project: ${prod.signals.join(", ")}`);
  if (maintenanceActive(state)) lines.push(`- Onderhoud aan agentensysteem open tot ${state.onderhoudTot}`);
  lines.push(`- Screenshot-capability: ${cap ? (cap.ok ? `bewezen op ${String(cap.op).slice(0, 10)} (${cap.browser})` : `GEBLOKKEERD — ${cap.reden}`) : "nog niet getest (draai: node scripts/visual-check.mjs capability)"}`);
  lines.push("Lees docs/PROGRESS.md voordat je iets doet; besluiten daarin zijn bindend en worden niet opnieuw geïnterpreteerd.");
  return lines.join("\n");
}
function runSession() {
  readStdin();
  let text;
  try { text = statusText(); } catch (e) { text = `Poortstatus kon niet worden gelezen: ${e.message}`; }
  contextOut("SessionStart", text);
}
function runConfig() {
  const input = parseJSON(readStdin(), {});
  const state = readState();
  const source = input.source || input.config_source || input.matcher || "";
  if (/project/.test(source) && !maintenanceActive(state)) { process.stderr.write("POORT: wijziging van .claude/settings.json geblokkeerd; alleen tijdens /onderhoud-go.\n"); process.exit(2); }
  if (/local/.test(source)) {
    const f = path.join(PROJECT, ".claude/settings.local.json");
    const j = parseJSON(fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "", {});
    if (j && j.disableAllHooks === true) { process.stderr.write("POORT: 'disableAllHooks' in settings.local.json is niet toegestaan.\n"); process.exit(2); }
  }
  process.exit(0);
}

try {
  if (MODE === "pretool") runPretool();
  else if (MODE === "prompt") runPrompt();
  else if (MODE === "session") runSession();
  else if (MODE === "config") runConfig();
  else { process.stdout.write(statusText() + "\n"); }
} catch (e) {
  if (MODE === "pretool") deny(`interne fout in de poort (${e.message}); schrijven geblokkeerd uit voorzorg.`);
  process.stderr.write(`POORT-fout: ${e.message}\n`);
  process.exit(MODE === "prompt" ? 2 : 1);
}
