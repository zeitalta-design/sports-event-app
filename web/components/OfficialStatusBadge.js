/**
 * Phase76: 募集状態バッジ（official_entry_status 対応）
 * Phase81: unknown 理由表示対応
 *
 * official_entry_status がある場合はそちらを優先表示。
 * ない場合は従来の entry_status にフォールバック。
 *
 * variants:
 *   badge  - コンパクト pill (カード用)
 *   full   - ラベル + 補足テキスト (詳細ページ用)
 *   inline - テキストのみ (一覧行用)
 */

import { getOfficialStatusDef } from "@/lib/official-status-defs";
import UnknownReasonBadge from "@/components/UnknownReasonBadge";

const FALLBACK_STATUS_MAP = {
  open: "open",
  upcoming: "unknown",
  closed: "closed",
  ended: "closed",
  cancelled: "closed",
  unknown: "unknown",
};

export default function OfficialStatusBadge({
  event,
  variant = "badge",
  showDeadline = false,
  showCapacity = false,
  showUnknownReason = false,
}) {
  // official status 優先
  const officialStatus = event.official_entry_status;
  const effectiveStatus = officialStatus || FALLBACK_STATUS_MAP[event.entry_status] || "unknown";
  const statusDef = getOfficialStatusDef(effectiveStatus);
  const label = event.official_entry_status_label || statusDef.label;
  const isUnknownLike = effectiveStatus === "unknown" || effectiveStatus === "awaiting_update";

  if (variant === "inline") {
    return (
      <span className={`text-xs font-bold ${statusDef.className.split(" ").find(c => c.startsWith("text-")) || "text-gray-500"}`}>
        {label}
      </span>
    );
  }

  if (variant === "full") {
    return (
      <div className="space-y-1">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${statusDef.badgeClass}`}>
          {label}
        </span>
        {showDeadline && event.official_deadline_text && (
          <p className="text-xs text-gray-500">
            ⏰ {event.official_deadline_text}
          </p>
        )}
        {showCapacity && event.official_capacity_text && (
          <p className="text-xs text-orange-600 font-medium">
            🔥 {event.official_capacity_text}
          </p>
        )}
        {event.official_status_note && (
          <p className="text-xs text-gray-400 italic">
            {event.official_status_note}
          </p>
        )}
        {/* Phase81: unknown 理由表示 */}
        {showUnknownReason && isUnknownLike && event.official_unknown_reason && (
          <UnknownReasonBadge reason={event.official_unknown_reason} variant="detail" />
        )}
      </div>
    );
  }

  // default: badge
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full ${statusDef.badgeClass}`}>
        {label}
        {showDeadline && event.official_deadline_text && (
          <span className="font-normal opacity-80">({event.official_deadline_text})</span>
        )}
      </span>
      {showUnknownReason && isUnknownLike && event.official_unknown_reason && (
        <UnknownReasonBadge reason={event.official_unknown_reason} variant="badge" />
      )}
    </span>
  );
}
