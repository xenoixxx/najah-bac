// Chargily calls this after a card payment. Verified by HMAC signature, idempotent, then +30 days of Plus.
import { admin, env, hmacHex, PRICE_DZD, safeEqual } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.text();
  const sig = req.headers.get("signature") ?? "";
  const expected = await hmacHex(env("CHARGILY_SECRET_KEY"), body);
  if (!sig || !safeEqual(sig, expected)) return new Response("bad signature", { status: 403 });

  const ev = JSON.parse(body);
  const co = ev.data ?? {};
  const meta = co.metadata ?? {};
  const db = admin();

  if (ev.type === "checkout.paid") {
    if (Number(co.amount) < PRICE_DZD) return new Response("amount mismatch", { status: 200 });
    const { data: p } = await db.from("payments")
      .update({ status: "paid", raw: ev }).eq("id", meta.payment_id).eq("status", "pending")
      .select("user_id").maybeSingle();
    if (p) await db.rpc("grant_plus", { p_user: p.user_id, p_days: 30, p_provider: "chargily", p_ref: co.id });
  } else if (["checkout.failed", "checkout.canceled", "checkout.expired"].includes(ev.type)) {
    await db.from("payments").update({ status: "failed", raw: ev }).eq("id", meta.payment_id).eq("status", "pending");
  }
  return new Response("ok", { status: 200 });
});
