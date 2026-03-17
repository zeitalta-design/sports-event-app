/**
 * Phase189: 大会履歴タイムライン
 * Phase190: 参加人数表示
 *
 * 大会の開催歴をタイムライン表示。
 * 結果データがあれば参加人数も表示。
 */

export default function EventHistoryTimeline({ history, participantCount }) {
  if (!history?.years?.length || history.years.length < 2) {
    // 1年分しかない場合は参加人数のみ表示
    if (participantCount?.estimate) {
      return <ParticipantCountCard participantCount={participantCount} />;
    }
    return null;
  }

  return (
    <div className="card p-5 space-y-4" data-track="event_history_view">
      <h3 className="text-sm font-bold text-gray-700">開催の歴史</h3>

      {/* 参加人数 */}
      {participantCount?.estimate && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-2xl">👥</span>
          <div>
            <p className="text-sm font-bold text-gray-900">
              {participantCount.confidence === "low" ? "約" : ""}
              {participantCount.estimate.toLocaleString()}人
            </p>
            <p className="text-[10px] text-gray-400">
              {participantCount.source === "results" ? "完走者データより" :
               participantCount.source === "capacity" ? "定員情報より" : "推定"}
            </p>
          </div>
          {history.totalEditions > 1 && (
            <div className="ml-auto text-right">
              <p className="text-xs font-medium text-blue-600">{history.totalEditions}回</p>
              <p className="text-[10px] text-gray-400">開催実績</p>
            </div>
          )}
        </div>
      )}

      {/* タイムライン */}
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gray-200" />
        {history.years.map((item, i) => (
          <div key={item.year} className="relative flex items-start gap-3 pb-3 last:pb-0">
            {/* ドット */}
            <div
              className={`absolute left-[-14px] w-3 h-3 rounded-full border-2 ${
                item.isCurrent
                  ? "bg-blue-600 border-blue-600"
                  : item.status === "upcoming"
                  ? "bg-white border-blue-400"
                  : "bg-white border-gray-300"
              }`}
            />
            {/* コンテンツ */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${item.isCurrent ? "text-blue-600" : "text-gray-700"}`}>
                {item.year}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                item.status === "upcoming"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-50 text-gray-500"
              }`}>
                {item.status === "upcoming" ? "開催予定" : "開催"}
              </span>
              {item.finisherCount && (
                <span className="text-[10px] text-gray-400">
                  {item.finisherCount.toLocaleString()}人完走
                </span>
              )}
              {item.isCurrent && (
                <span className="text-[10px] text-blue-500 font-medium">このページ</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParticipantCountCard({ participantCount }) {
  if (!participantCount?.estimate) return null;
  return (
    <div className="card p-4" data-track="participant_count_view">
      <div className="flex items-center gap-3">
        <span className="text-xl">👥</span>
        <div>
          <p className="text-xs text-gray-500">大会規模</p>
          <p className="text-sm font-bold text-gray-900">
            {participantCount.confidence === "low" ? "約" : ""}
            {participantCount.estimate.toLocaleString()}人
          </p>
        </div>
        {participantCount.scaleLabel && (
          <span className="ml-auto text-xs text-gray-400">{participantCount.scaleLabel}</span>
        )}
      </div>
    </div>
  );
}
