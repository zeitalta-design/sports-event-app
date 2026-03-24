"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { daysUntil, getPrepProgress, getNote } from "@/lib/my-calendar-manager";
import { EVENT_STATUSES, STATUS_COLORS } from "@/lib/my-events-manager";
import PrepChecklist from "./PrepChecklist";

/**
 * 緊急度レベル定義
 */
function getUrgencyLevel(days) {
  if (days === null || days < 0) return null;
  if (days === 0) return { level: "today", color: "red", bg: "from-red-50 to-orange-50", border: "border-red-200" };
  if (days <= 3) return { level: "critical", color: "red", bg: "from-red-50 to-orange-50", border: "border-red-200" };
  if (days <= 7) return { level: "high", color: "orange", bg: "from-orange-50 to-yellow-50", border: "border-orange-200" };
  if (days <= 14) return { level: "medium", color: "blue", bg: "from-blue-50 to-indigo-50", border: "border-blue-200" };
  return { level: "normal", color: "blue", bg: "from-blue-50 to-indigo-50", border: "border-blue-100" };
}

/**
 * 「今やること」を生成（準備チェックリストから未完了を優先）
 */
function getActionItems(days, status, deadlineDays, prepProgress) {
  const items = [];

  if (days === 0) {
    items.push({ icon: "🏃", text: "レース本番！頑張ってください！", priority: "high" });
    items.push({ icon: "📱", text: "ゼッケン番号・スタート時間を確認", priority: "high" });
    return items;
  }

  // 締切関連
  if (status !== "entered" && deadlineDays !== null && deadlineDays >= 0) {
    if (deadlineDays === 0) {
      items.push({ icon: "🚨", text: "エントリー締切は今日！今すぐ申し込みを", priority: "critical" });
    } else if (deadlineDays <= 3) {
      items.push({ icon: "⚠️", text: `エントリー締切まであと${deadlineDays}日`, priority: "high" });
    } else if (deadlineDays <= 7) {
      items.push({ icon: "📝", text: `エントリー締切まであと${deadlineDays}日`, priority: "medium" });
    }
  }

  // 準備チェックリストから未完了を抽出
  if (prepProgress && prepProgress.remaining > 0 && days !== null && days >= 0) {
    // ステータスに応じて不要な項目を除外
    const skipIds = new Set();
    if (status === "entered") skipIds.add("entry"); // エントリー済みなら確認不要
    const unchecked = prepProgress.items.filter((i) => !i.checked && !skipIds.has(i.id));
    // 緊急度に応じて表示する項目を選ぶ
    const priorityMap = {
      "entry": { icon: "📋", priority: "high" },
      "venue": { icon: "🗺️", priority: "high" },
      "gear": { icon: "👟", priority: "high" },
      "hotel": { icon: "🏨", priority: "medium" },
      "transport": { icon: "🚃", priority: "medium" },
      "reception": { icon: "🎫", priority: "high" },
      "goal": { icon: "🎯", priority: "low" },
    };

    const showCount = days <= 3 ? 3 : days <= 7 ? 2 : 1;
    unchecked.slice(0, showCount).forEach((item) => {
      const p = priorityMap[item.id] || { icon: "📌", priority: "medium" };
      const noteHint = item.note ? ` — ${item.note}` : "";
      items.push({
        icon: p.icon,
        text: item.label + noteHint,
        priority: days <= 3 ? "high" : p.priority,
      });
    });
  }

  return items;
}

const PRIORITY_STYLES = {
  critical: "bg-red-50 border-red-200 text-red-800",
  high: "bg-orange-50 border-orange-200 text-orange-800",
  medium: "bg-blue-50 border-blue-200 text-blue-800",
  low: "bg-gray-50 border-gray-200 text-gray-700",
};

/**
 * 次の大会カード — 行動ハブ + 準備チェックリスト統合
 */
export default function NextEventCard({ event, status, onStatusChange }) {
  const [showPrep, setShowPrep] = useState(false);
  const [prepProgress, setPrepProgress] = useState(null);
  const [note, setNote] = useState("");

  const reload = useCallback(() => {
    if (!event) return;
    setPrepProgress(getPrepProgress(event.id));
    setNote(getNote(event.id));
  }, [event]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("my-calendar-change", handler);
    return () => window.removeEventListener("my-calendar-change", handler);
  }, [reload]);

  if (!event) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <p className="text-sm text-blue-400 font-medium mb-1">次の大会</p>
        <p className="text-gray-500 text-sm">
          まだ予定がありません。
          <Link href="/search" className="text-blue-600 hover:underline ml-1">
            大会を探す
          </Link>
        </p>
      </div>
    );
  }

  const days = daysUntil(event.event_date);
  const deadlineDays = daysUntil(event.entry_end_date);
  const statusDef = EVENT_STATUSES[status] || EVENT_STATUSES.considering;
  const colors = STATUS_COLORS[status] || STATUS_COLORS.considering;
  const urgency = getUrgencyLevel(days);
  const actionItems = getActionItems(days, status, deadlineDays, prepProgress);

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "未定";

  const deadlineDate = event.entry_end_date
    ? new Date(event.entry_end_date).toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
      })
    : null;

  const bgClass = urgency ? urgency.bg : "from-blue-50 to-indigo-50";
  const borderClass = urgency ? urgency.border : "border-blue-100";

  return (
    <>
      <div className={`bg-gradient-to-br ${bgClass} rounded-2xl p-5 sm:p-6 ${borderClass} border relative overflow-hidden`}>
        {/* 背景装飾 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-full -translate-y-8 translate-x-8" />

        <div className="relative">
          {/* ヘッダー行 */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-blue-500 font-bold tracking-wider uppercase">Next Race</p>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}>
              {statusDef.icon} {statusDef.label}
            </span>
          </div>

          {/* カウントダウン */}
          {days !== null && days >= 0 && (
            <div className="mb-3">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                days <= 3 ? "text-red-600" : days <= 7 ? "text-orange-600" : "text-blue-700"
              }`}>
                {days}
              </span>
              <span className={`text-lg font-bold ml-1 ${
                days <= 3 ? "text-red-500" : days <= 7 ? "text-orange-500" : "text-blue-600"
              }`}>
                {days === 0 ? "今日！" : "日後"}
              </span>
            </div>
          )}

          {/* 大会名 */}
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 line-clamp-2">
            {event.title}
          </h2>

          {/* 情報行 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              {eventDate}
            </span>
            {event.prefecture && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {event.prefecture}
              </span>
            )}
          </div>

          {/* 締切警告 */}
          {deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 && status !== "entered" && (
            <div className={`rounded-lg px-3 py-2 mb-4 text-sm font-medium ${
              deadlineDays === 0
                ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                : deadlineDays <= 3
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-orange-50 text-orange-700 border border-orange-200"
            }`}>
              {deadlineDays === 0
                ? `🚨 エントリー締切：今日まで！見逃す可能性あり`
                : deadlineDays <= 3
                ? `⚠️ エントリー締切：${deadlineDate}（あと${deadlineDays}日）`
                : `📝 エントリー締切：${deadlineDate}（あと${deadlineDays}日）`}
            </div>
          )}

          {/* 準備進捗バー — チェックリスト要約 */}
          {prepProgress && (
            <div className="mb-4 bg-white/60 rounded-xl px-4 py-3 border border-white/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  準備状況
                </span>
                <span className={`text-xs font-bold ${
                  prepProgress.percent === 100 ? "text-green-600" :
                  urgency?.level === "critical" && prepProgress.remaining > 0 ? "text-red-600" :
                  "text-gray-500"
                }`}>
                  {prepProgress.done}/{prepProgress.total}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    prepProgress.percent === 100 ? "bg-green-500" :
                    urgency?.level === "critical" ? "bg-red-500" :
                    urgency?.level === "high" ? "bg-amber-500" :
                    "bg-blue-500"
                  }`}
                  style={{ width: `${prepProgress.percent}%` }}
                />
              </div>
              {prepProgress.percent === 100 ? (
                <p className="text-xs text-green-600 font-bold">✅ 準備完了！</p>
              ) : urgency?.level === "critical" && prepProgress.remaining > 0 ? (
                <p className="text-xs text-red-600 font-bold">
                  ⚠️ まだ{prepProgress.remaining}件未準備
                </p>
              ) : prepProgress.remaining > 0 ? (
                <p className="text-xs text-gray-500">
                  残り{prepProgress.remaining}件 — {prepProgress.items.filter(i => !i.checked).slice(0, 2).map(i => i.label).join(", ")}
                </p>
              ) : null}
              <button
                onClick={() => setShowPrep(true)}
                className={`mt-2 w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                  prepProgress.percent === 100
                    ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                    : urgency?.level === "critical"
                    ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                }`}
              >
                {prepProgress.percent === 100 ? "準備を確認する" :
                 days !== null && days <= 3 ? "最終確認する" :
                 "準備する"}
              </button>
            </div>
          )}

          {/* メモ表示（あれば） */}
          {note && (
            <div className="mb-4 bg-white/50 rounded-lg px-3 py-2 border border-white/70">
              <p className="text-[10px] font-bold text-gray-500 mb-0.5">メモ</p>
              <p className="text-xs text-gray-700 line-clamp-2 whitespace-pre-wrap">{note}</p>
            </div>
          )}

          {/* 今やること */}
          {actionItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                今やること
              </p>
              <div className="space-y-1.5">
                {actionItems.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${PRIORITY_STYLES[item.priority]}`}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* アクションボタン群 */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/marathon/${event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              詳細を見る
            </Link>
            {days !== null && days <= 14 && days >= 0 && event.official_page_url && (
              <a
                href={event.official_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                公式サイト
              </a>
            )}
            {onStatusChange && (
              <select
                value={status || "considering"}
                onChange={(e) => onStatusChange(event.id, e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 hover:border-blue-300 transition-colors"
              >
                {Object.entries(EVENT_STATUSES).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.icon} {def.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 準備チェックリスト展開 */}
      {showPrep && (
        <div className="mt-3">
          <PrepChecklist
            eventId={event.id}
            eventTitle={event.title}
            eventDate={event.event_date}
            mode="full"
            onClose={() => setShowPrep(false)}
            onChange={reload}
          />
        </div>
      )}
    </>
  );
}
