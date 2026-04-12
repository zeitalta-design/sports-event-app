"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";
import LegalDisclaimer from "@/components/gyosei-shobun/LegalDisclaimer";
import { calculateRiskScore, RISK_COLORS } from "@/lib/risk-score";

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", accent: "#DC2626" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "#D97706" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", accent: "#2563EB" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", accent: "#CA8A04" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", accent: "#16A34A" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", accent: "#6B7280" },
};

const COMPARE_FIELDS = [
  { key: "_risk_score", label: "リスクスコア", format: "risk" },
  { key: "organization_name_raw", label: "事業者名" },
  { key: "action_type", label: "処分種別", format: "action_type" },
  { key: "action_date", label: "処分日" },
  { key: "authority_name", label: "処分庁" },
  { key: "prefecture", label: "都道府県" },
  { key: "industry", label: "業種", format: "industry" },
  { key: "summary", label: "概要", format: "long" },
  { key: "penalty_period", label: "処分期間" },
  { key: "legal_basis", label: "法的根拠" },
];

const STORAGE_KEY = "gyosei_shobun_compare_ids";

function getStoredIds() {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function setStoredIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function CompareContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    // URLパラメータ or localStorage
    const paramIds = searchParams.get("ids");
    let ids = [];
    if (paramIds) {
      ids = paramIds.split(",").map(Number).filter(Boolean);
    } else {
      ids = getStoredIds();
    }

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    try {
      // 個別にslug APIを呼ぶ代わりに、ID一覧でフェッチ
      const res = await fetch(`/api/gyosei-shobun?ids=${ids.join(",")}`);
      const data = await res.json();
      if (data.ok !== false && data.items) {
        setItems(data.items);
      } else {
        // フォールバック: 個別取得
        const fetched = [];
        for (const id of ids) {
          try {
            const r = await fetch(`/api/gyosei-shobun?keyword=&page=1&id=${id}`);
            const d = await r.json();
            if (d.items?.[0]) fetched.push(d.items[0]);
          } catch { /* skip */ }
        }
        setItems(fetched);
      }
    } catch {
      setError("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => { load(); }, [load]);

  function handleRemove(id) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const stored = getStoredIds().filter((sid) => sid !== id);
    setStoredIds(stored);
  }

  function handleClearAll() {
    setItems([]);
    setStoredIds([]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* パンくず */}
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-blue-600 transition-colors">トップ</Link>
          <span className="text-gray-300">/</span>
          <Link href="/gyosei-shobun" className="hover:text-blue-600 transition-colors">行政処分DB</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600">比較</span>
        </nav>

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚖️</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">行政処分 比較</h1>
                <p className="text-sm text-gray-500">最大6件の処分情報を横並びで比較できます</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {items.length > 0 && (
                <>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                    {items.length}/6件
                  </span>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium"
                  >
                    すべてクリア
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">読み込み中...</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 空の場合 */}
        {!loading && items.length === 0 && !error && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-4xl mb-4">⚖️</p>
            <h2 className="text-lg font-bold text-gray-800 mb-2">比較する案件がありません</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6 leading-relaxed">
              行政処分の詳細ページやお気に入り一覧から「比較に追加」ボタンで案件を追加してください。
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/gyosei-shobun" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                行政処分DBで検索する
              </Link>
              <Link href="/gyosei-shobun/favorites" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                お気に入り一覧
              </Link>
            </div>
          </div>
        )}

        {/* 比較テーブル（デスクトップ） */}
        {!loading && items.length > 0 && (
          <>
            {/* デスクトップ: テーブル形式 */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 bg-gray-50 w-32 sticky left-0 z-10">項目</th>
                      {items.map((item) => {
                        const tc = ACTION_TYPE_COLORS[item.action_type] || ACTION_TYPE_COLORS.other;
                        return (
                          <th key={item.id} className="py-3 px-4 text-left min-w-[220px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-gray-600 truncate">#{item.id}</span>
                              <button
                                onClick={() => handleRemove(item.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                title="比較から削除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map((field, fi) => (
                      <tr key={field.key} className={fi % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="py-3 px-4 text-xs font-bold text-gray-500 border-r border-gray-100 sticky left-0 z-10 bg-inherit">
                          {field.label}
                        </td>
                        {items.map((item) => (
                          <td key={item.id} className="py-3 px-4 border-r border-gray-100 last:border-r-0">
                            <CellValue item={item} field={field} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* 詳細リンク行 */}
                    <tr className="border-t border-gray-200">
                      <td className="py-3 px-4 sticky left-0 z-10 bg-white" />
                      {items.map((item) => (
                        <td key={item.id} className="py-3 px-4">
                          <Link
                            href={`/gyosei-shobun/${item.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            詳細を見る →
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* モバイル: カード形式（横スクロール） */}
            <div className="md:hidden">
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
                {items.map((item) => {
                  const actionType = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type);
                  const industryInfo = gyoseiShobunConfig.industries.find((i) => i.slug === item.industry);
                  const tc = ACTION_TYPE_COLORS[item.action_type] || ACTION_TYPE_COLORS.other;

                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden min-w-[280px] w-[85vw] max-w-[340px] snap-start shrink-0">
                      <div className="h-1" style={{ backgroundColor: tc.accent }} />
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-md border font-bold ${tc.bg} ${tc.text} ${tc.border}`}>
                            {actionType?.icon} {actionType?.label}
                          </span>
                          <button onClick={() => handleRemove(item.id)} className="text-gray-400 hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>

                        <h3 className="text-base font-bold text-gray-900 mb-3">{item.organization_name_raw}</h3>

                        <dl className="space-y-2 text-sm">
                          {item.action_date && <MobileRow label="処分日" value={item.action_date} />}
                          {item.authority_name && <MobileRow label="処分庁" value={item.authority_name} />}
                          {item.prefecture && <MobileRow label="都道府県" value={item.prefecture} />}
                          {industryInfo && <MobileRow label="業種" value={`${industryInfo.icon} ${industryInfo.label}`} />}
                          {item.penalty_period && <MobileRow label="処分期間" value={item.penalty_period} />}
                          {item.legal_basis && <MobileRow label="法的根拠" value={item.legal_basis} />}
                        </dl>

                        {item.summary && (
                          <p className="text-xs text-gray-600 mt-3 line-clamp-3 leading-relaxed">{item.summary}</p>
                        )}

                        <Link
                          href={`/gyosei-shobun/${item.slug}`}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          詳細を見る →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
        <LegalDisclaimer mode="compact" />
    </div>
  );
}

/** テーブルセルの値表示 */
function CellValue({ item, field }) {
  const value = item[field.key];
  if (field.format === "risk") {
    const risk = calculateRiskScore(item);
    const rc = RISK_COLORS[risk.level] || RISK_COLORS.unknown;
    return (
      <div className="flex items-center gap-2">
        <span className={`text-lg font-black ${rc.text}`}>{risk.score}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rc.badge}`}>{risk.label}</span>
      </div>
    );
  }

  if (!value) return <span className="text-gray-300">—</span>;

  if (field.format === "action_type") {
    const info = gyoseiShobunConfig.actionTypes.find((t) => t.slug === value);
    const tc = ACTION_TYPE_COLORS[value] || ACTION_TYPE_COLORS.other;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-md border font-bold ${tc.bg} ${tc.text} ${tc.border}`}>
        {info?.icon} {info?.label || value}
      </span>
    );
  }

  if (field.format === "industry") {
    const info = gyoseiShobunConfig.industries.find((i) => i.slug === value);
    return <span className="text-sm text-gray-700">{info ? `${info.icon} ${info.label}` : value}</span>;
  }

  if (field.format === "long") {
    return <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{value}</p>;
  }

  return <span className="text-sm text-gray-700">{value}</span>;
}

/** モバイル用行 */
function MobileRow({ label, value }) {
  return (
    <div className="flex">
      <dt className="w-20 shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="text-xs text-gray-800 font-medium">{value}</dd>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-500">読み込み中...</div>}>
      <CompareContent />
    </Suspense>
  );
}
