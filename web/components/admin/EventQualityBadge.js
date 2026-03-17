"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase216: イベント品質バッジ + admin導線
 *
 * 管理者のみ表示。品質スコア + 改善提案へのリンク
 */

export default function EventQualityBadge({ eventId }) {
  const { user } = useAuthStatus();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user?.is_admin || !eventId) return;
    fetch(`/api/admin/quality/suggestions?event_id=${eventId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [user, eventId]);

  if (!user?.is_admin || !data?.qualityScore) return null;

  const qs = data.qualityScore;
  const colors = {
    A: "bg-emerald-100 text-emerald-700 border-emerald-200",
    B: "bg-blue-100 text-blue-700 border-blue-200",
    C: "bg-amber-100 text-amber-700 border-amber-200",
    D: "bg-orange-100 text-orange-700 border-orange-200",
    E: "bg-red-100 text-red-700 border-red-200",
  };

  const sugCount = data.suggestions?.length || 0;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${colors[qs.grade] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      <span className="font-bold">品質 {qs.grade}</span>
      <span className="tabular-nums">{qs.score}点</span>
      {sugCount > 0 && (
        <span className="text-[10px] opacity-75">{sugCount}件の改善候補</span>
      )}
      <Link
        href={`/admin/quality`}
        className="text-[10px] underline opacity-60 hover:opacity-100"
      >
        管理画面
      </Link>
    </div>
  );
}
