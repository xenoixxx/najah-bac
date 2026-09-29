// PayPal subscription events (PayPal balance and Visa/Mastercard/Amex through PayPal). Signature verified with PayPal's API.
import { admin, env } from "../_shared/util.ts";

const API = env("PAYPAL_MODE") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function token() {
  const r = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_SECRET")}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  return (await r.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const event = await req.json();
  const at = await token();
  const h = (k: string) => req.headers.get(k) ?? "";
  const v = await fetch(`${API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: h("paypal-auth-algo"), cert_url: h("paypal-cert-url"), transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"), transmission_time: h("paypal-transmission-time"),
      webhook_id: env("PAYPAL_WEBHOOK_ID"), webhook_event: event,
    }),
  }).then((r) => r.json());
  if (v.verification_status !== "SUCCESS") return new Response("bad signature", { status: 403 });

  const db = admin();
  const res = event.resource ?? {};
  const now = () => new Date().toISOString();
  const findUser = async (subId: string): Promise<string | null> => {
    const { data } = await db.from("subscriptions").select("user_id").eq("provider_ref", subId).maybeSingle();
    if (data) return data.user_id;
    const s = await fetch(`${API}/v1/billing/subscriptions/${subId}`, { headers: { Authorization: `Bearer ${at}` } }).then((r) => r.json());
    return s.custom_id ?? null;
  };

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      // link the PayPal subscription to the user (keeps any existing paid time); money arrives with PAYMENT.SALE.COMPLETED
      if (res.custom_id) {
        const { data: cur } = await db.from("subscriptions").select("user_id").eq("user_id", res.custom_id).maybeSingle();
        if (cur) await db.from("subscriptions").update({ provider: "paypal", provider_ref: res.id, updated_at: now() }).eq("user_id", res.custom_id);
        else await db.from("subscriptions").insert({ user_id: res.custom_id, provider: "paypal", provider_ref: res.id, status: "none" });
      }
      break;
    }
    case "PAYMENT.SALE.COMPLETED": {
      const subId = res.billing_agreement_id;
      const uid = subId ? await findUser(subId) : null;
      if (!uid) break;
      const { error } = await db.from("payments").insert({
        user_id: uid, provider: "paypal", amount: Math.round(Number(res.amount?.total ?? 0) * 100), currency: res.amount?.currency ?? "USD",
        reference: res.id, status: "paid", raw: event,
      });
      if (!error) await db.rpc("grant_plus", { p_user: uid, p_days: 31, p_provider: "paypal", p_ref: subId }); // unique sale id = never credited twice
      break;
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      // access continues until the paid period ends
      await db.from("subscriptions").update({ status: "canceled", updated_at: now() }).eq("provider_ref", res.id).eq("status", "active");
      break;
  }
  return new Response("ok", { status: 200 });
});
