"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCategoryLabel } from "@/lib/saas-config";

function formatFilters(filtersJson) {
  try {
    const f = JSON.parse(filtersJson || "{}");
    const parts = [];
    if (f.category) parts.push(`カテゴリ: ${getCategoryLabel(f.category)}`);
    if (f.keyword) parts.push(`キーワード: ${f.keyword}`);
    if (f.price_range) parts.push(`価格帯: ${f.price_range}`);
    if (f.company_size) parts.push(`企業規模: ${f.company_size}`);
    if (f.has_free_plan) parts.push("無料プランあり");
    if (f.has_free_trial) parts.push("トライアルあり");
    return parts.length > 0 ? parts.join(" / ") : "条件なし";
  } catch {
    return "—";
  }
}

function buildSearchUrl(filtersJson) {
  try {
    const f = JSON.parse(filtersJson || "{}");
    const params = new URLSearchParams();
    if (f.category) params.set("category", f.category);
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.price_range) params.set("price_range", f.price_range);
    if (f.company_size) params.set("company_size", f.company_size);
    if (f.has_free_plan) params.set("has_free_plan", "1");
    if (f.has_free_trial) params.set("has_free_trial", "1");
    return `/saas?${params.toString()}`;
  } catch {
    return "/saas";
  }
}

export default function SaasSavedSearchesPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/item-saved-searches");
        const data = await res.json();
        setSearches(data.searches || []);
      } catch {
        setSearches([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function deleteSearch(id) {
    await fetch(`/api/item-saved-searches/${id}`, { method: "DELETE" });
    setSearches((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">保存した検索条件</h1>
      <p className="text-sm text-gray-500 mb-6">保存した検索条件をすぐに呼び出せます</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2" /></div>
          ))}
        </div>
      ) : searches.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">保存された検索条件はありません</p>
          <Link href="/saas" className="btn-primary inline-block">ツール一覧で検索する</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s) => (
            <div key={s.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{s.name || "保存検索"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatFilters(s.filters_json)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={buildSearchUrl(s.filters_json)}
                  className="btn-primary text-xs"
                >
                  検索実行
                </Link>
                <button
                  onClick={() => deleteSearch(s.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
