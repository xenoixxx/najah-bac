// Admin only (ADMIN_EMAILS): list pending transfers with receipt links, approve (+30 days) or reject.
import { admin, env, handle, HttpError, json, requireUser } from "../_shared/util.ts";

const ADMINS = env("ADMIN_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  if (!ADMINS.includes((user.email ?? "").toLowerCase())) throw new HttpError(403, "Admins only.");
  const { action, id } = await req.json().catch(() => ({}));
  const db = admin();

  if (action === "list") {
    const { data, error } = await db.from("payments").select("id,user_id,provider,reference,note_code,receipt_path,created_at")
      .in("provider", ["ccp", "baridimob"]).eq("status", "pending").order("created_at").limit(100);
    if (error) throw error;
    const out = await Promise.all((data ?? []).map(async (p) => {
      const { data: u } = await db.auth.admin.getUserById(p.user_id);
      const { data: s } = p.receipt_path ? await db.storage.from("receipts").createSignedUrl(p.receipt_path, 600) : { data: null };
      return { ...p, email: u.user?.email, name: u.user?.user_metadata?.name, receipt_url: s?.signedUrl };
    }));
    return json(req, { payments: out });
  }

  if (action === "approve" || action === "reject") {
    const { data: p } = await db.from("payments")
      .update({ status: action === "approve" ? "approved" : "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.email })
      .eq("id", id).eq("status", "pending").select("user_id,provider,reference").maybeSingle();
    if (!p) throw new HttpError(404, "Already reviewed or not found.");
    if (action === "approve") {
      await db.rpc("grant_plus", { p_user: p.user_id, p_days: 30, p_provider: p.provider, p_ref: p.reference });
    } else {
      // end provisional access that this transfer had opened
      await db.from("subscriptions").update({ status: "expired", current_period_end: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", p.user_id).eq("status", "grace");
    }
    return json(req, { ok: true });
  }
  throw new HttpError(400, "Unknown action.");
}));
