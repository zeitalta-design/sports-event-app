"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ResultsPrivacyNote from "@/components/ResultsPrivacyNote";
import SnsShareButtons from "@/components/SnsShareButtons";

/**
 * Phase149: 大会結果一覧ページコンポーネント
 *
 * /marathon/[id]/results, /[sportSlug]/[id]/results 共通。
 * 匿名化済みの結果のみ表示。個人名は一切表示しない。
 */

const FINISH_STATUS_LABELS = {
  finished: { label: "完走", color: "text-green-600" },
  dnf: { label: "DNF", color: "text-red-500" },
  dns: { label: "DNS", color: "text-gray-400" },
  dq: { label: "DQ", color: "text-red-600" },
};

export default function ResultsListPage({ eventId, eventTitle, backPath, heroPhotoUrl, photosPath, availableYears = [] }) {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [years, setYears] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    loadResults();
  }, [selectedYear, selectedCategory, offset]);

  async function loadResults() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ event_id: String(eventId), limit: String(LIMIT), offset: String(offset) });
      if (selectedYear) params.set("year", selectedYear);
      if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`/api/results?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
      setYears(data.years || []);
      setCategories(data.categories || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Failed to load results:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleYearChange(year) {
    setSelectedYear(year);
    setSelectedCategory("");
    setOffset(0);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href={backPath} className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← 大会ページに戻る
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900">
            {eventTitle ? `${eventTitle} の大会結果` : "大会結果"}
          </h1>
          <SnsShareButtons url={typeof window !== "undefined" ? window.location.href : ""} title={eventTitle ? `${eventTitle} の大会結果` : "大会結果"} compact />
        </div>
        {total > 0 && (
          <p className="text-sm text-gray-500 mt-1">{total}件の記録</p>
        )}
      </div>

      {/* Phase163: 大会写真バナー */}
      {heroPhotoUrl && (
        <div className="mb-6 relative rounded-xl overflow-hidden" style={{ aspectRatio: "21/6" }}>
          <img src={heroPhotoUrl} alt={eventTitle || "大会写真"} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {photosPath && (
            <Link
              href={photosPath}
              className="absolute bottom-2 right-2 text-[10px] text-white/80 hover:text-white bg-black/30 px-2 py-1 rounded transition-colors"
            >
              📸 写真をもっと見る
            </Link>
          )}
        </div>
      )}

      {/* サマリーカード */}
      {summary && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.finisher_count}</p>
              <p className="text-xs text-gray-500">完走者数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.completion_rate}%</p>
              <p className="text-xs text-gray-500">完走率</p>
            </div>
            {summary.fastest_time && (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{summary.fastest_time}</p>
                <p className="text-xs text-gray-500">最速タイム</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              <p className="text-xs text-gray-500">エントリー総数</p>
            </div>
          </div>

          {/* カテゴリ別 */}
          {summary.categories?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">カテゴリ別</p>
              <div className="flex flex-wrap gap-2">
                {summary.categories.map((cat) => (
                  <span key={cat.category_name} className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded">
                    {cat.category_name}: {cat.finished}/{cat.count}人完走
                    {cat.fastest && <span className="text-gray-400 ml-1">({cat.fastest})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {years.length > 1 && (
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
          >
            <option value="">全年度</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        )}
        {categories.length > 1 && (
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setOffset(0); }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
          >
            <option value="">全カテゴリ</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-gray-400 ml-auto">{total}件</span>
      </div>

      {/* 結果テーブル */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : results.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🏃</p>
          <p className="text-sm text-gray-400">結果データはまだありません</p>
        </div>
      ) : (
        <>
          {/* プライバシーノート */}
          <p className="text-[10px] text-gray-400 mb-3">
            ※ プライバシー保護のため、個人名は表示していません。ゼッケン番号で自分の記録を確認できます。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 w-14">順位</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 w-20">ゼッケン</th>
                  {!selectedCategory && (
                    <th className="py-2 pr-3 text-xs font-medium text-gray-500">カテゴリ</th>
                  )}
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 w-24">タイム</th>
                  <th className="py-2 pr-3 text-xs font-medium text-gray-500 w-24">ネット</th>
                  <th className="py-2 text-xs font-medium text-gray-500 w-14">状態</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const status = FINISH_STATUS_LABELS[r.finish_status] || FINISH_STATUS_LABELS.finished;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3 tabular-nums text-gray-700 font-medium">
                        {r.overall_rank || "-"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-gray-600">
                        {r.bib_number || "-"}
                      </td>
                      {!selectedCategory && (
                        <td className="py-2.5 pr-3 text-gray-500 text-xs">
                          {r.category_name || "-"}
                        </td>
                      )}
                      <td className="py-2.5 pr-3 tabular-nums text-gray-700">
                        {r.finish_time || "-"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-gray-500">
                        {r.net_time || "-"}
                      </td>
                      <td className={`py-2.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                前へ
              </button>
              <span className="text-xs text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {/* Phase176: 年度ナビゲーション（SEO用内部リンク） */}
      {availableYears.length > 1 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">年度別の結果</p>
          <div className="flex flex-wrap gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => handleYearChange(String(year))}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedYear === String(year)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                }`}
              >
                {year}年
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 関連ページ内部リンク */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href={backPath} className="text-blue-600 hover:text-blue-800">大会詳細</Link>
        {photosPath && <Link href={photosPath} className="text-blue-600 hover:text-blue-800">大会写真</Link>}
      </div>

      {/* Phase156: プライバシーポリシー */}
      <div className="mt-8">
        <ResultsPrivacyNote variant="public" />
      </div>
    </div>
  );
}
