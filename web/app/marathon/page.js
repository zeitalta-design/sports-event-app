"use client";
import { useState, useEffect, useCallback } from "react";
import EventCard from "@/components/EventCard";
import { REGIONS, MONTHS } from "@/lib/constants";

const DISTANCES = [
  { key: "", label: "すべて" },
  { key: "5", label: "〜5km" },
  { key: "10", label: "〜10km" },
  { key: "half", label: "ハーフ" },
  { key: "full", label: "フル" },
  { key: "ultra", label: "ウルトラ" },
];

const SORT_OPTIONS = [
  { key: "event_date", label: "開催日順" },
  { key: "entry_end_date", label: "締切日順" },
  { key: "newest", label: "新着順" },
  { key: "popularity", label: "人気順" },
];

export default function MarathonListPage() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [saveMsg, setSaveMsg] = useState("");
  const [filters, setFilters] = useState({
    keyword: "",
    prefecture: "",
    month: "",
    distance: "",
    sort: "event_date",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const updates = {};
    if (params.get("keyword")) updates.keyword = params.get("keyword");
    if (params.get("prefecture")) updates.prefecture = params.get("prefecture");
    if (params.get("month")) updates.month = params.get("month");
    if (params.get("distance")) updates.distance = params.get("distance");
    if (Object.keys(updates).length > 0) {
      setFilters((f) => ({ ...f, ...updates }));
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    fetchEvents();
  }, [filters, page]);

  useEffect(() => {
    fetchFavoriteIds();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sport_type: "marathon", page: String(page) });
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.prefecture) params.set("prefecture", filters.prefecture);
      if (filters.month) params.set("month", filters.month);
      if (filters.distance) params.set("distance", filters.distance);
      if (filters.sort) params.set("sort", filters.sort);

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFavoriteIds() {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      setFavoriteIds(new Set(data.ids || []));
    } catch {}
  }

  const handleFavoriteToggle = useCallback(async (eventId) => {
    const isFav = favoriteIds.has(eventId);
    try {
      if (isFav) {
        await fetch(`/api/favorites/${eventId}`, { method: "DELETE" });
        setFavoriteIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
        });
        setFavoriteIds((prev) => new Set(prev).add(eventId));
      }
    } catch (err) {
      console.error(err);
    }
  }, [favoriteIds]);

  async function handleSaveSearch() {
    const { keyword, prefecture, month, distance } = filters;
    if (!keyword && !prefecture && !month && !distance) {
      setSaveMsg("条件を指定してください");
      setTimeout(() => setSaveMsg(""), 3000);
      return;
    }
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, prefecture, event_month: month, distance }),
      });
      if (res.ok) {
        setSaveMsg("保存しました");
      } else {
        const data = await res.json();
        setSaveMsg(data.error || "保存に失敗");
      }
    } catch {
      setSaveMsg("保存に失敗");
    }
    setTimeout(() => setSaveMsg(""), 3000);
  }

  const hasFilters = filters.keyword || filters.prefecture || filters.month || filters.distance;
  const allPrefectures = REGIONS.flatMap((r) => r.prefectures);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">マラソン大会一覧</h1>
      <p className="text-sm text-gray-500 mb-6">全国のマラソン大会を検索</p>

      {/* フィルター */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">キーワード</label>
            <input
              type="text"
              placeholder="大会名・会場名"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">都道府県</label>
            <select
              value={filters.prefecture}
              onChange={(e) => setFilters({ ...filters, prefecture: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {allPrefectures.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">開催月</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {MONTHS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">距離</label>
            <select
              value={filters.distance}
              onChange={(e) => setFilters({ ...filters, distance: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DISTANCES.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">並び順</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        {/* 条件保存 */}
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleSaveSearch}
              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
            >
              この条件を保存
            </button>
            {saveMsg && (
              <span className={`text-xs ${saveMsg.includes("失敗") || saveMsg.includes("指定") ? "text-red-500" : "text-green-600"}`}>
                {saveMsg}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 件数 + ページ情報 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {loading ? "読み込み中..." : `${total}件の大会`}
        </p>
        {!loading && totalPages > 1 && (
          <p className="text-xs text-gray-400">
            {page} / {totalPages} ページ
          </p>
        )}
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-48 md:w-56 h-40 sm:h-[200px] bg-gray-200 rounded-t-lg sm:rounded-t-none sm:rounded-l-lg" />
                <div className="flex-1 p-4">
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-5 bg-gray-200 rounded w-4/5 mb-2" />
                  <div className="flex gap-2 mb-3">
                    <div className="h-5 bg-gray-200 rounded w-12" />
                    <div className="h-5 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">該当する大会が見つかりませんでした</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isFavorite={favoriteIds.has(event.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                前へ
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      page === pageNum
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {/* SEO内部リンク */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">条件から探す</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: "フルマラソン", href: "/marathon/distance/full" },
            { label: "ハーフマラソン", href: "/marathon/distance/half" },
            { label: "10km", href: "/marathon/distance/10km" },
            { label: "5km以下", href: "/marathon/distance/5km" },
            { label: "ウルトラ", href: "/marathon/distance/ultra" },
          ].map((link) => (
            <a key={link.href} href={link.href}
               className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                          rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: "東京都", href: "/marathon/prefecture/tokyo" },
            { label: "大阪府", href: "/marathon/prefecture/osaka" },
            { label: "神奈川県", href: "/marathon/prefecture/kanagawa" },
            { label: "千葉県", href: "/marathon/prefecture/chiba" },
            { label: "埼玉県", href: "/marathon/prefecture/saitama" },
            { label: "福岡県", href: "/marathon/prefecture/fukuoka" },
          ].map((link) => (
            <a key={link.href} href={link.href}
               className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                          rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <a href="/marathon/prefecture" className="text-blue-600 hover:text-blue-800 hover:underline">
            都道府県別一覧 →
          </a>
          <a href="/marathon/distance" className="text-blue-600 hover:text-blue-800 hover:underline">
            距離別一覧 →
          </a>
          <a href="/marathon/month" className="text-blue-600 hover:text-blue-800 hover:underline">
            月別一覧 →
          </a>
        </div>
      </div>
    </div>
  );
}
