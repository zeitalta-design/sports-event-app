"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toggleCompareId, isCompared } from "@/lib/compare-utils";
import { removeSavedId } from "@/lib/saved-events-storage";
import StatusBadge from "@/components/my-events/StatusBadge";
import EventStatusSelector from "@/components/my-events/EventStatusSelector";
import NextActionHint from "@/components/my-events/NextActionHint";
import { getEventStatus, removeEventStatus } from "@/lib/my-events-manager";
import EventMemoPanel from "@/components/my-events/EventMemoPanel";

/**
 * Phase61: マイ大会カード
 *
 * 保存済み/比較中/見直し推奨の大会1件を表示するカード。
 * アクション（比較追加/解除、保存解除、詳細）を含む。
 */

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${dow})`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  if (isNaN(target.getTime())) return null;
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

const SPORT_LABELS = {
  marathon: "マラソン",
  trail: "トレイル",
};

export default function MyEventCard({ event, onRemove, showSaveAction = true, topAlert = null, showStatusControl = false }) {
  const [compared, setCompared] = useState(isCompared(event.id));
  const [showToast, setShowToast] = useState("");
  const [myStatus, setMyStatus] = useState(() => getEventStatus(event.id));
  const [statusOpen, setStatusOpen] = useState(false);

  const path = event.path || (
    event.sport_slug === "marathon"
      ? `/marathon/${event.id}`
      : `/${event.sport_slug}/${event.id}`
  );

  const location = [event.prefecture, event.city].filter(Boolean).join(" ");
  const dateStr = formatShortDate(event.event_date);
  const sportLabel = SPORT_LABELS[event.sport_slug] || event.sport_slug;

  // 締切/開催までの日数
  const daysDeadline = daysUntil(event.entry_end_date);
  const daysEvent = daysUntil(event.event_date);

  const handleToggleCompare = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompareId(event.id);
    if (result.full) {
      setShowToast("比較は最大3件までです");
      setTimeout(() => setShowToast(""), 2500);
      return;
    }
    setCompared(result.added);
  }, [event.id]);

  const handleRemoveSaved = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    removeSavedId(event.id);
    if (onRemove) onRemove(event.id);
  }, [event.id, onRemove]);

  return (
    <div className="card p-4 hover:shadow-md transition-shadow relative">
      {/* 上段: タイトル + バッジ */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <Link
            href={path}
            className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2 leading-snug"
          >
            {event.title}
          </Link>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showStatusControl && myStatus && (
            <StatusBadge status={myStatus} size="xs" />
          )}
          {!showStatusControl && event.isSaved && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-600 border border-amber-200">
              保存中
            </span>
          )}
          {!showStatusControl && event.isCompared && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-600 border border-blue-200">
              比較中
            </span>
          )}
        </div>
      </div>

      {/* メタ情報 */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
        <span className="text-gray-400">{sportLabel}</span>
        {dateStr && <span>{dateStr}</span>}
        {location && <span>{location}</span>}
        {event.entry_status === "open" && (
          <span className="text-green-600 font-medium">受付中</span>
        )}
        {event.entry_status === "closed" && (
          <span className="text-gray-400">受付終了</span>
        )}
      </div>

      {/* 簡易注意表示 */}
      {topAlert && (
        <div className={`text-xs mb-2 px-2 py-1 rounded ${
          topAlert.level === "high"
            ? "bg-red-50 text-red-600"
            : topAlert.level === "medium"
              ? "bg-amber-50 text-amber-600"
              : "bg-blue-50 text-blue-600"
        }`}>
          {topAlert.label}
          {topAlert.note && <span className="text-gray-500 ml-1">{topAlert.note}</span>}
        </div>
      )}

      {/* 締切/開催日インジケーター */}
      {!topAlert && (
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
          {daysDeadline !== null && daysDeadline > 0 && daysDeadline <= 30 && event.entry_status === "open" && (
            <span className={daysDeadline <= 7 ? "text-red-500 font-medium" : ""}>
              締切まで{daysDeadline}日
            </span>
          )}
          {daysEvent !== null && daysEvent > 0 && daysEvent <= 30 && (
            <span className={daysEvent <= 7 ? "text-amber-600 font-medium" : ""}>
              開催まで{daysEvent}日
            </span>
          )}
        </div>
      )}

      {/* Phase100: ステータス変更 */}
      {showStatusControl && statusOpen && (
        <div className="mb-2">
          <EventStatusSelector
            eventId={event.id}
            currentStatus={myStatus}
            onStatusChange={(s) => { setMyStatus(s); setStatusOpen(false); }}
          />
        </div>
      )}

      {/* Phase100: 次アクション */}
      {showStatusControl && myStatus && !statusOpen && (
        <div className="mb-2">
          <NextActionHint status={myStatus} event={event} />
        </div>
      )}

      {/* アクション */}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-100">
        <Link
          href={path}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          詳細を見る
        </Link>
        <button
          onClick={handleToggleCompare}
          className={`text-xs transition-colors ${
            compared
              ? "text-blue-600 hover:text-blue-800"
              : "text-gray-400 hover:text-blue-600"
          }`}
        >
          {compared ? "比較中" : "比較に追加"}
        </button>
        {showStatusControl && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusOpen(!statusOpen); }}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            {statusOpen ? "閉じる" : "状態変更"}
          </button>
        )}
        {showSaveAction && event.isSaved && (
          <button
            onClick={handleRemoveSaved}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
          >
            保存解除
          </button>
        )}
      </div>

      {/* Phase101: メモパネル（エントリー済み or 出場予定の場合） */}
      {showStatusControl && (myStatus === "entered" || myStatus === "planned") && (
        <EventMemoPanel eventId={event.id} />
      )}

      {/* トースト */}
      {showToast && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50">
          {showToast}
        </div>
      )}
    </div>
  );
}
