"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase201: 口コミ投稿タイミング最適化
 *
 * 適切なタイミングで口コミ投稿を促すバナー。
 * 使用場所:
 * - 結果登録後（My Results）
 * - 大会終了後（詳細ページ）
 * - My Resultsページ
 *
 * variant: "post-result" | "post-event" | "my-results"
 */

const VARIANTS = {
  "post-result": {
    icon: "✍️",
    title: "大会の感想を書いてみませんか？",
    description: "あなたの体験が次のランナーの参考になります。",
    buttonLabel: "口コミを書く",
    color: "bg-blue-50 border-blue-200",
    textColor: "text-blue-700",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
  },
  "post-event": {
    icon: "🏅",
    title: "お疲れ様でした！感想を共有しませんか？",
    description: "コースの印象、会場の雰囲気、次回の参加者へのアドバイスなど。",
    buttonLabel: "参加レポートを書く",
    color: "bg-green-50 border-green-200",
    textColor: "text-green-700",
    buttonColor: "bg-green-600 hover:bg-green-700",
  },
  "my-results": {
    icon: "💬",
    title: "参加した大会の口コミがまだありません",
    description: "体験を共有して、コミュニティに貢献しましょう。",
    buttonLabel: "口コミを書く",
    color: "bg-indigo-50 border-indigo-200",
    textColor: "text-indigo-700",
    buttonColor: "bg-indigo-600 hover:bg-indigo-700",
  },
};

export default function ReviewPromptBanner({
  variant = "post-result",
  eventId,
  eventTitle,
  sportType,
  dismissible = true,
}) {
  const { isLoggedIn } = useAuthStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const config = VARIANTS[variant] || VARIANTS["post-result"];
  const writeUrl = eventId
    ? `/reviews/new?event_id=${eventId}&event_title=${encodeURIComponent(eventTitle || "")}&sport_type=${sportType || "marathon"}`
    : "/reviews/new";
  const loginUrl = `/login?redirect=${encodeURIComponent(writeUrl)}`;

  return (
    <div
      className={`relative rounded-lg border p-4 ${config.color}`}
      data-track={`review_prompt_${variant}`}
    >
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xs"
        >
          ✕
        </button>
      )}
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${config.textColor} mb-0.5`}>{config.title}</p>
          <p className="text-xs text-gray-500 mb-3">{config.description}</p>
          {isLoggedIn ? (
            <Link
              href={writeUrl}
              className={`inline-flex items-center gap-1 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors ${config.buttonColor}`}
              data-track={`review_prompt_click_${variant}`}
            >
              {config.buttonLabel}
            </Link>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={loginUrl}
                className={`inline-flex items-center gap-1 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors ${config.buttonColor}`}
                data-track={`review_prompt_login_${variant}`}
              >
                ログインして{config.buttonLabel}
              </Link>
              <Link
                href={`/signup?redirect=${encodeURIComponent(writeUrl)}`}
                className="text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
              >
                会員登録はこちら
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
