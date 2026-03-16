/**
 * Phase71: 締切統計サマリー
 */

export default function DeadlineStats({ stats }) {
  if (!stats) return null;

  const items = [
    { label: "受付中", value: stats.openTotal, color: "text-green-700 bg-green-50" },
    { label: "締切間近", value: stats.closingSoon, color: "text-amber-700 bg-amber-50" },
    { label: "定員間近", value: stats.capacityWarning, color: "text-orange-700 bg-orange-50" },
    { label: "定員到達", value: stats.fullCount, color: "text-red-700 bg-red-50" },
    { label: "募集終了", value: stats.closedCount, color: "text-gray-600 bg-gray-100" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${item.color}`}
        >
          {item.label}
          <span className="font-bold">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
