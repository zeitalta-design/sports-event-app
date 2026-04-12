"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * トップページ — Risk Monitor
 * NJSS風: 信頼感のあるビジネスリスク管理ツール
 */

// ─── DBカードデータ ─────────────────────
const DB_CARDS = [
  {
    id: "gyosei-shobun",
    status: "公開中",
    title: "行政処分",
    description: "建設業・不動産業・運送業等の行政処分情報を横断検索。リスクスコア自動算出・企業監視アラート対応。",
    features: ["リスクスコア", "企業監視", "比較分析"],
    href: "/gyosei-shobun",
    iconPath: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  },
  {
    id: "sanpai",
    status: "準備中",
    title: "産廃処分",
    description: "廃棄物処理業の行政処分情報を迅速に確認。業者名・地域・処分種別で絞り込み検索。",
    features: ["業者検索", "地域別", "処分履歴"],
    href: null,
    iconPath: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  },
  {
    id: "nyusatsu",
    status: "準備中",
    title: "入札情報",
    description: "全国の官公庁・自治体の入札公告・落札結果を横断検索。案件発掘と競合分析を支援。",
    features: ["入札公告", "落札結果", "競合分析"],
    href: null,
    iconPath: "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z",
  },
  {
    id: "shitei",
    status: "準備中",
    title: "指定管理",
    description: "公共施設の指定管理者公募情報を一括確認。募集要項・選定結果の横断検索。",
    features: ["公募情報", "選定結果", "施設別"],
    href: null,
    iconPath: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  },
  {
    id: "hojokin",
    status: "準備中",
    title: "補助金・助成金",
    description: "国・自治体の補助金情報を効率的に検索。業種・地域・目的から最適な制度を発見。",
    features: ["制度検索", "地域別", "業種別"],
    href: null,
    iconPath: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "kyoninka",
    status: "構想中",
    title: "許認可・登録",
    description: "各種許認可・登録情報の最新状況を確認。取引先の適格性確認・コンプライアンスチェック。",
    features: ["許認可確認", "適格性", "登録状況"],
    href: null,
    iconPath: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
];

// ─── DBカード ─────────────────────
function DbCard({ card }) {
  const isActive = !!card.href && card.status !== "準備中" && card.status !== "構想中";

  const inner = (
    <div className={`h-full bg-white border border-gray-200 rounded-lg flex flex-col transition-all duration-150 ${isActive ? "hover:border-blue-300 hover:shadow-md group" : "opacity-75"}`}>
      <div className="p-5 flex-1">
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
            </svg>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
            card.status === "公開中" ? "bg-blue-50 text-blue-600" :
            card.status === "一部提供中" ? "bg-amber-50 text-amber-600" :
            "bg-gray-50 text-gray-400"
          }`}>
            {card.status}
          </span>
        </div>

        {/* タイトル */}
        <h3 className={`font-bold text-base text-gray-900 mb-1.5 ${isActive ? "group-hover:text-blue-700" : ""} transition-colors`}>
          {card.title}
        </h3>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-3">{card.description}</p>

        {/* 機能タグ */}
        <div className="flex flex-wrap gap-1">
          {card.features.map((f) => (
            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100">{f}</span>
          ))}
        </div>
      </div>

      {/* フッター */}
      <div className="px-5 py-3 border-t border-gray-100">
        {isActive ? (
          <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-1 transition-all group-hover:gap-1.5">
            開く
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </span>
        ) : (
          <span className="text-sm text-gray-400">{card.status}</span>
        )}
      </div>
    </div>
  );

  return isActive ? <Link href={card.href} className="block">{inner}</Link> : <div>{inner}</div>;
}

// ─── メインページ ─────────────────────
export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/gyosei-shobun?keyword=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <>
      {/* ── ヒーロー ── */}
      <section className="bg-[#0C1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0C1929] via-[#142742] to-[#1B3558]" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 text-center">

          <h1 className="text-[1.65rem] sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-[1.35]">
            企業リスクを可視化し、<br className="sm:hidden" />
            迅速な意思決定を支援。
          </h1>

          <p className="mt-3 text-sm sm:text-[15px] text-slate-400 max-w-xl mx-auto leading-relaxed">
            行政処分・入札・補助金情報を横断監視。<br className="hidden sm:inline" />
            お気に入り登録で新着アラートを自動受信。
          </p>

          {/* 検索窓 */}
          <form onSubmit={handleSearch} className="mt-8 max-w-lg mx-auto">
            <div className="flex items-center bg-white rounded-lg shadow-lg shadow-black/10">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="企業名・処分内容で検索..."
                className="flex-1 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 bg-transparent border-none focus:outline-none rounded-l-lg"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-r-lg transition-colors shrink-0"
              >
                検索
              </button>
            </div>
          </form>

          {/* 数値 */}
          <div className="mt-8 flex justify-center gap-8 sm:gap-12">
            {[
              { value: "6+", label: "データソース" },
              { value: "週次", label: "自動更新" },
              { value: "0–100", label: "リスクスコア" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-white/90">{s.value}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DB一覧 ── */}
      <section id="databases" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">データベース</h2>
            <p className="text-xs text-gray-500 mt-0.5">公開中のデータソースと開発予定の一覧</p>
          </div>
          <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded border border-gray-100">{DB_CARDS.length}件</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DB_CARDS.map((card) => <DbCard key={card.id} card={card} />)}
        </div>
      </section>

      {/* ── 活用シーン ── */}
      <section className="bg-slate-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6">活用シーン</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: "与信調査・取引先審査",
                description: "新規取引先の処分履歴をリスクスコアで定量評価。初動調査を効率化。",
                iconPath: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
              },
              {
                title: "継続的リスク監視",
                description: "ウォッチリスト登録で新着処分を自動検知。メールで即時通知。",
                iconPath: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z",
              },
              {
                title: "市場分析・入札準備",
                description: "業種別・地域別の処分傾向を把握し、入札参加資格の確認に活用。",
                iconPath: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
              },
            ].map((uc) => (
              <div key={uc.title} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="w-4.5 h-4.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={uc.iconPath} />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-gray-900 mb-1">{uc.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 底部CTA ── */}
      <section className="bg-[#0C1929]">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 text-center">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">まずは行政処分DBから試す</h2>
          <p className="text-sm text-slate-500 mb-6">ユーザー登録なしで全機能を利用できます。</p>
          <Link
            href="/gyosei-shobun"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            行政処分DBを開く
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        </div>
      </section>
    </>
  );
}
