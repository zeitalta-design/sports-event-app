/**
 * Phase71: 締切グループセクション
 *
 * 「本日締切」「3日以内」などのグループヘッダー + イベントリスト。
 */

import DeadlineGroupCard from "./DeadlineGroupCard";

const GROUP_CONFIG = {
  today: {
    label: "🔴 本日締切",
    description: "今日が申込締切日の大会",
    bgClass: "bg-red-50 border-red-200",
    headerClass: "text-red-700",
    emptyText: "本日締切の大会はありません",
  },
  in3days: {
    label: "🟠 3日以内に締切",
    description: "あと3日以内に締切を迎える大会",
    bgClass: "bg-orange-50 border-orange-200",
    headerClass: "text-orange-700",
    emptyText: null,
  },
  in7days: {
    label: "🟡 7日以内に締切",
    description: "あと1週間以内に締切を迎える大会",
    bgClass: "bg-amber-50 border-amber-200",
    headerClass: "text-amber-700",
    emptyText: null,
  },
  thisMonth: {
    label: "📅 今月中に締切",
    description: "今月末までに締切を迎える大会",
    bgClass: "bg-blue-50 border-blue-200",
    headerClass: "text-blue-700",
    emptyText: null,
  },
  capacity_warning: {
    label: "🔥 定員間近",
    description: "残りわずか・定員に近づいている大会",
    bgClass: "bg-orange-50 border-orange-200",
    headerClass: "text-orange-700",
    emptyText: null,
  },
  full: {
    label: "⛔ 定員到達",
    description: "定員に達した大会（キャンセル待ちの場合あり）",
    bgClass: "bg-red-50 border-red-200",
    headerClass: "text-red-600",
    emptyText: null,
  },
  closed: {
    label: "⬜ 募集終了",
    description: "受付が終了した大会",
    bgClass: "bg-gray-50 border-gray-200",
    headerClass: "text-gray-600",
    emptyText: null,
  },
  unknown: {
    label: "❓ 要確認",
    description: "募集状態が不明な大会（公式サイトで確認してください）",
    bgClass: "bg-gray-50 border-gray-200",
    headerClass: "text-gray-500",
    emptyText: null,
  },
};

export default function DeadlineGroup({ groupKey, events }) {
  const config = GROUP_CONFIG[groupKey];
  if (!config) return null;

  // events が空で emptyText が無い場合はセクション非表示
  if (events.length === 0 && !config.emptyText) return null;

  return (
    <section className={`rounded-xl border p-4 ${config.bgClass}`}>
      {/* ヘッダー */}
      <div className="mb-3">
        <h2 className={`text-sm font-bold ${config.headerClass}`}>
          {config.label}
          <span className="ml-2 text-xs font-normal text-gray-500">
            {events.length}件
          </span>
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
      </div>

      {/* リスト */}
      {events.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">{config.emptyText}</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <DeadlineGroupCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
