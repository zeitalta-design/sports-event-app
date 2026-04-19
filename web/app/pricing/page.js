/**
 * 料金プラン LP — 入札ナビ Pro（Phase M-5）
 *
 * 新: 入札案件を見逃さないための月額¥3,980プラン
 * 既存の sports-event 比較ページはこのバージョンで置き換え。
 * CTA ボタンは client-side で /api/stripe/checkout を叩いて session.url へ redirect。
 */
import PricingClient from "./PricingClient";

export const metadata = {
  title: "入札ナビ Pro | Risk Monitor",
  description:
    "入札案件を見逃さないためのツール。有望案件の自動抽出・締切/状況変化の通知・優先順位管理で、毎日の案件チェックを効率化します。",
};

export default function PricingPage() {
  return <PricingClient />;
}
