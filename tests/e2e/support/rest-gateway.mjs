/**
 * Lokale testgateway die zich gedraagt als een (klein) Supabase-project:
 *   /auth/v1/*  → doorgestuurd naar een lokale Supabase Auth (GoTrue) server
 *   /rest/v1/*  → minimale PostgREST-vervanger op de lokale PostgreSQL
 *
 * ALLEEN voor end-to-end tests in omgevingen zonder Docker/Supabase CLI.
 * Iedere REST-aanroep draait in een transactie met `set local role` en de
 * JWT-claims, zodat RLS en de database-functies precies zo werken als in
 * Supabase. Ondersteunt alleen wat deze app gebruikt.
 *
 * Omgeving: DATABASE_URL, JWT_SECRET, GOTRUE_URL, PORT
 */
import crypto from "node:crypto";
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.PORT ?? 54321);
const JWT_SECRET = process.env.JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";
const GOTRUE_URL = process.env.GOTRUE_URL ?? "http://127.0.0.1:9999";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

// ---------------------------------------------------------------------------
// JWT (HS256)
// ---------------------------------------------------------------------------
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signJwt(payload, secret = JWT_SECRET) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) throw httpError(401, "PGRST301", "JWT ongeldig");
  const expected = b64url(crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest());
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw httpError(401, "PGRST301", "JWT handtekening ongeldig");
  const claims = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  if (claims.exp && claims.exp * 1000 < Date.now()) throw httpError(401, "PGRST303", "JWT verlopen");
  return claims;
}

function httpError(status, code, message, extra = {}) {
  return Object.assign(new Error(message), { status, code, ...extra });
}

// ---------------------------------------------------------------------------
// Parsing van PostgREST-syntaxis
// ---------------------------------------------------------------------------
const ident = (name) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw httpError(400, "PGRST100", `Ongeldige naam: ${name}`);
  return `"${name}"`;
};

/** Splits op komma's op het hoogste niveau (niet binnen haakjes/quotes). */
function splitTop(input) {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === ",") {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };

/** Eén filter "kolom.op.waarde" (binnen or/and) of kolom + "op.waarde". */
function buildCondition(column, expr, params, alias) {
  let negate = false;
  if (expr.startsWith("not.")) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  let value = expr.slice(dot + 1);
  const col = `${alias}.${ident(column)}`;
  let sql;
  if (op === "is") {
    const v = value.toLowerCase();
    if (!["null", "true", "false", "unknown"].includes(v)) throw httpError(400, "PGRST100", "Ongeldige is-waarde");
    sql = `${col} is ${v}`;
  } else if (op === "in") {
    const inner = value.replace(/^\(/, "").replace(/\)$/, "");
    const items = splitTop(inner).map((v) => v.replace(/^"(.*)"$/, "$1"));
    params.push(items);
    sql = `${col} = any($${params.length})`;
  } else if (OPS[op]) {
    value = value.replace(/^"(.*)"$/, "$1");
    if (op === "like" || op === "ilike") value = value.replace(/\*/g, "%");
    params.push(value);
    sql = `${col} ${OPS[op]} $${params.length}`;
  } else {
    throw httpError(400, "PGRST100", `Onbekende operator: ${op}`);
  }
  return negate ? `not (${sql})` : sql;
}

/** or=(a.eq.1,b.in.(x,y)) / and=(...) */
function buildLogic(kind, value, params, alias) {
  const inner = value.replace(/^\(/, "").replace(/\)$/, "");
  const parts = splitTop(inner).map((part) => {
    const nested = /^(or|and)\((.*)\)$/.exec(part);
    if (nested) return buildLogic(nested[1], `(${nested[2]})`, params, alias);
    const dot = part.indexOf(".");
    return buildCondition(part.slice(0, dot), part.slice(dot + 1), params, alias);
  });
  return `(${parts.join(kind === "or" ? " or " : " and ")})`;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function buildWhere(searchParams, params, alias = "t") {
  const conditions = [];
  for (const [key, value] of searchParams) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and") conditions.push(buildLogic(key, value, params, alias));
    else conditions.push(buildCondition(key, value, params, alias));
  }
  return conditions.length ? `where ${conditions.join(" and ")}` : "";
}

function buildOrder(value, alias = "t") {
  if (!value) return "";
  const parts = value.split(",").map((part) => {
    const [col, dir, nulls] = part.split(".");
    return `${alias}.${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls === "nullsfirst" ? " nulls first" : nulls === "nullslast" ? " nulls last" : ""}`;
  });
  return `order by ${parts.join(", ")}`;
}

// Foreign keys uit de catalogus (voor embeds als "*, households(*)")
const fkCache = new Map();
async function foreignKeys(client, table) {
  if (fkCache.has(table)) return fkCache.get(table);
  const { rows } = await client.query(
    `select c.conrelid::regclass::text as from_table, c.confrelid::regclass::text as to_table,
            (select array_agg(a.attname::text order by k.n) from unnest(c.conkey) with ordinality k(attnum, n)
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as from_cols,
            (select array_agg(a.attname::text order by k.n) from unnest(c.confkey) with ordinality k(attnum, n)
               join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as to_cols
       from pg_constraint c
      where c.contype = 'f' and (c.conrelid = $1::regclass or c.confrelid = $1::regclass)`,
    [`public.${table}`],
  );
  const clean = (name) => name.replace(/^public\./, "");
  const fks = rows.map((r) => ({ ...r, from_table: clean(r.from_table), to_table: clean(r.to_table) }));
  fkCache.set(table, fks);
  return fks;
}

async function buildSelect(client, table, select, alias) {
  const items = splitTop(select || "*");
  const columns = [];
  let embedIndex = 0;
  for (const item of items) {
    const embed = /^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/.exec(item);
    if (!embed) {
      columns.push(item === "*" ? `${alias}.*` : `${alias}.${ident(item)}`);
      continue;
    }
    const [, as, rel, inner] = embed;
    const sub = `e${embedIndex++}`;
    const fks = await foreignKeys(client, table);
    // Veel-op-één: deze tabel verwijst naar rel
    const toOne = fks.find((f) => f.from_table === table && f.to_table === rel && f.from_cols.length === 1);
    const toMany = fks.find((f) => f.to_table === table && f.from_table === rel && f.from_cols.length === 1);
    const innerSelect = await buildSelect(client, rel, inner, sub);
    if (toOne) {
      columns.push(
        `(select row_to_json(x) from (select ${innerSelect} from public.${ident(rel)} ${sub} where ${sub}.${ident(toOne.to_cols[0])} = ${alias}.${ident(toOne.from_cols[0])}) x) as ${ident(as ?? rel)}`,
      );
    } else if (toMany) {
      columns.push(
        `(select coalesce(json_agg(x), '[]') from (select ${innerSelect} from public.${ident(rel)} ${sub} where ${sub}.${ident(toMany.from_cols[0])} = ${alias}.${ident(toMany.to_cols[0])}) x) as ${ident(as ?? rel)}`,
      );
    } else {
      throw httpError(400, "PGRST200", `Geen relatie tussen ${table} en ${rel}`);
    }
  }
  return columns.join(", ");
}

// ---------------------------------------------------------------------------
// Uitvoeren
// ---------------------------------------------------------------------------
function roleFor(req) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? req.headers.apikey;
  if (!auth) return { role: "anon", claims: { role: "anon" } };
  const claims = verifyJwt(auth);
  const role = ["anon", "authenticated", "service_role"].includes(claims.role) ? claims.role : "anon";
  return { role, claims };
}

async function withRole(req, fn) {
  const { role, claims } = roleFor(req);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [
      JSON.stringify(claims),
      claims.sub ?? "",
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function prefers(req) {
  const header = req.headers.prefer ?? "";
  return {
    representation: header.includes("return=representation"),
    count: /count=(exact|planned|estimated)/.test(header),
    ignoreDuplicates: header.includes("resolution=ignore-duplicates"),
    mergeDuplicates: header.includes("resolution=merge-duplicates"),
  };
}

async function handleTable(req, url, body) {
  const table = url.pathname.replace(/^\/rest\/v1\//, "");
  ident(table);
  const params = [];
  const pref = prefers(req);
  const select = url.searchParams.get("select");

  return withRole(req, async (client) => {
    const projection = await buildSelect(client, table, select, "t");

    if (req.method === "GET" || req.method === "HEAD") {
      const where = buildWhere(url.searchParams, params);
      const order = buildOrder(url.searchParams.get("order"));
      const limit = url.searchParams.get("limit") ? `limit ${Number(url.searchParams.get("limit"))}` : "";
      const offset = url.searchParams.get("offset") ? `offset ${Number(url.searchParams.get("offset"))}` : "";
      const sql = `select coalesce(json_agg(x), '[]') as data from (select ${projection} from public.${ident(table)} t ${where} ${order} ${limit} ${offset}) x`;
      const { rows } = await client.query(sql, params);
      let total = null;
      if (pref.count) {
        const countParams = [];
        const countWhere = buildWhere(url.searchParams, countParams);
        total = Number((await client.query(`select count(*) from public.${ident(table)} t ${countWhere}`, countParams)).rows[0].count);
      }
      return { data: rows[0].data, total };
    }

    if (req.method === "POST") {
      const records = Array.isArray(body) ? body : [body];
      const cols =
        url.searchParams.get("columns")?.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1")) ??
        [...new Set(records.flatMap((r) => Object.keys(r)))];
      params.push(JSON.stringify(records));
      const colList = cols.map(ident).join(", ");
      let conflict = "";
      const onConflict = url.searchParams.get("on_conflict");
      if (onConflict && pref.ignoreDuplicates) conflict = `on conflict (${onConflict.split(",").map(ident).join(", ")}) do nothing`;
      else if (onConflict || pref.mergeDuplicates) {
        const target = (onConflict ?? "id").split(",");
        const updates = cols.filter((c) => !target.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`);
        conflict = `on conflict (${target.map(ident).join(", ")}) do ${updates.length ? `update set ${updates.join(", ")}` : "nothing"}`;
      }
      const sql = `with t as (insert into public.${ident(table)} (${colList})
                     select ${colList} from json_populate_recordset(null::public.${ident(table)}, $1) ${conflict} returning *)
                   select coalesce(json_agg(x), '[]') as data from (select ${projection.replace(/\bt\./g, "t.")} from t) x`;
      const { rows } = await client.query(sql, params);
      return { data: pref.representation ? rows[0].data : null, status: 201 };
    }

    if (req.method === "PATCH") {
      params.push(JSON.stringify(body));
      const cols = Object.keys(body);
      const sets = cols.map((c) => `${ident(c)} = r.${ident(c)}`).join(", ");
      const where = buildWhere(url.searchParams, params);
      const sql = `with t as (update public.${ident(table)} t set ${sets}
                     from json_populate_record(null::public.${ident(table)}, $1) r ${where} returning t.*)
                   select coalesce(json_agg(x), '[]') as data from (select ${projection} from t) x`;
      const { rows } = await client.query(sql, params);
      return { data: pref.representation ? rows[0].data : null };
    }

    if (req.method === "DELETE") {
      const where = buildWhere(url.searchParams, params);
      const sql = `with t as (delete from public.${ident(table)} t ${where} returning t.*)
                   select coalesce(json_agg(x), '[]') as data from (select ${projection} from t) x`;
      const { rows } = await client.query(sql, params);
      return { data: pref.representation ? rows[0].data : null };
    }

    throw httpError(405, "PGRST000", "Methode niet ondersteund");
  });
}

async function handleRpc(req, url, body) {
  const fn = url.pathname.replace(/^\/rest\/v1\/rpc\//, "");
  ident(fn);
  const args = body ?? Object.fromEntries(url.searchParams);
  return withRole(req, async (client) => {
    const { rows: meta } = await client.query(
      `select p.proretset, t.typtype from pg_proc p join pg_type t on t.oid = p.prorettype
        where p.proname = $1 and p.pronamespace = 'public'::regnamespace limit 1`,
      [fn],
    );
    if (!meta.length) throw httpError(404, "PGRST202", `Functie ${fn} niet gevonden`);
    // json/jsonb-parameters als JSON-tekst doorgeven: node-postgres zou een JS-array
    // anders als Postgres-arrayliteral ({...}) sturen, wat voor jsonb 22P02/22023 geeft.
    const { rows: params } = await client.query(
      `select unnest(p.proargnames) as name, unnest(p.proargtypes::regtype[])::text as type
         from (select * from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace limit 1) p`,
      [fn],
    );
    const jsonParams = new Set(params.filter((p) => p.type === "json" || p.type === "jsonb").map((p) => p.name));
    const names = Object.keys(args);
    const values = names.map((n) => (jsonParams.has(n) && args[n] !== null && typeof args[n] === "object" ? JSON.stringify(args[n]) : args[n]));
    const argSql = names.map((n, i) => `${ident(n)} => $${i + 1}`).join(", ");
    const { proretset, typtype } = meta[0];
    let sql;
    if (proretset || typtype === "c") {
      sql = `select coalesce(json_agg(x), '[]') as data from (select * from public.${ident(fn)}(${argSql})) x`;
    } else {
      sql = `select to_json(public.${ident(fn)}(${argSql})) as data`;
    }
    const { rows } = await client.query(sql, values);
    let data = rows[0].data;
    if (!proretset && typtype === "c") data = data[0] ?? null;
    return { data };
  });
}

function pgStatus(code) {
  if (code === "42501") return 403;
  if (code?.startsWith("23")) return 409;
  if (code === "P0002") return 404;
  if (code === "22P02" || code === "22023") return 400;
  return 400;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : null;
}

function cors(res, req) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
}

async function proxyAuth(req, res, url) {
  const target = new URL(url.pathname.replace(/^\/auth\/v1/, "") + url.search, GOTRUE_URL);
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(await (async () => {
    const c = [];
    for await (const chunk of req) c.push(chunk);
    return c;
  })());
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  const response = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
  const buf = Buffer.from(await response.arrayBuffer());
  response.headers.forEach((value, key) => {
    if (!["content-encoding", "transfer-encoding", "content-length", "connection"].includes(key)) res.setHeader(key, value);
  });
  cors(res, req);
  res.writeHead(response.status);
  res.end(buf);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "OPTIONS") {
      cors(res, req);
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname.startsWith("/auth/v1")) return await proxyAuth(req, res, url);
    if (!url.pathname.startsWith("/rest/v1/")) {
      cors(res, req);
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "Niet beschikbaar in testgateway" }));
    }
    const body = ["GET", "HEAD", "DELETE"].includes(req.method) ? null : await readBody(req);
    const result = url.pathname.startsWith("/rest/v1/rpc/") ? await handleRpc(req, url, body) : await handleTable(req, url, body);

    let data = result.data;
    const wantsObject = req.headers.accept?.includes("application/vnd.pgrst.object+json");
    if (wantsObject && Array.isArray(data)) {
      if (data.length !== 1) {
        throw httpError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", {
          details: `The result contains ${data.length} rows`,
        });
      }
      data = data[0];
    }
    cors(res, req);
    const headers = { "content-type": "application/json" };
    if (result.total !== undefined && result.total !== null) {
      headers["content-range"] = `0-${Math.max(0, (Array.isArray(data) ? data.length : 1) - 1)}/${result.total}`;
    }
    res.writeHead(result.status ?? 200, headers);
    res.end(req.method === "HEAD" || data === null ? "" : JSON.stringify(data));
  } catch (error) {
    cors(res, req);
    const status = error.status ?? pgStatus(error.code);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: error.code ?? "PGRST000", message: error.message, details: error.details ?? null, hint: error.hint ?? null }));
  }
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  server.listen(PORT, "127.0.0.1", () => console.log(`testgateway op http://127.0.0.1:${PORT}`));
}
