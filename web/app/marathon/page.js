"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import EventCard from "@/components/EventCard";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
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
  { key: "entry_status_priority", label: "募集状況優先" },
  { key: "newest", label: "新着順" },
  { key: "popularity", label: "人気順" },
];

const ENTRY_STATUS_OPTIONS = [
  { key: "", label: "すべて" },
  { key: "open", label: "受付中" },
  { key: "upcoming", label: "受付予定" },
];

export default function MarathonListPage() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [saveMsg, setSaveMsg] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState({
    keyword: "",
    prefecture: "",
    month: "",
    distance: "",
    entry_status: "",
    sort: "event_date",
  });

  // 初回マウント: URLパラメータを読み取り→filtersにセット→即座にfetch
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initFilters = { ...filters };
    if (params.get("keyword")) initFilters.keyword = params.get("keyword");
    if (params.get("prefecture")) initFilters.prefecture = params.get("prefecture");
    if (params.get("month")) initFilters.month = params.get("month");
    if (params.get("distance")) initFilters.distance = params.get("distance");
    setFilters(initFilters);
    // 初回fetchはURL paramsから構築したfiltersで直接実行（stateの反映を待たない）
    fetchEventsWithFilters(initFilters, 1);
    setFiltersReady(true);
  }, []);

  // フィルタ変更時: ready後のみ（初回はスキップ）
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!filtersReady) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // 初回は上のuseEffectで既にfetch済み
    }
    setPage(1);
    fetchEventsWithFilters(filters, 1);
  }, [filters]);

  // ページ変更時
  useEffect(() => {
    if (!filtersReady || isFirstRender.current) return;
    fetchEventsWithFilters(filters, page);
  }, [page]);

  useEffect(() => {
    fetchFavoriteIds();
  }, []);

  async function fetchEventsWithFilters(f, p) {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ sport_type: "marathon", page: String(p || 1) });
      if (f.keyword) params.set("keyword", f.keyword);
      if (f.prefecture) params.set("prefecture", f.prefecture);
      if (f.month) params.set("month", f.month);
      if (f.distance) params.set("distance", f.distance);
      if (f.entry_status) params.set("entry_status", f.entry_status);
      if (f.sort) params.set("sort", f.sort);

      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(true);
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

  const hasFilters = filters.keyword || filters.prefecture || filters.month || filters.distance || filters.entry_status;
  const allPrefectures = REGIONS.flatMap((r) => r.prefectures);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">マラソン大会一覧</h1>
      <p className="text-sm text-gray-600 mb-6">全国のマラソン大会を検索</p>

      {/* フィルター */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">キーワード</label>
            <input
              type="text"
              placeholder="大会名・会場名"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">都道府県</label>
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
            <label className="block text-xs font-bold text-gray-700 mb-1">開催月</label>
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
            <label className="block text-xs font-bold text-gray-700 mb-1">距離</label>
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
            <label className="block text-xs font-bold text-gray-700 mb-1">募集状況</label>
            <select
              value={filters.entry_status}
              onChange={(e) => setFilters({ ...filters, entry_status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ENTRY_STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">並び順</label>
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
          <p className="text-xs text-gray-500">
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
      ) : error ? (
        <div className="card">
          <ErrorState onRetry={fetchEvents} />
        </div>
      ) : events.length === 0 ? (
        <div className="card">
          <EmptyState
            preset="search"
            cta={{ label: "条件をリセットして検索", href: "/marathon" }}
            secondaryCta={{ label: "人気の大会を見る", href: "/popular" }}
          />
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
      <div className="mt-10 pt-8 border-t border-gray-100 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">距離から探す</h2>
          <div className="flex flex-wrap gap-2">
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
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">地方から探す</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "北海道", href: "/marathon/region/hokkaido" },
              { label: "東北", href: "/marathon/region/tohoku" },
              { label: "関東", href: "/marathon/region/kanto" },
              { label: "中部", href: "/marathon/region/chubu" },
              { label: "近畿", href: "/marathon/region/kinki" },
              { label: "中国", href: "/marathon/region/chugoku" },
              { label: "四国", href: "/marathon/region/shikoku" },
              { label: "九州・沖縄", href: "/marathon/region/kyushu" },
            ].map((link) => (
              <a key={link.href} href={link.href}
                 className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                            rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">目的から探す</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "初心者向け", href: "/marathon/theme/beginner" },
              { label: "記録狙い", href: "/marathon/theme/record" },
              { label: "観光ラン", href: "/marathon/theme/sightseeing" },
              { label: "フラットコース", href: "/marathon/theme/flat-course" },
              { label: "募集中", href: "/marathon/theme/open" },
              { label: "締切間近", href: "/marathon/theme/deadline" },
              { label: "人気の大会", href: "/marathon/theme/popular" },
            ].map((link) => (
              <a key={link.href} href={link.href}
                 className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                            rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">季節から探す</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "春（3〜5月）", href: "/marathon/season/spring" },
              { label: "夏（6〜8月）", href: "/marathon/season/summer" },
              { label: "秋（9〜11月）", href: "/marathon/season/autumn" },
              { label: "冬（12〜2月）", href: "/marathon/season/winter" },
            ].map((link) => (
              <a key={link.href} href={link.href}
                 className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                            rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs pt-2">
          <a href="/marathon/prefecture" className="text-blue-600 hover:text-blue-800 hover:underline">都道府県別一覧 →</a>
          <a href="/marathon/distance" className="text-blue-600 hover:text-blue-800 hover:underline">距離別一覧 →</a>
          <a href="/marathon/month" className="text-blue-600 hover:text-blue-800 hover:underline">月別一覧 →</a>
          <a href="/marathon/region" className="text-blue-600 hover:text-blue-800 hover:underline">地方別一覧 →</a>
          <a href="/marathon/season" className="text-blue-600 hover:text-blue-800 hover:underline">季節別一覧 →</a>
          <a href="/marathon/theme" className="text-blue-600 hover:text-blue-800 hover:underline">テーマ別一覧 →</a>
        </div>
      </div>
    </div>
  );
}
