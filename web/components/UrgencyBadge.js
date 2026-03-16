/**
 * 緊急度ラベルバッジ（一覧カード用）
 *
 * events テーブルの urgency_label / urgency_level / entry_signals_json
 * から表示するかどうかを判定する。
 *
 * 受付終了・開催終了の場合は表示しない。
 */
import { getUrgencyFromCache } from "@/lib/entry-urgency";

export default function UrgencyBadge({ event }) {
  if (!event) return null;

  // 受付終了・開催終了なら非表示
  const status = event.entry_status;
  if (status === "closed" || status === "ended" || status === "cancelled") {
    return null;
  }

  const urgency = getUrgencyFromCache(event);
  if (!urgency) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${urgency.className}`}
    >
      {urgency.level === "high" ? "⚠️ " : ""}
      {urgency.label}
    </span>
  );
}
