/**
 * Stripe SDK 初期化ヘルパー（Phase M-4）
 *
 * 使い方:
 *   import { getStripe } from "@/lib/stripe";
 *   const stripe = getStripe();
 *   const session = await stripe.checkout.sessions.create({...});
 *
 * 必須 env vars:
 *   - STRIPE_SECRET_KEY     sk_test_... or sk_live_...
 *   - STRIPE_WEBHOOK_SECRET whsec_...
 *   - STRIPE_PRICE_ID       price_... (Product の単一 Price ID)
 *   - NEXT_PUBLIC_BASE_URL  http://localhost:3001 or https://... (checkout success/cancel URL 用)
 *
 * SDK のインスタンスはリクエスト間で使い回し可能なので module-level cache する。
 */
import Stripe from "stripe";

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in env");
  }
  _stripe = new Stripe(key, {
    // 固定: API version を固定して Stripe 側変更の影響を避ける。
    apiVersion: "2024-06-20",
  });
  return _stripe;
}

export function getStripePriceId() {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not set in env");
  }
  return priceId;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set in env");
  }
  return secret;
}

export function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}
