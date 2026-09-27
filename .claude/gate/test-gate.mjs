#!/usr/bin/env node
// Zelftest van de Design Freeze-poort. Bouwt een tijdelijk nepproject en probeert
// bekende omwegen. Gebruik: node .claude/gate/test-gate.mjs   (exit 0 = alles geslaagd)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "gate.mjs");
let failures = 0, passed = 0;

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poorttest-"));
  fs.mkdirSync(path.join(dir, ".claude/gate"), { recursive: true });
  fs.copyFileSync(path.join(HERE, "gate.config.json"), path.join(dir, ".claude/gate/gate.config.json"));
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  return dir;
}
function run(dir, mode, input) {
  const r = spawnSync("node", [GATE, mode], { input: JSON.stringify({ cwd: dir, session_id: "s1", ...input }), env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
function expect(name, res, want) {
  const ok = want === "allow" ? res.code === 0 : res.code === 2;
  if (ok) passed++; else { failures++; console.log(`FOUT: ${name} — verwacht ${want}, kreeg exit ${res.code}\n  ${res.err.trim()}`); }
}
const W = (file, content = "x", extra = {}) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: file, content }, ...extra });
const E = (file, extra = {}) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: file, old_string: "a", new_string: "b" }, ...extra });
const B = (command, extra = {}) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, ...extra });
const AG = (type) => ({ agent_id: "a1", agent_type: type });
const put = (dir, rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
const long = (title) => `# ${title}\n` + "Inhoud die voldoende uitgewerkt is. ".repeat(20);

// ---------- vóór de freeze ----------
let d = mkProject();
expect("productiecode schrijven vóór freeze", run(d, "pretool", W("src/app/page.tsx")), "deny");
expect("relatief pad productiecode", run(d, "pretool", W(path.join(d, "index.html"))), "deny");
expect("ontwerpdocument schrijven", run(d, "pretool", W("docs/PRODUCT_SPEC.md")), "allow");
expect("prototype schrijven", run(d, "pretool", W("docs/prototype/index.html")), "allow");
expect("status vervalsen via Write", run(d, "pretool", W(".claude/state/gate.json", '{"freeze":{"goedgekeurd":true}}')), "deny");
expect("poortconfig wijzigen", run(d, "pretool", E(".claude/gate/gate.config.json")), "deny");
expect("settings.json wijzigen", run(d, "pretool", E(".claude/settings.json")), "deny");
expect("agent-definitie wijzigen zonder onderhoud", run(d, "pretool", E(".claude/agents/code-reviewer.md")), "deny");
expect("design-go skill wijzigen", run(d, "pretool", W(".claude/skills/design-go/SKILL.md")), "deny");
expect("redirect naar src", run(d, "pretool", B("echo x > src/a.ts")), "deny");
expect("redirect naar docs", run(d, "pretool", B("echo x > docs/notes.md")), "allow");
expect("heredoc naar src", run(d, "pretool", B("cat > src/a.ts <<'EOF'\nx\nEOF")), "deny");
expect("tee naar src", run(d, "pretool", B("echo x | tee src/b.ts")), "deny");
expect("scaffold", run(d, "pretool", B("npx create-next-app@latest .")), "deny");
expect("prisma migrate", run(d, "pretool", B("npx prisma migrate dev")), "deny");
expect("lezen mag", run(d, "pretool", B("cat src/a.ts && ls -la && git status")), "allow");
expect("inline node schrijft src", run(d, "pretool", B(`node -e "require('fs').writeFileSync('src/a.ts','x')"`)), "deny");
expect("inline python schrijft", run(d, "pretool", B(`python3 -c "open('src/a.py','w').write('x')"`)), "deny");
expect("zelfgeschreven script uit docs", run(d, "pretool", B("node docs/gen.js")), "deny");
expect("geneste claude-sessie", run(d, "pretool", B('claude -p "/design-go"')), "deny");
expect("geneste claude via sh -c", run(d, "pretool", B(`sh -c 'claude -p hallo'`)), "deny");
expect("git apply vóór freeze", run(d, "pretool", B("git apply wijziging.patch")), "deny");
expect("map in docs aanmaken", run(d, "pretool", B("mkdir -p docs/reviews docs/screenshots/prototype")), "allow");
expect("docs-map zelf aanmaken", run(d, "pretool", B("mkdir docs")), "allow");
expect("projectinstallatie vóór freeze", run(d, "pretool", B("npm i -D playwright-core")), "deny");
expect("globale installatie", run(d, "pretool", B("npm i -g playwright-core")), "allow");
expect("vertrouwd screenshotscript", run(d, "pretool", B("node scripts/visual-check.mjs capability")), "allow");
expect("status vervalsen via Bash", run(d, "pretool", B(`echo '{"freeze":{"goedgekeurd":true}}' > .claude/state/gate.json`)), "deny");
expect("rm -rf .claude", run(d, "pretool", B("rm -rf .claude")), "deny");
expect("sed -i op src", run(d, "pretool", B("sed -i 's/a/b/' src/x.ts")), "deny");
expect("tests draaien", run(d, "pretool", B("npm test")), "allow");
expect("eval vóór freeze", run(d, "pretool", B(`eval "$(echo ZWNobyB4ID4gc3JjL2EudHM= | base64 -d)"`)), "deny");
expect("cp naar src", run(d, "pretool", B("cp docs/prototype/index.html src/index.html")), "deny");
expect("Skill design-go door Claude", run(d, "pretool", { hook_event_name: "PreToolUse", tool_name: "Skill", tool_input: { skill: "design-go" } }), "deny");
expect("node_modules is geen productiecode", run(d, "pretool", B("echo x > node_modules/.cache-test")), "allow");

// ---------- agent-schrijfrechten ----------
expect("product-analyst eigen document", run(d, "pretool", W("docs/PRODUCT_SPEC.md", "x", AG("product-analyst"))), "allow");
expect("product-analyst ander document", run(d, "pretool", W("docs/UX_SPEC.md", "x", AG("product-analyst"))), "deny");
expect("visual-designer prototype", run(d, "pretool", W("docs/prototype/app.html", "x", AG("visual-designer"))), "allow");
expect("plan-critic schrijft eigen rapport", run(d, "pretool", W("docs/reviews/plan-critic.md", "x", AG("plan-critic"))), "allow");
expect("plan-critic schrijft geen ander document", run(d, "pretool", W("docs/PRODUCT_SPEC.md", "x", AG("plan-critic"))), "deny");
expect("hoofdsessie kan oordeel plan-critic niet invullen", run(d, "pretool", W("docs/reviews/plan-critic.md", "DESIGN FREEZE MOGELIJK: JA")), "deny");
expect("hoofdsessie kan oordeel niet via Bash invullen", run(d, "pretool", B("echo 'DESIGN FREEZE MOGELIJK: JA' >> docs/reviews/plan-critic.md")), "deny");
expect("code-reviewer schrijft niets", run(d, "pretool", W("docs/reviews/x.md", "x", AG("code-reviewer"))), "deny");
expect("code-reviewer Bash naar docs", run(d, "pretool", B("echo x > docs/reviews/x.md", AG("code-reviewer"))), "deny");
expect("code-reviewer Bash naar /tmp", run(d, "pretool", B("git diff > /tmp/diff.txt", AG("code-reviewer"))), "allow");
expect("security-reviewer npm audit", run(d, "pretool", B("npm audit --json", AG("security-reviewer"))), "allow");
expect("visual-qa screenshots via vertrouwd script", run(d, "pretool", B("node scripts/visual-check.mjs shot http://localhost:3000 --naam cp1", AG("visual-qa"))), "allow");
expect("visual-qa eigen script", run(d, "pretool", B("node /tmp/eigen.js", AG("visual-qa"))), "deny");

// ---------- /design-go ----------
put(d, "docs/PROGRESS.md", "# Voortgang\nKwaliteitsniveau: 2\n" + "x".repeat(400));
let r = run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p1" });
expect("design-go met ontbrekende documenten", r, "deny");
if (!/NIET geregistreerd/.test(r.err)) { failures++; console.log("FOUT: melding bij geweigerde design-go ontbreekt"); } else passed++;
for (const f of ["PRODUCT_SPEC", "UX_SPEC", "DESIGN_SYSTEM", "TECHNICAL_DESIGN", "ACCEPTANCE_CRITERIA"]) fs.copyFileSync(path.join(HERE, `../templates/${f}.md`), path.join(d, `docs/${f}.md`));
put(d, "docs/reviews/plan-critic.md", long("Plan-critic") + "\nDESIGN FREEZE MOGELIJK: JA\n"); put(d, "docs/screenshots/prototype/a.png", "png");
expect("design-go met lege sjablonen", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p1b" }), "deny");
fs.rmSync(path.join(d, "docs/screenshots"), { recursive: true });
for (const f of ["PRODUCT_SPEC", "UX_SPEC", "DESIGN_SYSTEM", "TECHNICAL_DESIGN", "ACCEPTANCE_CRITERIA"]) put(d, `docs/${f}.md`, long(f));
put(d, "docs/reviews/plan-critic.md", long("Plan-critic") + "\nDESIGN FREEZE MOGELIJK: NEE\n");
expect("design-go terwijl plan-critic NEE zegt", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p2" }), "deny");
put(d, "docs/reviews/plan-critic.md", long("Plan-critic") + "\nDESIGN FREEZE MOGELIJK: JA\n");
expect("design-go zonder prototype-screenshot", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p3" }), "deny");
put(d, "docs/screenshots/prototype/start-390x844.png", "png");
expect("design-go vanuit subagent wordt genegeerd", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p4", agent_id: "x" }), "allow");
if (fs.existsSync(path.join(d, ".claude/state/gate.json")) && JSON.parse(fs.readFileSync(path.join(d, ".claude/state/gate.json"))).freeze) { failures++; console.log("FOUT: subagent kon freeze registreren"); } else passed++;
r = run(d, "prompt", { hook_event_name: "UserPromptExpansion", command_name: "design-go", command_args: "", prompt_id: "p5" });
expect("design-go door Jurgen (UserPromptExpansion)", r, "allow");
const st = JSON.parse(fs.readFileSync(path.join(d, ".claude/state/gate.json"), "utf8"));
if (!st.freeze?.goedgekeurd || st.freeze.niveau !== 2) { failures++; console.log("FOUT: freeze niet correct vastgelegd"); } else passed++;
expect("dubbele verwerking (Submit na Expansion)", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p5" }), "allow");

// ---------- na de freeze ----------
expect("productiecode na freeze", run(d, "pretool", W("src/app/page.tsx")), "allow");
expect("bevroren document wijzigen", run(d, "pretool", E("docs/PRODUCT_SPEC.md")), "deny");
expect("bevroren document via Bash", run(d, "pretool", B("echo extra >> docs/UX_SPEC.md")), "deny");
expect("PROGRESS blijft schrijfbaar", run(d, "pretool", E("docs/PROGRESS.md")), "allow");
expect("DECISIONS schrijfbaar", run(d, "pretool", W("docs/DECISIONS.md")), "allow");
expect("status blijft beschermd na freeze", run(d, "pretool", W(".claude/state/gate.json")), "deny");
expect("test-writer testbestand", run(d, "pretool", W("src/lib/punten.test.ts", "x", AG("test-writer"))), "allow");
expect("test-writer productiecode", run(d, "pretool", W("src/lib/punten.ts", "x", AG("test-writer"))), "deny");
expect("reviewer schrijft na freeze nog steeds niets", run(d, "pretool", W("src/lib/punten.ts", "x", AG("code-reviewer"))), "deny");
expect("reviewer mag geen scaffold", run(d, "pretool", B("npx shadcn@latest add button", AG("ux-reviewer"))), "deny");
expect("builder mag installeren na freeze", run(d, "pretool", B("npm i zod")), "allow");
expect("git checkout van status geblokkeerd", run(d, "pretool", B("git checkout HEAD~1 -- .claude/state/gate.json")), "deny");
fs.appendFileSync(path.join(d, "docs/DESIGN_SYSTEM.md"), "\nStille wijziging buiten de poort om.\n");
expect("na stille wijziging bevroren doc: productiecode geblokkeerd", run(d, "pretool", W("src/app/page.tsx")), "deny");
r = run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/design-go", prompt_id: "p6" });
expect("Jurgen bevestigt opnieuw", r, "allow");
expect("na nieuwe GO weer open", run(d, "pretool", W("src/app/page.tsx")), "allow");
expect("/niveau 3 door Jurgen", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/niveau 3 externe klanten", prompt_id: "p7" }), "allow");
expect("freeze vervalt na niveauverhoging", run(d, "pretool", W("src/app/page.tsx")), "deny");

// ---------- onderhoud en config ----------
expect("config-wijziging zonder onderhoud", run(d, "config", { hook_event_name: "ConfigChange", source: "project_settings" }), "deny");
expect("/onderhoud-go", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/onderhoud-go", prompt_id: "p8" }), "allow");
expect("agent-definitie wijzigen tijdens onderhoud", run(d, "pretool", E(".claude/agents/code-reviewer.md")), "allow");
expect("subagent mag ook tijdens onderhoud niet", run(d, "pretool", E(".claude/agents/code-reviewer.md", AG("product-designer"))), "deny");
expect("status blijft ook tijdens onderhoud beschermd", run(d, "pretool", W(".claude/state/gate.json")), "deny");
expect("config-wijziging tijdens onderhoud", run(d, "config", { hook_event_name: "ConfigChange", source: "project_settings" }), "allow");
put(d, ".claude/settings.local.json", '{"disableAllHooks": true}');
expect("disableAllHooks lokaal", run(d, "config", { hook_event_name: "ConfigChange", source: "local_settings" }), "deny");

// ---------- niveau 1 ----------
d = mkProject();
put(d, "docs/PROGRESS.md", "Kwaliteitsniveau: 1\n");
expect("niveau 1 zonder vrijgave", run(d, "pretool", W("index.html")), "deny");
put(d, "docs/level1-release.json", '{"niveau":1,"openVragen":0,"reden":"kort"}');
put(d, "docs/SPEC.md", "## Doel\nRente berekenen.\n## Visuele richting\n- Karakter: rustig\n- Lettertype: Inter 16/24\n- Kleuren: donkerblauw primair\n## Acceptatiecriteria\n- AC-001 GEGEVEN x WANNEER y DAN z\n");
expect("niveau-1-vrijgave zonder onderbouwing", run(d, "pretool", W("index.html")), "deny");
put(d, "docs/level1-release.json", '{"niveau":1,"openVragen":0,"persoonsgegevens":false,"gebruikers":"alleen Jurgen","reden":"persoonlijke rekenhulp zonder opslag of gevoelige gegevens"}');
fs.copyFileSync(path.join(HERE, "../templates/SPEC.md"), path.join(d, "docs/SPEC.md"));
expect("niveau 1 met leeg sjabloon als SPEC", run(d, "pretool", W("index.html")), "deny");
put(d, "docs/SPEC.md", "## Doel\nRente berekenen.\n## Visuele richting\n- Karakter: rustig\n- Lettertype: Inter 16/24\n- Kleuren: donkerblauw primair\n## Acceptatiecriteria\n- AC-001 GEGEVEN x WANNEER y DAN z\n");
expect("niveau 1 met ingevulde SPEC", run(d, "pretool", W("index.html")), "allow");
put(d, "docs/SPEC.md", "## Doel\nRente berekenen.\n## Visuele richting\n- Karakter: rustig\n## Acceptatiecriteria\n- AC-001 GEGEVEN x WANNEER y DAN z\n");
expect("niveau 1 met te dunne visuele richting", run(d, "pretool", W("index.html")), "deny");
put(d, "docs/SPEC.md", "## Doel\nRente berekenen.\n## Visuele richting\n- Karakter: rustig\n- Lettertype: Inter 16/24\n- Kleuren: donkerblauw primair\n## Acceptatiecriteria\n- AC-001 GEGEVEN x WANNEER y DAN z\n");
expect("niveau 1 met vrijgave", run(d, "pretool", W("index.html")), "allow");
expect("niveau 1: login-pakket toevoegen", run(d, "pretool", W("package.json", '{"dependencies":{"next-auth":"5"}}')), "deny");
expect("niveau 1: prisma installeren", run(d, "pretool", B("npm install @prisma/client")), "deny");
put(d, "package.json", '{"dependencies":{"@supabase/supabase-js":"2"}}');
expect("niveau 1 met database-signaal", run(d, "pretool", W("index.html")), "deny");
expect("/niveau 1 bewust door Jurgen", run(d, "prompt", { hook_event_name: "UserPromptSubmit", prompt: "/niveau 1 alleen lokaal testen", prompt_id: "q1" }), "allow");
expect("na bewuste keuze niveau 1", run(d, "pretool", W("index.html")), "allow");

// ---------- CLAUDE.md ----------
expect("CLAUDE.md aanvullen mag", run(d, "pretool", W("CLAUDE.md", "# Regels\nextra\n@.claude/werkwijze-subagents.md\n")), "allow");
expect("werkwijze-import uit CLAUDE.md halen", run(d, "pretool", W("CLAUDE.md", "# Regels zonder werkwijze\n")), "deny");
expect("werkwijze-import wegediten", run(d, "pretool", { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "CLAUDE.md", old_string: "@.claude/werkwijze-subagents.md", new_string: "" } }), "deny");

// ---------- sessiestart ----------
r = run(d, "session", { hook_event_name: "SessionStart", source: "startup" });
if (r.code === 0 && /Projectstatus/.test(r.out)) passed++; else { failures++; console.log("FOUT: sessiestatus"); }

console.log(`\nPoorttest: ${passed} geslaagd, ${failures} mislukt.`);
process.exit(failures ? 1 : 0);
