// Google Play Billing (required for the Play Store build): verifies the purchase with Google, acknowledges it,
// and sets Plus to Google's real expiry date. Needs a Google Cloud service account linked in Play Console.
import { JWT } from "npm:google-auth-library@9";
import { admin, env, handle, HttpError, json, requireUser } from "../_shared/util.ts";

const PKG = env("PLAY_PACKAGE_NAME"); // e.g. com.najah.bac

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  const { purchaseToken, sku } = await req.json().catch(() => ({}));
  if (typeof purchaseToken !== "string" || typeof sku !== "string") throw new HttpError(400, "Missing purchase.");

  const sa = JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON", "{}"));
  const jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
  const { token } = await jwt.getAccessToken();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/purchases`;

  const sub = await fetch(`${base}/subscriptionsv2/tokens/${purchaseToken}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  if (!["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(sub.subscriptionState)) throw new HttpError(402, "The purchase isn't active.");
  const expiry = sub.lineItems?.[0]?.expiryTime;

  const db = admin();
  await db.from("payments").insert({ user_id: user.id, provider: "play", amount: 0, currency: "DZD", reference: sub.latestOrderId, status: "paid", raw: sub });
  await db.rpc("set_plus_until", { p_user: user.id, p_until: expiry, p_provider: "play", p_ref: purchaseToken, p_status: "active" });
  if (sub.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
    await fetch(`${base}/subscriptions/${sku}/tokens/${purchaseToken}:acknowledge`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }
  return json(req, { ok: true, until: expiry });
}));
