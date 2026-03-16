"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/constants";

const PREFECTURES = REGIONS.flatMap((r) => r.prefectures);
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}));

// クイック条件チップ（常時表示）
const QUICK_CHIPS = [
  { key: "marathon",    label: "マラソン" },
  { key: "trail",       label: "トレイル" },
  { key: "cycling",     label: "自転車" },
  { key: "triathlon",   label: "トライアスロン" },
  { key: "walking",     label: "ウォーキング" },
];

// 絞り込みパネル内の追加条件
const FILTER_SECTIONS = [
  {
    title: "競技ジャンル",
    key: "genre",
    items: [
      { key: "練習会", label: "練習会" },
      { key: "講習会", label: "講習会" },
      { key: "イベント", label: "イベント" },
    ],
  },
  {
    title: "レベル",
    key: "level",
    items: [
      { key: "初心者", label: "初心者向け" },
      { key: "中級", label: "中級者向け" },
      { key: "上級", label: "上級者向け" },
    ],
  },
  {
    title: "距離",
    key: "distance",
    items: [
      { key: "5", label: "5km" },
      { key: "10", label: "10km" },
      { key: "half", label: "ハーフ" },
      { key: "full", label: "フル" },
      { key: "ultra", label: "ウルトラ" },
    ],
  },
  {
    title: "ステータス",
    key: "status",
    items: [
      { key: "open", label: "受付中のみ" },
    ],
  },
];

export default function HomeSearchBar({ totalEvents = 0 }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [month, setMonth] = useState("");
  const [selectedChips, setSelectedChips] = useState(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterChecks, setFilterChecks] = useState(new Set());

  const toggleChip = (key) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleFilter = (key) => {
    setFilterChecks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();

    // キーワード: 基本キーワード + 選択チップ + フィルタ条件を結合
    const parts = [];
    if (keyword) parts.push(keyword);

    // クイックチップ → keywordに追加
    selectedChips.forEach((chip) => {
      const found = QUICK_CHIPS.find((c) => c.key === chip);
      if (found) parts.push(found.label);
    });

    // フィルタ内のジャンル・レベル → keywordに追加
    filterChecks.forEach((key) => {
      // distance系は別パラメータ
      const distItem = FILTER_SECTIONS.find((s) => s.key === "distance")?.items.find((i) => i.key === key);
      if (distItem) return;
      // status系も別処理
      if (key === "open") return;
      parts.push(key);
    });

    if (parts.length > 0) params.set("keyword", parts.join(" "));
    if (prefecture) params.set("prefecture", prefecture);
    if (month) params.set("month", month);

    // distance
    const distKeys = FILTER_SECTIONS.find((s) => s.key === "distance")?.items
      .filter((i) => filterChecks.has(i.key))
      .map((i) => i.key) || [];
    if (distKeys.length === 1) params.set("distance", distKeys[0]);

    router.push(`/marathon?${params.toString()}`);
  };

  const activeCount = selectedChips.size + filterChecks.size;

  return (
    <section className="relative -mt-10 sm:-mt-12 z-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-7">
          {/* 見出し */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <h2 className="text-base font-bold" style={{ color: "#333333" }}>大会を探す</h2>
            </div>
            {totalEvents > 0 && (
              <span className="text-xs" style={{ color: "#333333" }}>
                <span className="font-semibold text-blue-600">{totalEvents.toLocaleString()}</span> 件掲載中
              </span>
            )}
          </div>

          <form onSubmit={handleSearch}>
            {/* 中段: キーワード・エリア・開催月 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "#333333" }}>
                  キーワード
                </label>
                <input
                  type="text"
                  placeholder="大会名・会場名で検索"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                             placeholder:text-gray-300 transition-shadow"
                  style={{ color: "#333333" }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "#333333" }}>
                  エリア
                </label>
                <select
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                             bg-white transition-shadow"
                  style={{ color: "#333333" }}
                >
                  <option value="">都道府県を選択</option>
                  {PREFECTURES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1.5 tracking-wide" style={{ color: "#333333" }}>
                  開催月
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                             bg-white transition-shadow"
                  style={{ color: "#333333" }}
                >
                  <option value="">月を選択</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 下段: クイックチップ + 絞り込みボタン */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {QUICK_CHIPS.map((chip) => {
                const active = selectedChips.has(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => toggleChip(chip.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                    style={active ? undefined : { color: "#333333" }}
                    aria-pressed={active}
                    aria-label={`${chip.label}で絞り込み`}
                  >
                    {active && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {chip.label}
                  </button>
                );
              })}

              {/* 絞り込みボタン */}
              <button
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  filterOpen || filterChecks.size > 0
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                }`}
                style={filterOpen || filterChecks.size > 0 ? undefined : { color: "#333333" }}
                aria-expanded={filterOpen}
                aria-label="詳細条件で絞り込み"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                絞り込み
                {filterChecks.size > 0 && (
                  <span className="ml-0.5 w-4 h-4 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full">
                    {filterChecks.size}
                  </span>
                )}
              </button>
            </div>

            {/* 絞り込みパネル（展開時） */}
            {filterOpen && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {FILTER_SECTIONS.map((section) => (
                    <div key={section.key}>
                      <p className="text-[11px] font-bold mb-2" style={{ color: "#333333" }}>
                        {section.title}
                      </p>
                      <div className="space-y-1.5">
                        {section.items.map((item) => {
                          const checked = filterChecks.has(item.key);
                          return (
                            <label
                              key={item.key}
                              className="flex items-center gap-2 cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFilter(item.key)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/40"
                              />
                              <span
                                className="text-xs group-hover:text-blue-600 transition-colors"
                                style={{ color: "#333333" }}
                              >
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {filterChecks.size > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFilterChecks(new Set())}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      条件をクリア
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl
                         hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm
                         shadow-sm hover:shadow-md"
            >
              大会を検索する
              {activeCount > 0 && (
                <span className="ml-1.5 text-blue-200">({activeCount}件の条件)</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
