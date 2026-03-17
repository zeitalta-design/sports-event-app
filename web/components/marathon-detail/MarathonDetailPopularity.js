"use client";
import { useState, useEffect } from "react";
import PopularityBadge from "@/components/PopularityBadge";

/**
 * Phase46: 大会詳細ページ — 人気指数パネル
 *
 * サイドバーに配置。APIから人気指数を非同期取得して表示。
 */
export default function MarathonDetailPopularity({ eventId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/popularity`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [eventId]);

  if (!data || data.popularity_score === 0) return null;

  const score = data.popularity_score;
  const label = data.popularity_label;
  const key = data.popularity_key;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3">
        人気指数
      </h3>

      {/* スコアバー */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-2xl font-extrabold text-gray-900">
            {score}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${score}%`,
              backgroundColor:
                score >= 80
                  ? "#ef4444"
                  : score >= 60
                    ? "#f97316"
                    : score >= 40
                      ? "#3b82f6"
                      : "#9ca3af",
            }}
          />
        </div>
      </div>

      {/* バッジ */}
      {label && (
        <div className="mb-3">
          <PopularityBadge score={score} label={label} popularityKey={key} size="md" />
        </div>
      )}

      {/* 内訳 */}
      <div className="space-y-1.5 text-xs text-gray-800">
        <div className="flex justify-between">
          <span>閲覧数（30日）</span>
          <span className="font-medium">{data.detail_views_30d || 0}</span>
        </div>
        <div className="flex justify-between">
          <span>お気に入り追加（30日）</span>
          <span className="font-medium">{data.favorites_30d || 0}</span>
        </div>
        <div className="flex justify-between">
          <span>エントリークリック（30日）</span>
          <span className="font-medium">{data.entry_clicks_30d || 0}</span>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-gray-500 leading-relaxed">
        ※ 人気指数はユーザーの閲覧・お気に入り・エントリークリック数から算出しています
      </p>
    </div>
  );
}
