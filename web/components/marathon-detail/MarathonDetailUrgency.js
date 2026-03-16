/**
 * 締切傾向・エントリー緊急度セクション
 *
 * 大会詳細ページで、その大会の締切傾向を表示する。
 * 履歴が無い場合はシグナルベースの簡易表示のみ。
 */

export default function MarathonDetailUrgency({ urgency, entryHistory, entryStatus }) {
  // 受付終了・開催終了の場合は非表示
  if (entryStatus === "ended" || entryStatus === "cancelled") return null;

  // 緊急度ラベルもシグナルも無い場合は非表示
  if (!urgency?.label && (!urgency?.signals || urgency.signals.length === 0)) {
    return null;
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        申込状況の傾向
      </h2>

      {/* 緊急度ラベル */}
      {urgency?.label && (
        <div className="mb-4">
          <span
            className={`inline-flex items-center px-3 py-1.5 text-sm font-bold border rounded-lg ${urgency.labelDef?.className || "bg-amber-50 text-amber-700 border-amber-200"}`}
          >
            {urgencyIcon(urgency.level)}
            {urgency.label}
          </span>
          {urgency.reasonText && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              {urgency.reasonText}
            </p>
          )}
        </div>
      )}

      {/* 履歴ベースの統計 */}
      {entryHistory && (
        <div className="space-y-2 mb-4">
          {entryHistory.daysOpenToClose !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">募集期間:</span>
              <span className="font-medium text-gray-800">
                約{entryHistory.daysOpenToClose}日で締切
              </span>
            </div>
          )}
          {entryHistory.daysBeforeEventClosed !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">締切タイミング:</span>
              <span className="font-medium text-gray-800">
                開催{entryHistory.daysBeforeEventClosed}日前に締切
              </span>
            </div>
          )}
          {entryHistory.closeReason && entryHistory.closeReason !== "unknown" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">締切理由:</span>
              <span className="font-medium text-gray-800">
                {closeReasonLabel(entryHistory.closeReason)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 検出シグナル */}
      {urgency?.signals && urgency.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {urgency.signals.map((signal) => (
            <span
              key={signal}
              className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* 信頼度注記 */}
      {urgency?.confidence === "low" && (
        <p className="text-xs text-gray-400 mt-3">
          ※ 過去の履歴が少ないため、参考情報としてご覧ください
        </p>
      )}
    </div>
  );
}

function urgencyIcon(level) {
  switch (level) {
    case "high":
      return "⚠️ ";
    case "medium":
      return "📋 ";
    case "low":
      return "✅ ";
    default:
      return "";
  }
}

function closeReasonLabel(reason) {
  switch (reason) {
    case "capacity_reached":
      return "定員到達";
    case "normal_deadline":
      return "通常締切";
    case "cancelled":
      return "中止";
    case "manual_closed":
      return "手動終了";
    default:
      return reason;
  }
}
