/**
 * Stripe Webhook エンドポイント（Phase M-4）
 *
 * POST /api/stripe/webhook
 *   - Stripe 署名検証あり (STRIPE_WEBHOOK_SECRET)
 *   - 処理対象イベント:
 *       checkout.session.completed  → users.is_pro = 1 + stripe_subscription_id 保存
 *       invoice.payment_failed      → users.is_pro = 0
 *       customer.subscription.deleted → users.is_pro = 0 (解約時の即時 OFF)
 *
 * Stripe 側の設定:
 *   Dashboard → Developers → Webhooks → Add endpoint
 *     URL:  https://{your-domain}/api/stripe/webhook
 *     Events: checkout.session.completed, invoice.payment_failed,
 *             customer.subscription.deleted
 *   作成後に発行される "Signing secret" (whsec_...) を
 *   STRIPE_WEBHOOK_SECRET として .env.local に設定する。
 *
 * 実装メモ:
 *   - request.text() で raw body を取り、stripe.webhooks.constructEvent で検証。
 *   - user 特定は最優先で metadata.user_id、次点で customer_id → users.stripe_customer_id で lookup。
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function findUserId({ db, metadataUserId, customerId }) {
  // ① metadata に user_id が乗っていればそれを採用 (checkout.session.completed)
  if (metadataUserId) {
    const n = parseInt(metadataUserId, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // ② customer_id から users.stripe_customer_id で逆引き
  if (customerId) {
    const row = db
      .prepare("SELECT id FROM users WHERE stripe_customer_id = ? LIMIT 1")
      .get(customerId);
    if (row?.id) return row.id;
  }
  return null;
}

function setPro(db, userId, isPro, { subscriptionId = null, customerId = null } = {}) {
  if (!userId) return;
  const fields = ["is_pro = ?", "pro_updated_at = datetime('now')"];
  const values = [isPro ? 1 : 0];
  if (subscriptionId) {
    fields.push("stripe_subscription_id = ?");
    values.push(subscriptionId);
  }
  if (customerId) {
    fields.push("stripe_customer_id = COALESCE(stripe_customer_id, ?)");
    values.push(customerId);
  }
  values.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export async function POST(request) {
  let event;
  try {
    const stripe = getStripe();
    const secret = getStripeWebhookSecret();
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
    }
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("[stripe/webhook] signature verify failed:", e.message);
    return NextResponse.json({ error: "signature_failed" }, { status: 400 });
  }

  try {
    const db = getDb();
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = findUserId({
          db,
          metadataUserId: s.metadata?.user_id,
          customerId: typeof s.customer === "string" ? s.customer : null,
        });
        setPro(db, userId, true, {
          subscriptionId: typeof s.subscription === "string" ? s.subscription : null,
          customerId: typeof s.customer === "string" ? s.customer : null,
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const userId = findUserId({
          db,
          metadataUserId: inv.subscription_details?.metadata?.user_id,
          customerId: typeof inv.customer === "string" ? inv.customer : null,
        });
        setPro(db, userId, false);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = findUserId({
          db,
          metadataUserId: sub.metadata?.user_id,
          customerId: typeof sub.customer === "string" ? sub.customer : null,
        });
        setPro(db, userId, false);
        break;
      }
      default:
        // 未対応イベントは 200 で飲み込む (Stripe の retry を抑制)
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe/webhook] handler error:", e);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }
}
