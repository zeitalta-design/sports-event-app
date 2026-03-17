import Link from "next/link";

/**
 * Phase218: 汎用空状態コンポーネント
 *
 * 全ページで統一された空状態表示を提供。
 * icon / title / description / CTA の4要素で構成。
 */

const PRESETS = {
  search: {
    icon: "search",
    title: "該当する大会が見つかりませんでした",
    description: "条件を変えて再検索するか、人気の大会をチェックしてみてください。",
    cta: { label: "条件をリセット", href: "/marathon" },
    secondaryCta: { label: "人気の大会を見る", href: "/popular" },
  },
  favorites: {
    icon: "heart",
    title: "お気に入りの大会はまだありません",
    description: "気になる大会のハートボタンを押すと、ここに保存されます。お気に入りの大会を見つけましょう。",
    cta: { label: "大会を探す", href: "/marathon" },
  },
  saved: {
    icon: "bookmark",
    title: "保存済みの大会がありません",
    description: "大会詳細ページで「保存」ボタンを押すと、検討中の大会としてここに追加されます。",
    cta: { label: "大会を探す", href: "/marathon" },
  },
  compare: {
    icon: "compare",
    title: "比較する大会を追加してください",
    description: "大会詳細や検索結果から「比較に追加」を押すと、ここで最大4件の大会を横並びで比較できます。",
    cta: { label: "大会を探す", href: "/marathon" },
  },
  calendar: {
    icon: "calendar",
    title: "この月に大会はありません",
    description: "他の月を確認するか、大会を探して保存すると、カレンダーに表示されます。",
    cta: { label: "大会を探す", href: "/marathon" },
  },
  results: {
    icon: "trophy",
    title: "参加記録はまだありません",
    description: "大会に参加した結果を登録すると、ここで振り返ることができます。",
    cta: { label: "大会結果を探す", href: "/marathon" },
  },
  reviews: {
    icon: "chat",
    title: "口コミはまだありません",
    description: "この大会に参加したことがある方は、ぜひ口コミを投稿してください。",
    cta: { label: "口コミを書く", href: null },
  },
  photos: {
    icon: "camera",
    title: "写真はまだ投稿されていません",
    description: "大会の写真を共有して、参加者の思い出を残しましょう。",
    cta: { label: "写真を投稿する", href: null },
  },
  notifications: {
    icon: "bell",
    title: "通知はありません",
    description: "大会の受付開始や締切変更があると、ここに通知が届きます。",
  },
  rankings: {
    icon: "chart",
    title: "ランキングデータがまだありません",
    description: "大会を閲覧・お気に入りすると、ランキングに反映されます。",
    cta: { label: "大会を探す", href: "/marathon" },
  },
  savedSearches: {
    icon: "search",
    title: "保存された検索条件はありません",
    description: "検索結果ページで「この条件を保存」を押すと、同じ条件でかんたんに再検索できます。",
    cta: { label: "大会を検索する", href: "/marathon" },
  },
  generic: {
    icon: "info",
    title: "データがありません",
    description: "まだデータが登録されていません。",
  },
};

const ICONS = {
  search: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  heart: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  ),
  bookmark: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  ),
  compare: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  calendar: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  trophy: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 0 1-2.77.897m-5.44 0a6.003 6.003 0 0 1-2.77-.897" />
    </svg>
  ),
  chat: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-2.763-.73A8.994 8.994 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  ),
  camera: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  bell: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
  chart: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  info: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  ),
};

export default function EmptyState({
  preset,
  icon,
  title,
  description,
  cta,
  secondaryCta,
  children,
  compact = false,
}) {
  const p = preset ? PRESETS[preset] || PRESETS.generic : {};
  const finalIcon = icon || p.icon || "info";
  const finalTitle = title || p.title;
  const finalDesc = description || p.description;
  const finalCta = cta || p.cta;
  const finalSecondaryCta = secondaryCta || p.secondaryCta;

  return (
    <div className={`text-center ${compact ? "py-8" : "py-16"}`}>
      <div className={`mx-auto ${compact ? "w-12 h-12" : "w-16 h-16"} bg-gray-100 rounded-full flex items-center justify-center mb-4`}>
        <span className="text-gray-400">
          {ICONS[finalIcon] || ICONS.info}
        </span>
      </div>
      {finalTitle && (
        <h3 className={`${compact ? "text-sm" : "text-base"} font-bold text-gray-800 mb-2`}>
          {finalTitle}
        </h3>
      )}
      {finalDesc && (
        <p className={`${compact ? "text-xs" : "text-sm"} text-gray-600 mb-6 leading-relaxed max-w-sm mx-auto`}>
          {finalDesc}
        </p>
      )}
      {children}
      {(finalCta || finalSecondaryCta) && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {finalCta?.href && (
            <Link
              href={finalCta.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              {finalCta.label}
            </Link>
          )}
          {finalSecondaryCta?.href && (
            <Link
              href={finalSecondaryCta.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {finalSecondaryCta.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
