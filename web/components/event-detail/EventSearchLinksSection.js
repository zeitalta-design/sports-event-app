/**
 * Phase58: この条件でもっと探すセクション
 *
 * 地域・距離・開催月から再検索しやすい導線を提供する。
 * 詳細ページから一覧ページへ自然に回遊できるようにする。
 */

import Link from "next/link";

export default function EventSearchLinksSection({ searchLinks }) {
  if (!searchLinks || searchLinks.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-gray-900 mb-3">
        この条件でもっと探す
      </h2>
      <div className="flex flex-wrap gap-2">
        {searchLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center px-3.5 py-2 text-sm text-gray-700 bg-gray-50
                       border border-gray-200 rounded-lg
                       hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700
                       transition-all"
          >
            {link.label}
            <svg
              className="ml-1.5 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
