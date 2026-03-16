/**
 * Phase82: 状態変化タイムライン
 *
 * 大会の募集状態の変遷を時系列で表示するコンポーネント。
 * 詳細ページやモーダルで使用。
 */

"use client";

import { useState, useEffect } from "react";
import { getOfficialStatusDef } from "@/lib/official-status-defs";

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatusTimeline({ eventId, maxItems = 10 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/status-history`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="text-xs text-gray-400 py-2">読み込み中...</div>
    );
  }

  if (!data || !data.changes || data.changes.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">状態変化の記録はありません</div>
    );
  }

  const changes = data.changes.slice(0, maxItems);

  return (
    <div className="space-y-0">
      {/* 現在のステータス */}
      {data.current?.official_entry_status && (
        <div className="flex items-start gap-3 pb-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-200" />
            <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
          </div>
          <div className="flex-1 min-w-0 -mt-0.5">
            <div className="flex items-center gap-2">
              <StatusPill status={data.current.official_entry_status} label={data.current.official_entry_status_label} />
              <span className="text-xs text-gray-400">現在</span>
            </div>
            {data.current.official_checked_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                最終確認: {formatTimeAgo(data.current.official_checked_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 変化履歴 */}
      {changes.map((change, i) => (
        <div key={change.id} className="flex items-start gap-3 pb-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-1 ring-gray-200" />
            {i < changes.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
          </div>
          <div className="flex-1 min-w-0 -mt-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <StatusPill status={change.previous_status} label={change.previous_label} size="sm" />
              <span className="text-gray-400 text-xs">→</span>
              <StatusPill status={change.new_status} label={change.new_label} size="sm" />
              <span className="text-xs text-gray-400 ml-auto shrink-0">
                {formatDateTime(change.created_at)}
              </span>
            </div>
            {change.note && (
              <p className="text-xs text-gray-400 mt-0.5 italic">{change.note}</p>
            )}
            {change.detected_signals && change.detected_signals.length > 0 && (
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {change.detected_signals.map((sig, j) => (
                  <span key={j} className="text-xs px-1 py-0 bg-gray-100 text-gray-500 rounded">
                    {sig}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {data.changes.length > maxItems && (
        <p className="text-xs text-gray-400 text-center pt-1">
          他 {data.changes.length - maxItems} 件の変化
        </p>
      )}
    </div>
  );
}

function StatusPill({ status, label, size = "md" }) {
  const def = getOfficialStatusDef(status);
  const sizeClass = size === "sm" ? "px-1.5 py-0 text-xs" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded ${sizeClass} font-medium ${def.className}`}>
      {label || def.label}
    </span>
  );
}
