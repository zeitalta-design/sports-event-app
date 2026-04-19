/**
 * Stripe Checkout セッション作成（Phase M-4）
 *
 * POST /api/stripe/checkout
 *   - 認証必須
 *   - mode: "subscription" / line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]
 *   - success_url: /saved-deals?success=1
 *   - cancel_url:  /pricing?canceled=1
 *   - 返却: { url: "https://checkout.stripe.com/..." }
 *
 * 既に is_pro=1 のユーザーには 400 を返す（二重課金防止の最小ガード）。
 * customer は emai ベース lookup + 無ければ新規作成し、users.stripe_customer_id に保存。
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStripe, getStripePriceId, getBaseUrl } from "@/lib/stripe";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (user.isPro) {
      return NextResponse.json(
        { error: "already_pro", message: "すでに Pro プランです" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const priceId = getStripePriceId();
    const baseUrl = getBaseUrl();

    // customer: 既存 stripe_customer_id があれば再利用、無ければ email lookup → なければ新規作成
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const created = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: { user_id: String(user.id) },
        });
        customerId = created.id;
      }
      const db = getDb();
      db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?")
        .run(customerId, user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/saved-deals?success=1`,
      cancel_url:  `${baseUrl}/pricing?canceled=1`,
      // webhook で確実に user を特定できるよう metadata に焼く
      metadata: { user_id: String(user.id) },
      subscription_data: {
        metadata: { user_id: String(user.id) },
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
