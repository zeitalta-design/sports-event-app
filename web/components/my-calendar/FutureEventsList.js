"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { daysUntil, getPrepProgress, getAllPreps } from "@/lib/my-calendar-manager";
import { EVENT_STATUSES, STATUS_COLORS } from "@/lib/my-events-manager";
import PrepChecklist from "./PrepChecklist";

/**
 * 未来の大会一覧 — 準備進捗付き
 */
export default function FutureEventsList({ events, statuses, onStatusChange, onRemove }) {
  const [preps, setPreps] = useState({});
  const [openPrepId, setOpenPrepId] = useState(null);

  const reload = useCallback(() => {
    if (!events) return;
    const p = {};
    for (const ev of events) {
      p[ev.id] = getPrepProgress(ev.id);
    }
    setPreps(p);
  }, [events]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("my-calendar-change", handler);
    return () => window.removeEventListener("my-calendar-change", handler);
  }, [reload]);

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        予定している大会はありません。
        <Link href="/search" className="text-blue-600 hover:underline ml-1">
          大会を探す
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => {
        const days = daysUntil(ev.event_date);
        const deadlineDays = daysUntil(ev.entry_end_date);
        const status = statuses[ev.id]?.status || "considering";
        const statusDef = EVENT_STATUSES[status];
        const colors = STATUS_COLORS[status];
        const prep = preps[ev.id];
        const isOpen = openPrepId === ev.id;

        const dateStr = ev.event_date
          ? new Date(ev.event_date).toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
              weekday: "short",
            })
          : "未定";

        // 未準備の強調判定
        const hasUrgentPrep = prep && prep.remaining > 0 && days !== null && days <= 7;

        return (
          <div key={ev.id}>
            <div
              className={`bg-white rounded-xl border ${
                hasUrgentPrep ? "border-amber-300" : colors.border
              } p-4 hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-start gap-3">
                {/* カウントダウン */}
                <div className="shrink-0 w-14 text-center">
                  {days !== null && days >= 0 ? (
                    <>
                      <div className={`text-2xl font-black ${
                        days <= 3 ? "text-red-600" : days <= 7 ? "text-orange-600" : "text-blue-600"
                      }`}>{days}</div>
                      <div className={`text-[10px] font-medium ${
                        days <= 3 ? "text-red-500" : days <= 7 ? "text-orange-500" : "text-blue-500"
                      }`}>
                        {days === 0 ? "今日" : "日後"}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">—</div>
                  )}
                </div>

                {/* メイン情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {statusDef.icon} {statusDef.label}
                    </span>
                    {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 && status !== "entered" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        deadlineDays === 0
                          ? "bg-red-200 text-red-800 animate-pulse"
                          : deadlineDays <= 3
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {deadlineDays === 0 ? "🚨 締切今日！" : deadlineDays <= 3 ? `⚠️ 締切${deadlineDays}日` : `締切${deadlineDays}日`}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1 mb-1">
                    {ev.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span>{dateStr}</span>
                    {ev.prefecture && <span>{ev.prefecture}</span>}
                  </div>

                  {/* 準備進捗バー */}
                  {prep && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            prep.percent === 100 ? "bg-green-500" :
                            hasUrgentPrep ? "bg-amber-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${prep.percent}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${
                        prep.percent === 100 ? "text-green-600" :
                        hasUrgentPrep ? "text-amber-600" : "text-gray-500"
                      }`}>
                        {prep.done}/{prep.total}
                      </span>
                      <button
                        onClick={() => setOpenPrepId(isOpen ? null : ev.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                          prep.percent === 100
                            ? "bg-green-50 text-green-600 hover:bg-green-100"
                            : hasUrgentPrep
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        {prep.percent === 100 ? "✅ 完了" :
                         hasUrgentPrep ? "⚠️ 準備する" :
                         "準備する"}
                      </button>
                    </div>
                  )}
                </div>

                {/* アクション */}
                <div className="shrink-0 flex flex-col gap-1">
                  <Link
                    href={`/marathon/${ev.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    詳細
                  </Link>
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(ev.id, e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600"
                  >
                    {Object.entries(EVENT_STATUSES).map(([key, def]) => (
                      <option key={key} value={key}>
                        {def.label}
                      </option>
                    ))}
                  </select>
                  {onRemove && (
                    <button
                      onClick={() => onRemove(ev.id)}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 展開チェックリスト */}
            {isOpen && (
              <div className="mt-2">
                <PrepChecklist
                  eventId={ev.id}
                  eventTitle={ev.title}
                  eventDate={ev.event_date}
                  mode="full"
                  onClose={() => setOpenPrepId(null)}
                  onChange={reload}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
