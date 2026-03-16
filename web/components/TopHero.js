"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/constants";

const MONTHS_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}));

const PREFECTURES = REGIONS.flatMap((r) => r.prefectures);

export default function TopHero({ totalEvents = 0 }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [month, setMonth] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (prefecture) params.set("prefecture", prefecture);
    if (month) params.set("month", month);
    router.push(`/marathon?${params.toString()}`);
  };

  return (
    <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-blue-300 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            全国のスポーツ大会を探す
          </h1>
          <p className="mt-3 text-blue-100 text-sm sm:text-base">
            まずはマラソン大会から検索できます
          </p>
          {totalEvents > 0 && (
            <p className="mt-2 text-blue-200 text-xs">
              現在 <span className="font-semibold text-white">{totalEvents.toLocaleString()}</span> 件の大会を掲載中
            </p>
          )}
        </div>

        <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1 ml-1">
                  キーワード
                </label>
                <input
                  type="text"
                  placeholder="大会名・会場名"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full px-3 py-2.5 text-gray-900 text-sm rounded-lg border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1 ml-1">
                  エリア
                </label>
                <select
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="w-full px-3 py-2.5 text-gray-900 text-sm rounded-lg border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">すべて</option>
                  {PREFECTURES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1 ml-1">
                  開催月
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3 py-2.5 text-gray-900 text-sm rounded-lg border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">すべて</option>
                  {MONTHS_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl
                         hover:bg-blue-700 transition-colors text-sm"
            >
              マラソン大会を探す
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
