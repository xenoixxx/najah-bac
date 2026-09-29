import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const env = (k: string, d = "") => Deno.env.get(k) ?? d;
export const PRICE_DZD = Number(env("PRICE_DZD", "2000"));
const ALLOWED = env("ALLOWED_ORIGINS", "*").split(",").map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  const allow = ALLOWED.includes("*") || ALLOWED.includes(o) ? (o || "*") : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

export const admin = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export async function requireUser(req: Request): Promise<User> {
  const auth = req.headers.get("Authorization") ?? "";
  const c = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Please log in first.");
  return data.user;
}
export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    try { return await fn(req); }
    catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json(req, { error: status === 500 ? "Something went wrong." : (e as Error).message }, status);
    }
  };
}

export async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Optional: ping you on Telegram when a transfer needs review (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID). */
export async function notifyAdmin(text: string) {
  const t = env("TELEGRAM_BOT_TOKEN"), chat = env("TELEGRAM_CHAT_ID");
  if (!t || !chat) return;
  await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text }) }).catch(() => {});
}
