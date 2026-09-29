// Creates a Chargily Pay checkout (EDAHABIA / CIB) for 1 month of Plus and returns the payment page URL.
import { admin, env, handle, HttpError, json, PRICE_DZD, requireUser } from "../_shared/util.ts";

const BASE = env("CHARGILY_MODE") === "live" ? "https://pay.chargily.net/api/v2" : "https://pay.chargily.net/test/api/v2";

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  const { return_url } = await req.json().catch(() => ({}));
  const allowed = env("APP_URL"); // e.g. https://yourname.github.io/najah/
  const back = typeof return_url === "string" && allowed && return_url.startsWith(allowed) ? return_url : allowed;
  if (!back) throw new HttpError(500, "APP_URL is not configured.");

  const db = admin();
  const { data: pay, error } = await db.from("payments")
    .insert({ user_id: user.id, provider: "chargily", amount: PRICE_DZD, currency: "DZD", status: "pending" })
    .select("id").single();
  if (error) throw error;

  const r = await fetch(`${BASE}/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("CHARGILY_SECRET_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: PRICE_DZD,
      currency: "dzd",
      success_url: `${back}?paid=1`,
      failure_url: `${back}?paid=0`,
      webhook_endpoint: `${env("SUPABASE_URL")}/functions/v1/chargily-webhook`,
      locale: "ar",
      description: "Najah Plus — 1 month",
      metadata: { user_id: user.id, payment_id: pay.id },
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.checkout_url) { console.error(j); throw new HttpError(502, "The payment page couldn't be created. Try again."); }
  await db.from("payments").update({ reference: j.id }).eq("id", pay.id);
  return json(req, { checkout_url: j.checkout_url });
}));
