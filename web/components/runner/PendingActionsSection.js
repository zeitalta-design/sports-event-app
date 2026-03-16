"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getEventIdsByStatus } from "@/lib/my-events-manager";
import { getSavedIds } from "@/lib/saved-events-storage";
import { buildEventAlertCandidates } from "@/lib/event-alert-candidates";
import { getEventDetailPath } from "@/lib/sport-config";

/**
 * Phase103: 要対応アクション
 *
 * 高アラート大会 + needs_check ステータス大会の統合表示。
 */

export default function PendingActionsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingActions();

    function onChange() {
      loadPendingActions();
    }
    window.addEventListener("saved-change", onChange);
    window.addEventListener("my-events-status-change", onChange);
    return () => {
      window.removeEventListener("saved-change", onChange);
      window.removeEventListener("my-events-status-change", onChange);
    };
  }, []);

  async function loadPendingActions() {
    setLoading(true);
    try {
      const needsCheckIds = getEventIdsByStatus("needs_check");
      const savedIds = getSavedIds();
      const allIds = [...new Set([...needsCheckIds, ...savedIds])];

      if (allIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/events/by-ids?ids=${allIds.join(",")}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const events = data.events || [];

      const pending = [];
      const needsCheckSet = new Set(needsCheckIds);

      for (const ev of events) {
        const candidate = buildEventAlertCandidates(ev);
        const isHighAlert =
          candidate.alerts.length > 0 &&
          candidate.alerts.some((a) => a.level === "high");
        const isNeedsCheck = needsCheckSet.has(ev.id);

        if (isHighAlert || isNeedsCheck) {
          pending.push({
            ...ev,
            reason: isHighAlert
              ? candidate.alerts.find((a) => a.level === "high")?.label || "要確認"
              : "状態を確認してください",
          });
        }
      }

      // 最大5件
      setItems(pending.slice(0, 5));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-3">
        <span>⚠️</span> 要対応
        <span className="text-xs font-normal text-gray-400">
          ({items.length})
        </span>
      </h2>
      <div className="space-y-2">
        {items.map((item) => {
          const href =
            item.path || getEventDetailPath(item) || `/marathon/${item.id}`;
          return (
            <Link
              key={item.id}
              href={href}
              className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <span className="text-base flex-shrink-0">🔴</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-1">
                  {item.title}
                </p>
                <p className="text-xs text-red-600 mt-0.5">{item.reason}</p>
              </div>
              <span className="text-xs text-blue-600 flex-shrink-0">→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
