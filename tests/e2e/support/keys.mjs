// Drukt anon- en service-role-sleutels af voor de lokale teststack.
import { signJwt } from "./rest-gateway.mjs";

const secret = process.env.JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${signJwt({ role: "anon", iss: "supabase", exp }, secret)}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${signJwt({ role: "service_role", iss: "supabase", exp }, secret)}`);
