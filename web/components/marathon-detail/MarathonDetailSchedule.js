/**
 * タイムスケジュールセクション
 *
 * schedule_json 形式:
 * [{ time: "08:00", label: "受付開始" }, ...]
 *
 * Phase 26: 行間・テキストサイズ・間隔改善
 */
export default function MarathonDetailSchedule({ schedule }) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        タイムスケジュール
      </h2>
      <div className="space-y-0">
        {schedule.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-b-0"
          >
            <span className="text-sm font-mono text-blue-600 font-semibold shrink-0 w-16">
              {item.time}
            </span>
            <span className="text-sm text-gray-800">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
