"use client";
// cache-bust: v3
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { saasConfig, getCategoryLabel, getCategoryIcon } from "@/lib/saas-config";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import DomainListPage from "@/components/core/DomainListPage";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";

// ─── フィルタサイドバー ───────────────────────────

function FilterSidebar({ filters, onChange, categoryCounts }) {
  const countMap = {};
  (categoryCounts || []).forEach((c) => { countMap[c.category] = c.count; });

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-5">
      {/* カテゴリ */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">カテゴリ</h3>
        <div className="space-y-1.5">
          <button
            onClick={() => onChange({ ...filters, category: "" })}
            className={`w-full text-left text-sm px-2 py-1.5 rounded ${!filters.category ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-600 hover:bg-gray-50"}`}
          >
            すべて
          </button>
          {saasConfig.categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onChange({ ...filters, category: cat.slug })}
              className={`w-full text-left text-sm px-2 py-1.5 rounded flex items-center justify-between ${filters.category === cat.slug ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <span>{cat.icon} {cat.label}</span>
              {countMap[cat.slug] != null && (
                <span className="text-xs text-gray-400">{countMap[cat.slug]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 価格帯 */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">月額料金</h3>
        <select
          value={filters.price_range || ""}
          onChange={(e) => onChange({ ...filters, price_range: e.target.value })}
          className="w-full text-sm border rounded-lg px-3 py-2"
        >
          <option value="">指定なし</option>
          {saasConfig.priceRanges.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* 企業規模 */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">企業規模</h3>
        <select
          value={filters.company_size || ""}
          onChange={(e) => onChange({ ...filters, company_size: e.target.value })}
          className="w-full text-sm border rounded-lg px-3 py-2"
        >
          <option value="">指定なし</option>
          {saasConfig.companySizes.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* チェックボックスフィルタ */}
      <div className="card p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!filters.has_free_plan}
            onChange={(e) => onChange({ ...filters, has_free_plan: e.target.checked })}
            className="rounded"
          />
          無料プランあり
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!filters.has_free_trial}
            onChange={(e) => onChange({ ...filters, has_free_trial: e.target.checked })}
            className="rounded"
          />
          無料トライアルあり
        </label>
      </div>
    </aside>
  );
}

// ─── ツールカード（比較 + お気に入りボタン付き）──────────────────

const saasDomain = getDomain("saas");

function ItemCard({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={`/saas/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {item.hero_image_url ? (
          <img src={item.hero_image_url} alt="" className="w-10 h-10 object-contain rounded" />
        ) : (
          getCategoryIcon(item.category)
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/saas/${item.slug}`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.title}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {saasDomain && <DomainFavoriteButton itemId={item.id} domain={saasDomain} />}
            <DomainCompareButton domainId="saas" itemId={item.id} variant="compact" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.provider_name || "—"}</p>
        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          {item.price_display && (
            <span className="text-xs text-gray-600">{item.price_display}</span>
          )}
          {item.has_free_plan === 1 && (
            <span className="badge badge-green">無料プランあり</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── メインページ ───────────────────────────────

export default function SaasListPageWrapper() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>}>
      <SaasListPage />
    </Suspense>
  );
}

function SaasListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    keyword: searchParams.get("keyword") || "",
    price_range: searchParams.get("price_range") || "",
    company_size: searchParams.get("company_size") || "",
    has_free_plan: searchParams.get("has_free_plan") === "1",
    has_free_trial: searchParams.get("has_free_trial") === "1",
    sort: searchParams.get("sort") || "popularity",
    page: parseInt(searchParams.get("page") || "1"),
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.price_range) params.set("price_range", filters.price_range);
    if (filters.company_size) params.set("company_size", filters.company_size);
    if (filters.has_free_plan) params.set("has_free_plan", "1");
    if (filters.has_free_trial) params.set("has_free_trial", "1");
    if (filters.sort) params.set("sort", filters.sort);
    params.set("page", String(filters.page));

    try {
      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setCategoryCounts(data.categoryCounts || []);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // URLパラメータ同期
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.price_range) params.set("price_range", filters.price_range);
    if (filters.company_size) params.set("company_size", filters.company_size);
    if (filters.has_free_plan) params.set("has_free_plan", "1");
    if (filters.has_free_trial) params.set("has_free_trial", "1");
    if (filters.sort !== "popularity") params.set("sort", filters.sort);
    if (filters.page > 1) params.set("page", String(filters.page));
    const qs = params.toString();
    router.replace(`/saas${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [filters, router]);

  function handleFilterChange(newFilters) {
    setFilters({ ...newFilters, page: 1 });
  }

  // ─── タイトル ─────
  const pageTitle = filters.category
    ? `${getCategoryIcon(filters.category)} ${getCategoryLabel(filters.category)}`
    : "SaaSツール一覧";

  const pageSubtitle = `${total}件のツール${filters.category ? `（${getCategoryLabel(filters.category)}）` : ""}`;

  return (
    <DomainListPage
      title={pageTitle}
      subtitle={pageSubtitle}
      items={items}
      loading={loading}
      layout="sidebar"
      page={filters.page}
      totalPages={totalPages}
      onPageChange={(p) => setFilters({ ...filters, page: p })}
      renderItem={(item) => <ItemCard key={item.id} item={item} />}
      renderFilters={() => (
        <FilterSidebar
          filters={filters}
          onChange={handleFilterChange}
          categoryCounts={categoryCounts}
        />
      )}
      renderSort={() => (
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {saasConfig.sorts.map((s) => (
              <button
                key={s.key}
                onClick={() => setFilters({ ...filters, sort: s.key, page: 1 })}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  filters.sort === s.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      headerSlot={
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value, page: 1 })}
              placeholder="ツール名やキーワードで検索..."
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
            />
            <button onClick={fetchItems} className="btn-primary">検索</button>
          </div>
        </div>
      }
      emptyState={
        <div className="card p-8 text-center">
          <p className="text-gray-500">条件に一致するツールが見つかりません</p>
          <button
            onClick={() => handleFilterChange({ category: "", keyword: "", price_range: "", company_size: "", has_free_plan: false, has_free_trial: false, sort: "popularity", page: 1 })}
            className="btn-secondary mt-4"
          >
            フィルタをリセット
          </button>
        </div>
      }
      bottomBar={
        <DomainCompareBar domainId="saas" comparePath="/saas/compare" label="件のツール" />
      }
    />
  );
}
