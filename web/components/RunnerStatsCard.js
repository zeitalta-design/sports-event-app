"use client";

/**
 * Phase191: Runner Stats表示カード
 *
 * My Resultsページ上部に表示。
 * 参加大会数・カテゴリ別・自己ベスト等を表示。
 */

import { useState, useEffect } from "react";

const SPORT_ICONS = {
  marathon: "🏃",
  trail: "⛰️",
  triathlon: "🏊",
};

export default function RunnerStatsCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runner-stats")
      .then((r) => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats || stats.totalEvents === 0) return null;

  const topPB = stats.pbs?.[0];

  return (
    <div className="card p-5 mb-6" data-track="runner_stats_view">
      <h3 className="text-sm font-bold text-gray-700 mb-3">あなたの実績</h3>

      {/* メイン指標 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatBox label="参加大会" value={stats.totalEvents} suffix="大会" />
        <StatBox
          label="完走記録"
          value={stats.totalFinishes}
          suffix="回"
        />
        <StatBox
          label="活動年数"
          value={stats.yearsActive || "-"}
          suffix={stats.yearsActive ? "年" : ""}
        />
      </div>

      {/* カテゴリ別 */}
      {Object.keys(stats.categories).length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1.5">カテゴリ別</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.categories)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([cat, data]) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full"
                >
                  {cat}
                  <span className="font-bold">{data.count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 自己ベスト */}
      {stats.pbs?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">自己ベスト</p>
          <div className="space-y-1">
            {stats.pbs.slice(0, 3).map((pb) => (
              <div key={pb.category} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{pb.category}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 tabular-nums">{pb.time}</span>
                  {pb.eventTitle && (
                    <span className="text-gray-400 text-[10px] max-w-[120px] truncate">
                      {pb.eventTitle}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 活動エリア */}
      {stats.prefectures?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">参加エリア</p>
          <p className="text-xs text-gray-600">
            {stats.prefectures.slice(0, 5).map((p) => p.name).join("、")}
            {stats.prefectures.length > 5 && ` 他${stats.prefectures.length - 5}都道府県`}
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, suffix }) {
  return (
    <div className="text-center p-2 bg-gray-50 rounded-lg">
      <p className="text-xl font-bold text-gray-900 tabular-nums">
        {value}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{suffix}</span>
      </p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
