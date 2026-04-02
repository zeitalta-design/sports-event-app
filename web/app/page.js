"use client";
import Link from "next/link";

// ─── 6カテゴリ定義 ────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "gyosei-shobun",
    href: "/gyosei-shobun",
    status: "公開中",
    accent: "#1F6FB2",
    lightBg: "#EBF4FB",
    title: "行政処分",
    description: "公開された行政処分情報を検索・確認",
    detail: "建設業・宅建業・建築士事務所など各業種の行政処分を横断検索できます。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
  },
  {
    id: "sanpai",
    href: null,
    status: "準備中",
    accent: "#0E7490",
    lightBg: "#E6F7FA",
    title: "産廃処分",
    description: "産廃業関連の処分情報を確認",
    detail: "産業廃棄物処理業者への行政処分情報を業者名・地域・処分種別で確認できます。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    ),
  },
  {
    id: "nyusatsu",
    href: null,
    status: "準備中",
    accent: "#4A5568",
    lightBg: "#EEF0F5",
    title: "入札",
    description: "官公庁・自治体の入札/公募情報を探す",
    detail: "国・都道府県・市区町村の入札公告、公募情報を横断して確認できます。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: "shitei",
    href: null,
    status: "準備中",
    accent: "#2E7D6B",
    lightBg: "#EAF4F1",
    title: "指定管理",
    description: "指定管理者の公募・募集情報を確認",
    detail: "公共施設の指定管理者制度に関する公募・選定・更新情報を確認できます。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    id: "hojokin",
    href: null,
    status: "準備中",
    accent: "#2E8B57",
    lightBg: "#EAF5EF",
    title: "補助金",
    description: "国・自治体の補助金情報を探す",
    detail: "国・都道府県・市区町村の補助金・助成金・支援制度を条件付きで確認できます。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "kyoninka",
    href: null,
    status: "構想中",
    accent: "#6B7280",
    lightBg: "#F3F4F6",
    title: "許認可",
    description: "許認可・登録・更新情報を確認",
    detail: "各業種の許認可・登録事業者情報を横断して確認できるデータベースです。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

const STATUS_STYLES = {
  "公開中": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "準備中": { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" },
  "構想中": { bg: "bg-gray-50", text: "text-gray-400", border: "border-gray-200" },
};

// ─── カテゴリカード ──────────────────────────────────────────────
function CategoryCard({ cat }) {
  const isActive = !!cat.href && cat.status === "公開中";
  const ss = STATUS_STYLES[cat.status] || STATUS_STYLES["準備中"];

  const inner = (
    <div
      className={`
        relative h-full bg-white rounded-2xl border overflow-hidden flex flex-col
        transition-all duration-200
        ${isActive
          ? "border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-gray-300 group cursor-pointer"
          : "border-gray-200 opacity-80"}
      `}
    >
      {/* 左サイドアクセントバー */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: cat.accent }} />

      <div className="pl-5 pr-5 pt-5 pb-4 flex flex-col gap-3 flex-1">
        {/* アイコン + ステータス */}
        <div className="flex items-start justify-between">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl"
            style={{ backgroundColor: cat.lightBg, color: cat.accent }}
          >
            {cat.icon}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ss.bg} ${ss.text} ${ss.border}`}>
            {cat.status}
          </span>
        </div>

        {/* タイトル + 短説明 */}
        <div>
          <h3
            className="text-[17px] font-extrabold text-gray-900 leading-tight mb-1 transition-colors"
            style={isActive ? undefined : undefined}
          >
            <span className={isActive ? "group-hover:text-[var(--accent)]" : ""} style={{"--accent": cat.accent}}>
              {cat.title}
            </span>
          </h3>
          <p className="text-[13px] font-medium text-gray-500 leading-snug">
            {cat.description}
          </p>
        </div>

        {/* 詳細説明 */}
        <p className="text-[12px] text-gray-400 leading-relaxed flex-1">
          {cat.detail}
        </p>
      </div>

      {/* フッター */}
      <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
        {isActive ? (
          <span
            className="text-[13px] font-bold flex items-center gap-1 group-hover:gap-2 transition-all"
            style={{ color: cat.accent }}
          >
            検索する
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        ) : (
          <span className="text-[12px] text-gray-300 font-medium">近日公開予定</span>
        )}
      </div>
    </div>
  );

  if (isActive) {
    return <Link href={cat.href} className="block h-full">{inner}</Link>;
  }
  return <div className="h-full">{inner}</div>;
}

// ─── メインページ ─────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="bg-gray-50 min-h-screen">

      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #0C2340 0%, #133257 45%, #1A4070 100%)" }}
      >
        {/* 背景グロー */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 70%, rgba(31,111,178,0.25) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 80% 20%, rgba(14,116,144,0.15) 0%, transparent 45%)",
        }} />

        <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 pt-14 pb-12 sm:pt-20 sm:pb-16">

          {/* ラベル */}
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full border border-white/10 bg-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-semibold tracking-widest text-white/50 uppercase">
              公開データ · 業務DB · コンプライアンス支援
            </span>
          </div>

          {/* タイトル */}
          <h1 className="text-[2rem] sm:text-[2.75rem] font-extrabold text-white leading-[1.15] tracking-tight mb-4 max-w-2xl">
            公開情報データベースで、<br className="hidden sm:block" />
            <span style={{ color: "#5BB4F0" }}>調査・確認・監視</span>をすばやく。
          </h1>

          {/* サブ */}
          <p className="text-base sm:text-[17px] text-white/60 leading-relaxed mb-8 max-w-xl">
            行政処分・入札・指定管理・補助金・許認可など、業務で使える公開情報を横断検索できます。
          </p>

          {/* 検索フォーム */}
          <form action="/gyosei-shobun" method="get" className="flex gap-3 max-w-2xl">
            <div className="flex-1 relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                name="organization"
                type="text"
                placeholder="事業者名・キーワードで検索..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-[15px] bg-white/10 border border-white/20 text-white placeholder-white/35
                           focus:outline-none focus:bg-white/15 focus:border-white/40 focus:ring-2 focus:ring-white/10 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-7 py-3.5 rounded-xl font-bold text-[15px] text-white transition-all whitespace-nowrap shadow-lg hover:shadow-blue-900/30 hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #1F6FB2 0%, #1558A0 100%)" }}
            >
              検索
            </button>
          </form>

          {/* 業種クイックリンク */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: "建設業", slug: "construction" },
              { label: "宅建業", slug: "real_estate" },
              { label: "建築士事務所", slug: "architecture" },
              { label: "産廃業", slug: "waste" },
            ].map(({ label, slug }) => (
              <a
                key={slug}
                href={`/gyosei-shobun?industry=${slug}`}
                className="text-[12px] px-3 py-1 rounded-full border border-white/12 text-white/45 hover:border-white/30 hover:text-white/70 transition-colors"
              >
                {label}
              </a>
            ))}
            <span className="text-[12px] px-3 py-1 text-white/25 flex items-center">↑ 行政処分DBを絞り込む</span>
          </div>

          {/* 統計バー */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 pt-6 border-t border-white/8 text-[12px] text-white/40 font-medium">
            <a href="/gyosei-shobun" className="hover:text-white/70 transition-colors flex items-center gap-1.5 group">
              <span className="w-2 h-2 rounded-full bg-blue-500/60 group-hover:bg-blue-400 transition-colors" />
              行政処分DB
              <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </a>
            <a href="/risk-watch" className="hover:text-white/70 transition-colors flex items-center gap-1.5 group">
              <span className="w-2 h-2 rounded-full bg-teal-500/60 group-hover:bg-teal-400 transition-colors" />
              リスク監視
              <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </a>
            <span className="text-white/20">|</span>
            <span>無料で利用可能 · 会員登録で通知・監視機能を追加</span>
          </div>
        </div>
      </section>

      {/* ═══ CATEGORY GRID ══════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">

        {/* セクション見出し */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-6 rounded-full" style={{ backgroundColor: "#1F6FB2" }} />
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
            データベース一覧
          </h2>
        </div>
        <p className="text-sm text-gray-400 mb-8 pl-4">
          各カテゴリの公開情報を横断検索・確認できます。公開中のDBからご利用いただけます。
        </p>

        {/* 6カテゴリグリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>

        <p className="mt-8 text-[11px] text-gray-300 text-center">
          各データベースの収録範囲・提供状況は順次拡充していきます。
        </p>
      </section>

      {/* ═══ MEMBER AREA ════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-12">
        <div className="rounded-2xl border border-blue-100 bg-white px-6 py-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 rounded-full bg-blue-500" />
            <h2 className="text-base font-extrabold text-gray-800">マイページ / 会員機能</h2>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5 ml-1">
              要ログイン
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                href: "/risk-watch",
                label: "ウォッチリスト",
                desc: "監視中の事業者一覧",
                color: "#1F6FB2",
                bg: "#EBF4FB",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                href: "/risk-alerts",
                label: "リスク通知",
                desc: "新着処分の通知",
                color: "#D97706",
                bg: "#FEF3E2",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                ),
              },
              {
                href: "/favorites",
                label: "お気に入り",
                desc: "保存した処分情報",
                color: "#2E8B57",
                bg: "#EAF5EF",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                ),
              },
              {
                href: "/login",
                label: "ログイン / 登録",
                desc: "アカウント管理",
                color: "#6B7280",
                bg: "#F3F4F6",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3.5 hover:border-gray-200 hover:shadow-md transition-all"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: item.bg, color: item.color }}
                >
                  {item.icon}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-800 group-hover:text-gray-900">{item.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER COPY ════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-16 text-center">
        <p className="text-sm text-gray-400 leading-relaxed">
          大海ナビは、公開情報の中から業務で使えるデータベースを<br className="hidden sm:block" />
          見つけやすく整理していくサービスです。
        </p>
        <div className="flex items-center justify-center gap-4 mt-4 text-[12px] text-gray-300">
          <Link href="/login" className="hover:text-gray-500 transition-colors">ログイン</Link>
          <span>·</span>
          <Link href="/signup" className="hover:text-gray-500 transition-colors">無料登録</Link>
          <span>·</span>
          <Link href="/gyosei-shobun" className="hover:text-gray-500 transition-colors">行政処分DB</Link>
        </div>
      </section>

    </div>
  );
}
