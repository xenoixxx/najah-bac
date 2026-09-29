// BaridiMob / CCP transfer: stores the receipt + transaction number, opens Plus for GRACE_HOURS right away,
// and pings you for a one-tap confirmation. Each transaction number can only be used once.
import { admin, env, handle, HttpError, json, notifyAdmin, PRICE_DZD, requireUser } from "../_shared/util.ts";

const GRACE_HOURS = Number(env("GRACE_HOURS", "48"));

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  const { method, reference, receipt_path, note_code } = await req.json().catch(() => ({}));
  if (!["ccp", "baridimob"].includes(method)) throw new HttpError(400, "Unknown payment method.");
  if (typeof reference !== "string" || !/^[A-Za-z0-9-]{6,40}$/.test(reference)) throw new HttpError(400, "Enter the transaction number exactly as on the receipt.");
  if (typeof receipt_path !== "string" || !receipt_path.startsWith(`${user.id}/`)) throw new HttpError(400, "Upload the receipt first.");

  const db = admin();
  const { error } = await db.from("payments").insert({
    user_id: user.id, provider: method, amount: PRICE_DZD, currency: "DZD",
    reference: reference.toUpperCase(), receipt_path, note_code: typeof note_code === "string" ? note_code.slice(0, 20) : null, status: "pending",
  });
  if (error?.code === "23505") throw new HttpError(409, "This transaction number was already used.");
  if (error) throw error;

  // provisional access: at most once every 30 days, and never shortens an active subscription
  const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  const now = Date.now();
  const graceOk = !sub?.grace_used_at || now - new Date(sub.grace_used_at).getTime() > 30 * 864e5;
  const activeNow = !!sub && ["active", "canceled"].includes(sub.status) && new Date(sub.current_period_end).getTime() > now;
  let status = sub?.status ?? "none";
  if (!activeNow && graceOk) {
    const until = new Date(now + GRACE_HOURS * 3600e3).toISOString();
    await db.from("subscriptions").upsert({ user_id: user.id, status: "grace", provider: method, current_period_end: until, grace_used_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    status = "grace";
  }
  await notifyAdmin(`💳 Najah: ${method} transfer to review\n${user.email}\nRef: ${reference}\nCode: ${note_code ?? "-"}`);
  return json(req, { status });
}));
