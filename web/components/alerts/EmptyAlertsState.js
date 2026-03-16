import Link from "next/link";

/**
 * Phase60: 通知センター空状態
 *
 * 保存済み大会が0件の場合と、通知候補が0件の場合で
 * 表示を分ける。
 */

export default function EmptyAlertsState({ type = "no_saved" }) {
  if (type === "no_saved") {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-700 mb-2">
          保存済みの大会がありません
        </h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">
          気になる大会を「あとで見る」に追加すると、
          <br className="hidden sm:inline" />
          締切や受付状況の変化をここで確認できます。
        </p>
        <Link
          href="/marathon"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          大会を探す
        </Link>
      </div>
    );
  }

  // no_alerts: 保存済み大会はあるが通知候補0件
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-green-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h3 className="text-base font-bold text-gray-700 mb-2">
        現在、見直したい大会はありません
      </h3>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-sm mx-auto">
        保存中の大会に締切や受付変更があれば、ここに表示されます。
      </p>
    </div>
  );
}
