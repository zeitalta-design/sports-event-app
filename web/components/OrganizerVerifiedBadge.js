import { getOrganizerVerificationDisplay, shouldShowVerificationBadge } from "@/lib/organizer-verification";

/**
 * Phase134: 運営確認バッジ
 *
 * 大会カード・詳細ページで公式性の高い大会を視覚化。
 * organizer_verified ステータスに応じたバッジを表示。
 *
 * @param {string} status - organizer_verified値
 * @param {string} updatedAt - 最終更新日（情報更新済みバッジ用）
 * @param {"list"|"detail"} context - 表示コンテキスト
 * @param {"sm"|"md"} size - バッジサイズ
 */
export default function OrganizerVerifiedBadge({ status, updatedAt, context = "list", size = "sm" }) {
  // 更新バッジ: 7日以内に更新された場合
  const isRecentlyUpdated = updatedAt && isWithinDays(updatedAt, 7);

  const showVerification = shouldShowVerificationBadge(status, context);

  if (!showVerification && !isRecentlyUpdated) return null;

  const info = getOrganizerVerificationDisplay(status);
  const sizeClass = size === "md"
    ? "px-2 py-0.5 text-xs"
    : "px-1.5 py-0.5 text-[10px]";

  return (
    <span className="inline-flex items-center gap-1">
      {showVerification && (
        <span className={`inline-block ${sizeClass} font-medium rounded border ${info.className}`}>
          {size === "sm" ? info.shortLabel : info.label}
        </span>
      )}
      {isRecentlyUpdated && (
        <span className={`inline-block ${sizeClass} font-medium rounded border bg-green-50 text-green-700 border-green-200`}>
          {size === "sm" ? "最新" : "情報更新済み"}
        </span>
      )}
    </span>
  );
}

function isWithinDays(dateStr, days) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    return diffMs >= 0 && diffMs < days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
