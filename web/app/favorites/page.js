"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { getEventDetailPath } from "@/lib/sport-config";

function formatDate(dateStr) {
  if (!dateStr) return "日程未定";
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "締切済み", level: "past", diffDays };
  if (diffDays === 0) return { text: "本日締切！", level: "today", diffDays };
  if (diffDays <= 3) return { text: `あと${diffDays}日`, level: "critical", diffDays };
  if (diffDays <= 7) return { text: `あと${diffDays}日`, level: "warning", diffDays };
  return { text: `${deadline.getMonth() + 1}/${deadline.getDate()}まで`, level: "normal", diffDays };
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const styles = {
    today: "bg-red-500 text-white",
    critical: "bg-red-100 text-red-700",
    warning: "bg-orange-100 text-orange-700",
    past: "bg-gray-100 text-gray-500",
    normal: "",
  };
  if (deadline.level === "normal") {
    return <span className="text-xs text-gray-500">締切: {deadline.text}</span>;
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${styles[deadline.level]}`}>
      {deadline.level === "today" || deadline.level === "critical" || deadline.level === "warning"
        ? `締切${deadline.text}`
        : deadline.text}
    </span>
  );
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setFavorites(data.favorites || []);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(eventId) {
    try {
      const res = await fetch(`/api/favorites/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        setFavorites((f) => f.filter((x) => x.id !== eventId));
      }
    } catch (err) {
      console.error(err);
    }
  }

  const urgentCount = favorites.filter((ev) => {
    const dl = formatDeadline(ev.entry_end_date);
    return dl && (dl.level === "today" || dl.level === "critical" || dl.level === "warning");
  }).length;

  return (
    <AuthGuard>
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">お気に入り</h1>
      <p className="text-sm text-gray-500 mb-6">気になる大会をウォッチ・締切が近づくと通知されます</p>

      {/* 締切近い大会サマリー */}
      {!loading && urgentCount > 0 && (
        <div className="card p-4 mb-6 border-l-4 border-red-500 bg-red-50">
          <p className="text-sm font-medium text-red-700">
            締切7日以内の大会が {urgentCount}件 あります
          </p>
          <p className="text-xs text-red-500 mt-1">エントリーをお忘れなく</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card">
          <ErrorState onRetry={fetchFavorites} />
        </div>
      ) : favorites.length === 0 ? (
        <div className="card">
          <EmptyState preset="favorites" />
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((ev) => {
            const deadline = formatDeadline(ev.entry_end_date);
            const isUrgent = deadline && (deadline.level === "today" || deadline.level === "critical");
            return (
              <div
                key={ev.id}
                className={`card p-4 flex items-center justify-between gap-3 ${
                  isUrgent ? "ring-1 ring-red-200 bg-red-50/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={getEventDetailPath(ev)} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                      {ev.title}
                    </Link>
                    {deadline && (deadline.level === "today" || deadline.level === "critical" || deadline.level === "warning") && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded">通知対象</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{formatDate(ev.event_date)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{ev.prefecture || "未定"}</span>
                    <span className="text-gray-300">|</span>
                    <DeadlineBadge deadline={deadline} />
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(ev.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg"
                >
                  解除
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
