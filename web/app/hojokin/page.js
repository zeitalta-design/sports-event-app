"use client";

import { useMemo } from "react";
import CategoryPageHeader from "@/components/CategoryPageHeader";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainResultCard from "@/components/core/DomainResultCard";
import StatsDashboard from "@/components/StatsDashboard";
import SearchForm from "@/components/search/SearchForm";
import ActiveFilterChips from "@/components/search/ActiveFilterChips";
import Pagination from "@/components/search/Pagination";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import { useDomainSearchPage } from "@/lib/core/useDomainSearchPage";
import {
  hojokinConfig,
  getCategoryLabel,
  getCategoryIcon,
  getStatusLabel,
  getStatusColor,
  formatAmount,
  formatDeadline,
} from "@/lib/hojokin-config";

const hojokinDomain = getDomain("hojokin");
const PAGE_SIZE = 20;

const FILTER_KEYS = [
  "keyword",
  "category",
  "target_type",
  "status",
  "provider",
  "year",
  "deadline_from",
  "deadline_to",
  "amount_min",
  "amount_max",
];

const INITIAL_FILTERS = {
  keyword: "",
  category: "",
  target_type: "",
  status: "",
  provider: "",
  year: "",
  deadline_from: "",
  deadline_to: "",
  amount_min: "",
  amount_max: "",
  sort: "deadline",
  page: 1,
};

function HojokinBadges({ item }) {
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
      <span className={`badge ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>
      <span className="text-xs text-gray-600">上限 {formatAmount(item.max_amount)}</span>
      <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
    </div>
  );
}

export default function HojokinListPage() {
  const {
    items,
    total,
    totalPages,
    stats,
    loading,
    filters,
    formInput,
    hasFilters,
    startItem,
    endItem,
    handleSearch,
    handleReset,
    goToPage,
    onChipRemove,
    onStatsToggle,
    onSortChange,
    onFormFieldChange,
  } = useDomainSearchPage({
    basePath: "/hojokin",
    listApiPath: "/api/hojokin",
    statsApiPath: "/api/hojokin/stats",
    filterKeys: FILTER_KEYS,
    initialFilters: INITIAL_FILTERS,
    pageSize: PAGE_SIZE,
  });

  const searchFields = useMemo(() => [
    {
      type: "text",
      name: "keyword",
      label: "制度名・キーワード",
      placeholder: "例: IT導入補助金",
    },
    {
      type: "select",
      name: "category",
      label: "カテゴリ",
      options: hojokinConfig.categories.map((c) => ({ value: c.slug, label: c.label, icon: c.icon })),
    },
    {
      type: "select",
      name: "target_type",
      label: "対象",
      options: hojokinConfig.targetTypes.map((t) => ({ value: t.value, label: t.label })),
    },
    {
      type: "select",
      name: "status",
      label: "受付状況",
      options: hojokinConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })),
    },
    {
      type: "dateRange",
      name: ["deadline_from", "deadline_to"],
      label: "申請締切（期間）",
    },
  ], []);

  const chipDefs = useMemo(() => [
    { key: "keyword", label: "キーワード" },
    {
      key: "category",
      label: "カテゴリ",
      resolve: (v) => hojokinConfig.categories.find((c) => c.slug === v)?.label || v,
    },
    {
      key: "target_type",
      label: "対象",
      resolve: (v) => hojokinConfig.targetTypes.find((t) => t.value === v)?.label || v,
    },
    {
      key: "status",
      label: "受付状況",
      resolve: (v) => hojokinConfig.statusOptions.find((s) => s.value === v)?.label || v,
    },
    { key: "provider", label: "実施機関" },
    { key: "year", label: "年度（締切年）" },
    { key: "deadline_from", label: "締切From" },
    { key: "deadline_to", label: "締切To" },
    { key: "amount_min", label: "上限額(以上)", resolve: (v) => `${parseInt(v, 10).toLocaleString()}円` },
    { key: "amount_max", label: "上限額(以下)", resolve: (v) => `${parseInt(v, 10).toLocaleString()}円` },
  ], []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <CategoryPageHeader categoryId="hojokin" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">補助金ナビ</h1>
          <p className="text-sm text-gray-500">
            国・自治体の補助金・助成金制度を横断検索
          </p>
        </div>

        <SearchForm
          fields={searchFields}
          values={formInput}
          onChange={onFormFieldChange}
          onSearch={handleSearch}
          onReset={handleReset}
          sortOptions={hojokinConfig.sorts}
          sort={filters.sort}
          onSortChange={onSortChange}
        />

        {hasFilters && (
          <ActiveFilterChips chipDefs={chipDefs} filters={filters} onRemove={onChipRemove} />
        )}

        {stats && stats.totalCount > 0 && (
          <StatsDashboard
            totalCount={stats.totalCount}
            hasFilters={hasFilters}
            filters={filters}
            onFilterChange={onStatsToggle}
            accent="#D97706"
            sections={[
              {
                title: "年別件数（締切年）",
                type: "bar",
                filterKey: "year",
                rows: (stats.countsByYear || []).map((r) => ({
                  value: r.year,
                  label: r.year,
                  count: r.count,
                  isUnknown: !r.year || r.year === "不明",
                })),
              },
              {
                title: "実施機関 TOP10",
                type: "ranking",
                filterKey: "provider",
                rows: (stats.countsByProvider || []).map((r) => ({
                  value: r.name,
                  label: r.name,
                  count: r.count,
                })),
              },
              {
                title: "カテゴリ別",
                type: "ranking",
                filterKey: "category",
                rows: (stats.countsByCategory || []).map((r) => ({
                  value: r.category,
                  label: getCategoryLabel(r.category),
                  count: r.count,
                })),
              },
              {
                title: "受付状況別",
                type: "ranking",
                filterKey: "status",
                rows: (stats.countsByStatus || []).map((r) => ({
                  value: r.status,
                  label: getStatusLabel(r.status),
                  count: r.count,
                })),
              },
            ]}
          />
        )}

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
            {items.map((item) => (
              <DomainResultCard
                key={item.id}
                item={item}
                domainId="hojokin"
                domain={hojokinDomain}
                basePath="/hojokin"
                icon={getCategoryIcon(item.category)}
                secondaryText={item.provider_name}
                renderBadges={HojokinBadges}
              />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">条件に一致する制度が見つかりません</p>
            <button onClick={handleReset} className="mt-4 text-sm text-blue-600 hover:underline">
              フィルタをリセット
            </button>
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={filters.page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        )}

        <DomainCompareBar domainId="hojokin" comparePath="/hojokin/compare" label="制度" />
      </div>
    </div>
  );
}
