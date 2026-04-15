"use client";

/**
 * 汎用統計ダッシュボード
 *
 * どのカテゴリでも使えるよう、sections 配列で任意の統計カードを表示。
 *
 * 使い方:
 *   <StatsDashboard
 *     totalCount={stats.totalCount}
 *     hasFilters={hasFilters}
 *     filters={filters}
 *     onFilterChange={onFilterChange}
 *     sections={[
 *       { title: "年別件数", type: "bar", filterKey: "year",
 *         rows: stats.countsByYear.map(r => ({ value: r.year, label: r.year, count: r.count })) },
 *       { title: "事業者別 TOP10", type: "ranking", filterKey: "organization",
 *         rows: stats.countsByOrganization.map(r => ({ value: r.name, label: r.name, count: r.count })) },
 *     ]}
 *   />
 */
export default function StatsDashboard({
  totalCount,
  hasFilters,
  filters,
  onFilterChange,
  sections = [],
  accent = "#1F6FB2",
}) {
  if (!totalCount || totalCount === 0) return null;

  // トグル（同値なら解除、違えばセット）
  const toggle = (key, value) => {
    if (!onFilterChange) return;
    onFilterChange(key, filters?.[key] === value ? "" : value);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accent }} />
        <h2 className="text-sm font-bold text-gray-700">データ概要</h2>
        {hasFilters && (
          <span className="text-[11px] text-gray-400">（現在の条件で集計）</span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          総計 <span className="font-bold text-gray-700 text-sm">{totalCount.toLocaleString()}</span> 件
        </span>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-${sections.length >= 2 ? 2 : 1} ${sections.length >= 3 ? "lg:grid-cols-3" : ""} gap-4`}>
        {sections.map((section, i) => (
          <StatsCard
            key={`${section.title}-${i}`}
            section={section}
            filters={filters}
            onToggle={toggle}
            accent={accent}
          />
        ))}
      </div>
    </div>
  );
}

function StatsCard({ section, filters, onToggle, accent }) {
  const rows = section.rows || [];
  const maxCount = Math.max(...rows.map((r) => r.count || 0), 1);
  const activeValue = filters?.[section.filterKey];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-bold text-gray-600 mb-3">{section.title}</h3>
      {rows.length > 0 ? (
        <div className="space-y-1.5">
          {rows.map((row, i) => {
            const isActive = !row.isUnknown && activeValue === row.value;
            const barWidth = Math.max((row.count / maxCount) * 100, 3);
            return (
              <button
                key={`${row.value}-${i}`}
                onClick={() => !row.isUnknown && onToggle(section.filterKey, row.value)}
                disabled={row.isUnknown}
                className={`w-full flex items-center gap-2 rounded transition-colors text-left ${
                  row.isUnknown ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-blue-50/50"
                } ${isActive ? "ring-1 bg-blue-50/30 rounded-lg" : ""}`}
                style={isActive ? { "--tw-ring-color": accent } : {}}
              >
                {section.type === "bar" ? (
                  <>
                    <span className={`text-xs w-12 text-right font-medium shrink-0 ${isActive ? "font-bold" : "text-gray-500"}`} style={isActive ? { color: accent } : {}}>
                      {row.label}
                    </span>
                    <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: accent,
                          opacity: isActive ? 0.9 : 0.75,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right shrink-0 ${isActive ? "" : "text-gray-700"}`} style={isActive ? { color: accent } : {}}>
                      {row.count}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`text-xs w-5 text-right shrink-0 font-medium ${isActive ? "" : "text-gray-400"}`} style={isActive ? { color: accent } : {}}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 relative h-5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded transition-all"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: accent,
                          opacity: isActive ? 0.3 : 0.15,
                        }}
                      />
                      <span
                        className={`relative z-10 text-[11px] font-medium truncate block leading-5 px-1.5 text-left ${isActive ? "font-bold" : "text-gray-700"}`}
                        style={isActive ? { color: accent } : {}}
                        title={row.label}
                      >
                        {row.label}
                      </span>
                    </div>
                    <span className={`text-xs font-bold w-8 text-right shrink-0 ${isActive ? "" : "text-gray-700"}`} style={isActive ? { color: accent } : {}}>
                      {row.count}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">データなし</p>
      )}
    </div>
  );
}
