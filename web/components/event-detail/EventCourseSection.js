/**
 * Phase55: コース・競技情報セクション
 *
 * コース情報、競技方法、関門、制限時間を統合表示。
 * 全データが空なら非表示。
 */
export default function EventCourseSection({
  courseInfo,
  raceMethodText,
  cutoffText,
  timeLimits = [],
  races = [],
}) {
  // 制限時間データ: timeLimits (JSON) or races から抽出
  const hasTimeLimits = timeLimits && timeLimits.length > 0;
  const racesWithTimeLimit = races.filter((r) => r.time_limit);

  const hasAnyData =
    courseInfo || raceMethodText || cutoffText || hasTimeLimits || racesWithTimeLimit.length > 0;

  if (!hasAnyData) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">コース・競技情報</h2>
      <div className="space-y-5">
        {/* コース情報 */}
        {courseInfo && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              🗺️ コース情報
            </h3>
            <p className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {courseInfo}
            </p>
          </div>
        )}

        {/* 競技方法 */}
        {raceMethodText && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              🏁 競技方法
            </h3>
            <p className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {raceMethodText}
            </p>
          </div>
        )}

        {/* 制限時間 */}
        {(hasTimeLimits || racesWithTimeLimit.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              ⏱️ 制限時間
            </h3>
            {hasTimeLimits ? (
              <div className="space-y-1.5">
                {timeLimits.map((tl, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="text-gray-500 min-w-[120px]">{tl.name}</span>
                    <span className="font-medium text-gray-900">{tl.limit}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {racesWithTimeLimit.map((race) => (
                  <div
                    key={race.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="text-gray-500 min-w-[120px]">{race.race_name}</span>
                    <span className="font-medium text-gray-900">{race.time_limit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 関門 */}
        {cutoffText && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              🚧 関門
            </h3>
            <p className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {cutoffText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
