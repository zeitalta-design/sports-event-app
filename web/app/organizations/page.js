"use client";

/**
 * 企業一覧ページ（cross-domain ハブへの入口）
 *
 * - keyword / corp で検索
 * - 各ドメイン件数バッジ + 詳細ページへのリンク
 *
 * ポリシー: 重い集計は載せない。件数バッジ + リンクだけ。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Pagination from "@/components/search/Pagination";

const PAGE_SIZE = 20;

const DOMAIN_BADGES = [
  { key: "nyusatsu",      label: "入札",   color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "hojokin",       label: "補助金", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "kyoninka",      label: "許認可", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { key: "gyosei_shobun", label: "行政処分", color: "bg-red-50 text-red-700 border-red-200" },
  { key: "sanpai",        label: "産廃",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

function CountBadges({ counts }) {
  if (!counts) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {DOMAIN_BADGES.map((b) => {
        const n = counts[b.key] || 0;
        if (n === 0) return null;
        return (
          <span
            key={b.key}
            className={`text-xs px-1.5 py-0.5 rounded border ${b.color}`}
          >
            {b.label} {n}
          </span>
        );
      })}
    </div>
  );
}

function OrganizationCard({ org }) {
  const title = org.display_name || org.normalized_name;
  const loc = [org.prefecture, org.city].filter(Boolean).join(" ");
  return (
    <Link
      href={`/organizations/${org.id}`}
      className="block card p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {org.corporate_number && (
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                {org.corporate_number}
              </span>
            )}
            {loc && <span>📍 {loc}</span>}
            {org.source && (
              <span className="text-gray-400">初出: {org.source}</span>
            )}
          </div>
          <CountBadges counts={org.counts} />
        </div>
        <span className="text-xs text-blue-600 shrink-0 mt-1">→</span>
      </div>
    </Link>
  );
}

export default function OrganizationListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "",
    corp: searchParams.get("corp") || "",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  });
  const [formInput, setFormInput] = useState({
    keyword: filters.keyword,
    corp: filters.corp,
  });

  const syncUrl = useCallback((f) => {
    const params = new URLSearchParams();
    if (f.keyword) params.set("keyword", f.keyword);
    if (f.corp) params.set("corp", f.corp);
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    router.replace(`/organizations${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.keyword) p.set("keyword", filters.keyword);
      if (filters.corp) p.set("corp", filters.corp);
      p.set("page", String(filters.page));
      p.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/organizations?${p}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error("Failed to load organizations:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    syncUrl(filters);
  }, [fetchData, syncUrl, filters]);

  const hasFilters = !!(filters.keyword || filters.corp);
  const startItem = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(filters.page * PAGE_SIZE, total);

  const handleSearch = () => setFilters({ ...formInput, page: 1 });
  const handleReset = () => {
    setFormInput({ keyword: "", corp: "" });
    setFilters({ keyword: "", corp: "", page: 1 });
  };
  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setFilters((prev) => ({ ...prev, page: clamped }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <nav className="text-sm text-gray-500 mb-3">
          <Link href="/" className="hover:underline">HOME</Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700 font-medium">企業</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">企業一覧（cross-domain ハブ）</h1>
          <p className="text-sm text-gray-500">
            入札 / 補助金 / 許認可 / 行政処分 / 産廃 を横断する企業マスタ。
            件数バッジからそのまま各DBの検索に辿れます。
          </p>
        </div>

        {/* 検索フォーム（軽量 - SearchForm は複雑すぎるので直接） */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">企業名・キーワード</label>
              <input
                type="text"
                value={formInput.keyword}
                onChange={(e) => setFormInput((p) => ({ ...p, keyword: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="例: 五洋建設"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">法人番号</label>
              <input
                type="text"
                value={formInput.corp}
                onChange={(e) => setFormInput((p) => ({ ...p, corp: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="13桁"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSearch} className="btn-primary text-sm">🔍 検索</button>
            {hasFilters && (
              <button onClick={handleReset} className="btn-secondary text-sm">リセット</button>
            )}
          </div>
        </div>

        {!loading && (
          <p className="text-sm text-gray-500 mb-4">
            {total}件中 {startItem}-{endItem}件を表示
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((org) => (
              <OrganizationCard key={org.id} org={org} />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">該当する企業が見つかりません</p>
            {hasFilters && (
              <button onClick={handleReset} className="mt-4 text-sm text-blue-600 hover:underline">
                フィルタをリセット
              </button>
            )}
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        )}
      </div>
    </div>
  );
}
