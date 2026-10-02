/** AAE 3.1 - narrow external-tool classification. No secrets, no generic MCP wildcard. */
import crypto from 'node:crypto';

export const SUPABASE_READ_TOOLS = Object.freeze([
  'get_project_url',
  'list_tables',
  'list_extensions',
  'list_migrations',
  'query_logs',
  'get_advisors',
  'generate_typescript_types',
  'search_docs'
]);
export const SUPABASE_CHANGE_TOOLS = Object.freeze(['apply_migration']);
export const SUPABASE_SQL_TOOL = 'execute_sql';
export const SUPABASE_TOOLS = Object.freeze([...SUPABASE_READ_TOOLS, SUPABASE_SQL_TOOL, ...SUPABASE_CHANGE_TOOLS]);
export const GITHUB_CHANGE_TOOLS = Object.freeze(['create_pull_request']);
export const GITHUB_TOOLS = Object.freeze([...GITHUB_CHANGE_TOOLS]);

const readStart = new Set(['SELECT','SHOW','EXPLAIN','VALUES','WITH']);
const forbiddenReadTokens = new Set([
  'INSERT','UPDATE','DELETE','MERGE','CREATE','ALTER','DROP','TRUNCATE','GRANT','REVOKE','VACUUM','CALL','DO','COPY','COMMENT','REFRESH','REINDEX','CLUSTER','ANALYZE','LOCK','SET','RESET'
]);
const sensitiveTokens = new Set(['DROP','TRUNCATE','DELETE','UPDATE','MERGE','GRANT','REVOKE']);
const sensitivePhrases = [/ALTER\s+TABLE[\s\S]*\bDROP\b/i,/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i,/SECURITY\s+DEFINER/i,/pg_terminate_backend\s*\(/i,/pg_cancel_backend\s*\(/i,/set_config\s*\(/i,/nextval\s*\(/i,/setval\s*\(/i,/vault\s*\./i];

function suffixMatch(name, provider, action) {
  const n=String(name||'').toLowerCase();
  if(!n.includes(provider))return false;
  const a=action.toLowerCase();
  return n===a || n.endsWith('__'+a) || n.endsWith(':'+a) || n.endsWith('/'+a) || n.endsWith('.'+a) || n.endsWith('_'+a);
}
export function identifyExternalTool(name) {
  for(const action of SUPABASE_TOOLS)if(suffixMatch(name,'supabase',action))return {provider:'supabase',action};
  for(const action of GITHUB_TOOLS)if(suffixMatch(name,'github',action))return {provider:'github',action};
  return null;
}

function stripSql(sql) {
  let s=String(sql||'');
  s=s.replace(/\/\*[\s\S]*?\*\//g,' ');
  s=s.replace(/--[^\n\r]*/g,' ');
  s=s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g,' ');
  s=s.replace(/'(?:''|[^'])*'/g,' ');
  s=s.replace(/"(?:""|[^"])*"/g,' ');
  return s;
}
function significantStatements(sql) {
  const clean=stripSql(sql);
  return clean.split(';').map(x=>x.trim()).filter(Boolean);
}
export function sqlText(input={}) {
  for(const key of ['query','sql','statement'])if(typeof input[key]==='string')return input[key];
  return '';
}
export function classifySql(sql) {
  const raw=String(sql||'');
  if(!raw.trim())return {level:'blocked',reason:'SQL ontbreekt.'};
  const statements=significantStatements(raw);
  if(statements.length!==1)return {level:'sensitive',reason:'Meerdere SQL-statements in een execute_sql-call zijn niet toegestaan.'};
  const clean=stripSql(statements[0]);
  const tokens=(clean.match(/[A-Za-z_][A-Za-z0-9_$]*/g)||[]).map(x=>x.toUpperCase());
  const first=tokens[0]||'';
  if(readStart.has(first) && !tokens.some(t=>forbiddenReadTokens.has(t)) && !sensitivePhrases.some(r=>r.test(clean)))return {level:'read',reason:'Conservatief als read-only SQL herkend.'};
  const sensitive=tokens.some(t=>sensitiveTokens.has(t))||sensitivePhrases.some(r=>r.test(clean));
  return {level:sensitive?'sensitive':'change',reason:sensitive?'Mogelijk destructieve/gevoelige SQL.':'Muterende SQL hoort via apply_migration.'};
}
export function migrationSql(input={}) {return typeof input.query==='string'?input.query:typeof input.sql==='string'?input.sql:'';}
export function migrationName(input={}) {return String(input.name||input.migration_name||'').trim();}
export function classifyExternalCall(toolName,input={}) {
  const id=identifyExternalTool(toolName);if(!id)return null;
  if(id.provider==='supabase') {
    if(SUPABASE_READ_TOOLS.includes(id.action))return {...id,level:'read'};
    if(id.action===SUPABASE_SQL_TOOL){const c=classifySql(sqlText(input));return {...id,...c};}
    if(id.action==='apply_migration'){
      const c=classifySql(migrationSql(input));
      // Defining functions often contains DML in the body. Treat apply_migration as controlled change
      // unless clearly destructive at top level or explicitly marked sensitive by the task contract.
      const clean=stripSql(migrationSql(input));
      const topSensitive=/\b(DROP|TRUNCATE)\b/i.test(clean)||/ALTER\s+TABLE[\s\S]*\bDROP\b/i.test(clean)||/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(clean);
      return {...id,level:topSensitive?'sensitive':'change',reason:topSensitive?'Destructieve migratievorm gedetecteerd.':'Migratie is een gecontroleerde externe wijziging.'};
    }
  }
  if(id.provider==='github'&&id.action==='create_pull_request')return {...id,level:'change'};
  return {...id,level:'blocked'};
}
export function projectRefFromInput(input={}) {
  for(const key of ['project_ref','projectRef','project_id','projectId'])if(typeof input[key]==='string'&&input[key].trim())return input[key].trim();
  return null;
}
function collectText(v,depth=0) {
  if(depth>5||v===null||v===undefined)return '';
  if(typeof v==='string')return v.slice(0,20000);
  if(Array.isArray(v))return v.slice(0,30).map(x=>collectText(x,depth+1)).join('\n');
  if(typeof v==='object')return Object.entries(v).slice(0,80).map(([k,x])=>k+' '+collectText(x,depth+1)).join('\n');
  return String(v);
}
export function projectRefFromResponse(response) {
  const text=collectText(response);
  const m=text.match(/https:\/\/([a-z0-9-]{5,})\.supabase\.co\b/i);
  return m?m[1]:null;
}
export function responseDigest(response) {return crypto.createHash('sha256').update(collectText(response)).digest('hex');}
export function inputDigest(input) {return crypto.createHash('sha256').update(JSON.stringify(input||{})).digest('hex');}
export function safeExternalSummary(call,input={}) {
  const out={provider:call.provider,action:call.action,level:call.level,input_digest:inputDigest(input)};
  if(call.provider==='supabase'){
    const ref=projectRefFromInput(input);if(ref)out.project_ref=ref;
    if(call.action==='apply_migration'){const n=migrationName(input);if(n)out.migration_name=n;out.sql_digest=crypto.createHash('sha256').update(migrationSql(input)).digest('hex');}
    if(call.action==='execute_sql')out.sql_digest=crypto.createHash('sha256').update(sqlText(input)).digest('hex');
  }
  if(call.provider==='github'){
    for(const k of ['base','head','title'])if(typeof input[k]==='string')out[k]=input[k].slice(0,240);
  }
  return out;
}
