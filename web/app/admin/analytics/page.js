"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase235: 簡易ログ分析ダッシュボード
 *
 * KPIカード + 日別アクティビティ + 人気イベント + ソース分布
 */

const KPI_DEFS = [
  { key: "totalActions", label: "総アクション", icon: "📊" },
  { key: "pageViews", label: "PV", icon: "👀" },
  { key: "favorites", label: "お気に入り", icon: "⭐" },
  { key: "entryClicks", label: "エントリークリック", icon: "🔗" },
  { key: "saves", label: "保存", icon: "💾" },
  { key: "compares", label: "比較追加", icon: "⚖️" },
  { key: "uniqueSessions", label: "ユニークセッション", icon: "👤" },
  { key: "newUsers", label: "新規ユーザー", icon: "🆕" },
  { key: "newReviews", label: "新規口コミ", icon: "💬" },
];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics-summary?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  const maxDaily = data?.dailyActivity
    ? Math.max(...data.dailyActivity.map((d) => d.cnt), 1)
    : 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">📊 ログ分析</h1>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                days === d
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {d}日間
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">読み込み中...</div>
      ) : data?.error ? (
        <div className="text-center py-20 text-red-500">
          エラー: {data.error}
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400">
          データがありません
        </div>
      ) : (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-8">
            {KPI_DEFS.map((def) => (
              <div
                key={def.key}
                className="bg-white rounded-xl border border-gray-100 p-3 text-center"
              >
                <div className="text-lg mb-1">{def.icon}</div>
                <div className="text-lg font-bold text-gray-900">
                  {(data.kpi?.[def.key] ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {def.label}
                </div>
              </div>
            ))}
          </div>

          {/* 日別アクティビティ */}
          <section className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4">
              📈 日別アクティビティ
            </h2>
            {data.dailyActivity?.length > 0 ? (
              <div className="space-y-1.5">
                {data.dailyActivity.map((row) => (
                  <div key={row.day} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0">
                      {row.day?.slice(5)}
                    </span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${Math.max(
                            (row.cnt / maxDaily) * 100,
                            2
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-12 text-right">
                      {row.cnt}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                データなし
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 人気イベント TOP10 */}
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">
                🔥 人気イベント TOP10
              </h2>
              {data.topEvents?.length > 0 ? (
                <div className="space-y-2">
                  {data.topEvents.map((ev, i) => (
                    <div
                      key={ev.event_id}
                      className="flex items-center gap-3"
                    >
                      <span
                        className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                          i < 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 text-xs text-gray-700 truncate">
                        {ev.title}
                      </span>
                      <span className="text-xs font-medium text-gray-900">
                        {ev.views}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">
                  データなし
                </p>
              )}
            </section>

            {/* ソースページ分布 */}
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">
                📄 流入元ページ
              </h2>
              {data.sourceCounts?.length > 0 ? (
                <div className="space-y-2">
                  {data.sourceCounts.map((s) => (
                    <div
                      key={s.source_page}
                      className="flex items-center gap-3"
                    >
                      <span className="flex-1 text-xs text-gray-700 truncate">
                        {s.source_page}
                      </span>
                      <span className="text-xs font-medium text-gray-900">
                        {s.cnt}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">
                  データなし
                </p>
              )}
            </section>
          </div>

          {/* アクション別内訳 */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">
              🏷️ アクション別内訳
            </h2>
            {data.actionCounts?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.actionCounts.map((a) => (
                  <span
                    key={a.action_type}
                    className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5"
                  >
                    <span className="text-xs text-gray-600">
                      {a.action_type}
                    </span>
                    <span className="text-xs font-bold text-gray-900">
                      {a.cnt}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                データなし
              </p>
            )}
          </section>

          <p className="text-[10px] text-gray-400 mt-4 text-right">
            集計期間: {data.period?.since?.slice(0, 10)} 〜 本日（{days}日間）
          </p>
        </>
      )}
    </div>
  );
}
