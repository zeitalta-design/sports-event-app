"use client";

/**
 * /pricing client bundle — 入札ナビ Pro LP + checkout CTA
 *
 * 「今すぐ始める」ボタンで POST /api/stripe/checkout → session.url へ redirect。
 * 未ログインなら /login?next=/pricing に飛ばす。401 も同様にフォールバック。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function PricingClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const canceled = sp.get("canceled") === "1";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [authStatus, setAuthStatus] = useState("unknown"); // unknown | anon | pro | free

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (cancelled) return;
        const u = d?.user;
        if (!u) setAuthStatus("anon");
        else if (u.isPro) setAuthStatus("pro");
        else setAuthStatus("free");
      })
      .catch(() => !cancelled && setAuthStatus("anon"));
    return () => { cancelled = true; };
  }, []);

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST" });
      if (r.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }
      const d = await r.json();
      if (!r.ok || !d.url) {
        throw new Error(d.message || d.error || "checkout failed");
      }
      window.location.href = d.url;
    } catch (e) {
      setError(e.message || "通信エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
          入札案件を<span className="text-blue-600">“見逃さない”</span>ツール
        </h1>
        <p className="mt-4 text-base text-gray-600">
          有望案件の抽出から締切通知まで、毎日の案件チェックを自動化。
        </p>
      </div>

      {canceled && (
        <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 text-center">
          お手続きを中断しました。いつでも再開できます。
        </div>
      )}
      {authStatus === "pro" && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 text-center">
          現在 Pro プランをご利用中です。
          <Link href="/saved-deals" className="ml-2 underline">保存案件へ →</Link>
        </div>
      )}

      {/* 問題 → 解決 */}
      <section className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">こんな悩み</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>・案件が多すぎて目で追えない</li>
            <li>・気づいたら締切が過ぎている</li>
            <li>・どれから手を付ければ良いか分からない</li>
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3">このツールで</h2>
          <ul className="space-y-2 text-sm text-gray-800">
            <li>✓ 有望案件を自動で抽出</li>
            <li>✓ 締切・状況変化を通知</li>
            <li>✓ 優先順位で一覧表示</li>
          </ul>
        </div>
      </section>

      {/* Phase M-Post: 行政処分スコア + 産廃リスク概要の訴求 */}
      <p className="text-center text-sm text-gray-600 mb-8">
        行政処分スコアや産廃処分リスク概要の詳細は Pro で確認できます。
      </p>

      {/* プラン比較 */}
      <section className="grid md:grid-cols-2 gap-6 mb-10">
        {/* 無料 */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900">無料</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ¥0<span className="text-sm font-normal text-gray-500 ml-1">/月</span>
          </p>
          <ul className="mt-5 space-y-2 text-sm text-gray-700">
            <li>・入札案件の検索・詳細閲覧</li>
            <li>・Deal Score 基本表示</li>
            <li>・保存は 3 件まで</li>
            <li>・通知 なし</li>
            <li>・行政処分スコアは一部表示（ボカシ）</li>
            <li>・産廃処分リスク概要は一部表示（ボカシ）</li>
          </ul>
        </div>

        {/* Pro */}
        <div className="relative bg-white border-2 border-blue-500 rounded-xl p-6 shadow-sm">
          <span className="absolute -top-3 left-4 bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            おすすめ
          </span>
          <h3 className="text-lg font-bold text-blue-700">入札ナビ Pro</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ¥3,980<span className="text-sm font-normal text-gray-500 ml-1">/月</span>
          </p>
          <ul className="mt-5 space-y-2 text-sm text-gray-800">
            <li>✓ <span className="font-bold">行政処分スコアを完全表示</span>（数値・ラベル・判定理由）</li>
            <li>✓ <span className="font-bold">産廃処分リスク概要を完全表示</span>（要約・備考・判断材料）</li>
            <li>✓ 保存 <span className="font-bold">無制限</span></li>
            <li>✓ 通知 <span className="font-bold">すべて ON</span>（締切・状況変化・有望案件）</li>
            <li>✓ 保存案件の継続追跡</li>
            <li>✓ 優先順位ソート（pin / 締切 / 予算）</li>
          </ul>
          <button
            type="button"
            onClick={handleStart}
            disabled={busy || authStatus === "pro"}
            className="mt-6 w-full py-3 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {authStatus === "pro"
              ? "ご利用中"
              : busy
              ? "お手続き画面へ移動中..."
              : "今すぐ始める"}
          </button>
          {error && (
            <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
          )}
          <p className="mt-3 text-[11px] text-gray-500 text-center">
            Stripe 経由の安全な決済。いつでも解約可能。
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="text-xs text-gray-500 space-y-2 mt-10 border-t border-gray-100 pt-6">
        <p>※ 支払いは Stripe を通じて行われます。クレジットカード情報は当サイトには保存されません。</p>
        <p>※ いつでもマイページから解約でき、解約後も当月末まで Pro 機能をご利用いただけます。</p>
      </section>
    </div>
  );
}
