/**
 * Phase81: 要確認理由の表示コンポーネント
 *
 * unknown / awaiting_update 状態の大会に対して、
 * 「なぜ状態が確定できないのか」を分かりやすく表示する。
 *
 * variants:
 *   badge   - コンパクト表示（カード内）
 *   detail  - 理由 + 説明 + 対処ヒント（詳細ページ）
 *   inline  - テキストのみ
 */

import { UNKNOWN_REASONS } from "@/lib/official-status-defs";

const REASON_ICONS = {
  no_source: "🔍",
  ambiguous_text: "❓",
  stale_data: "⏳",
  source_conflict: "⚡",
  pre_open: "🕐",
  fetch_error: "⚠️",
};

const REASON_HINTS = {
  no_source: "公式サイトのURLが登録されると精度が上がります",
  ambiguous_text: "ページ上に明確な募集状態の記載がありませんでした",
  stale_data: "情報が最新でない可能性があります。公式サイトでご確認ください",
  source_conflict: "複数の情報源で募集状態が異なっています",
  pre_open: "エントリー受付がまだ開始されていません",
  fetch_error: "ページの取得に失敗しました。後ほど自動で再試行されます",
};

export default function UnknownReasonBadge({
  reason,
  variant = "badge",
  className = "",
}) {
  if (!reason) return null;

  const reasonDef = UNKNOWN_REASONS[reason];
  if (!reasonDef) return null;

  const icon = REASON_ICONS[reason] || "❓";

  if (variant === "inline") {
    return (
      <span className={`text-xs text-gray-400 ${className}`}>
        {icon} {reasonDef.label}
      </span>
    );
  }

  if (variant === "detail") {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-bold text-gray-600">{reasonDef.label}</span>
        </div>
        <p className="text-xs text-gray-500">{reasonDef.description}</p>
        {REASON_HINTS[reason] && (
          <p className="text-xs text-blue-500 mt-1">💡 {REASON_HINTS[reason]}</p>
        )}
      </div>
    );
  }

  // default: badge
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded ${className}`}>
      {icon} {reasonDef.label}
    </span>
  );
}
