"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { gyoseiShobunConfig } from "@/lib/gyosei-shobun-config";
import AddToCompareButton from "@/components/gyosei-shobun/AddToCompareButton";
import WatchButton from "@/components/gyosei-shobun/WatchButton";
import RiskScoreBadge from "@/components/gyosei-shobun/RiskScoreBadge";
import LegalDisclaimer from "@/components/gyosei-shobun/LegalDisclaimer";

const ACTION_TYPE_COLORS = {
  license_revocation: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", accent: "#DC2626" },
  business_suspension: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "#D97706" },
  improvement_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", accent: "#2563EB" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", accent: "#CA8A04" },
  guidance: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", accent: "#16A34A" },
  other: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", accent: "#6B7280" },
};

function getAnonKey() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("risk_monitor_user_key");
}

export default function FavoritesPage() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [toast, setToast] = useState(null);

  // フィルタ・ソート
  const [filterType, setFilterType] = useState("");
  const [sortKey, setSortKey] = useState("favorited"); // favorited | date_new | date_old

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  const load = useCallback(async () => {
    // APIがセッションからuser_idを自動取得。未ログイン時はanon_keyをフォールバック
    const anonKey = getAnonKey();
    const params = new URLSearchParams({ pageSize: "200" });
    if (anonKey) params.set("user_key", anonKey);
    try {
      const res = await fetch(`/api/gyosei-shobun/favorites?${params}`);
      const data = await res.json();
      if (data.ok) {
        setAllItems(data.items);
      } else {
        setError("お気に入りの読み込みに失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // フィルタ・ソート適用
  const filtered = useMemo(() => {
    let result = [...allItems];
    if (filterType) {
      result = result.filter((item) => item.action_type === filterType);
    }
    if (sortKey === "date_new") {
      result.sort((a, b) => (b.action_date || "").localeCompare(a.action_date || ""));
    } else if (sortKey === "date_old") {
      result.sort((a, b) => (a.action_date || "").localeCompare(b.action_date || ""));
    }
    // "favorited" はAPIのデフォルト（登録日順）
    return result;
  }, [allItems, filterType, sortKey]);

  // 使用中の処分種別を集計
  const typeCounts = useMemo(() => {
    const counts = {};
    for (const item of allItems) {
      counts[item.action_type] = (counts[item.action_type] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  async function handleRemove(actionId) {
    const anonKey = getAnonKey();
    setRemoving(actionId);
    try {
      const res = await fetch("/api/gyosei-shobun/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_key: anonKey, action_id: actionId }),
      });
      if (res.ok) {
        setAllItems((prev) => prev.filter((item) => item.id !== actionId));
        showToast("お気に入りから削除しました");
      } else {
        showToast("削除に失敗しました", "error");
      }
    } catch {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setRemoving(null);
    }
  }

  const hasUserKey = typeof window !== "undefined" && !!getAnonKey();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* パンくず */}
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-blue-600 transition-colors">トップ</Link>
          <span className="text-gray-300">/</span>
          <Link href="/gyosei-shobun" className="hover:text-blue-600 transition-colors">行政処分DB</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600">お気に入り</span>
        </nav>

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">お気に入り一覧</h1>
                <p className="text-sm text-gray-500">監視したい行政処分情報を保存・管理できます</p>
              </div>
            </div>
            {allItems.length > 0 && (
              <span className="text-lg font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
                {allItems.length}<span className="text-sm font-normal text-gray-500 ml-0.5">件</span>
              </span>
            )}
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
            <button onClick={load} className="text-sm text-red-600 hover:underline mt-1">再読み込み</button>
          </div>
        )}

        {/* 未登録（user_keyなし） */}
        {!loading && !hasUserKey && (
          <EmptyState
            icon="⭐"
            title="お気に入り機能をはじめよう"
            description="行政処分の詳細ページで星マークをクリックすると、この一覧に保存されます。気になる事業者や処分情報を監視するのに便利です。"
          />
        )}

        {/* 空の場合 */}
        {!loading && hasUserKey && allItems.length === 0 && !error && (
          <EmptyState
            icon="📋"
            title="お気に入りはまだありません"
            description="行政処分の詳細ページで星マークをクリックすると、ここに保存されます。取引先や同業者の処分情報をまとめて管理できます。"
          />
        )}

        {/* フィルタ・ソートバー */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            {/* 処分種別フィルタ */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterType("")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  !filterType ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                すべて ({allItems.length})
              </button>
              {Object.entries(typeCounts).map(([type, count]) => {
                const info = gyoseiShobunConfig.actionTypes.find((t) => t.slug === type);
                const tc = ACTION_TYPE_COLORS[type] || ACTION_TYPE_COLORS.other;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? "" : type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      filterType === type
                        ? `${tc.bg} ${tc.text} ${tc.border}`
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {info?.icon} {info?.label || type} ({count})
                  </button>
                );
              })}
            </div>

            {/* ソート */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600"
            >
              <option value="favorited">登録日順</option>
              <option value="date_new">処分日が新しい順</option>
              <option value="date_old">処分日が古い順</option>
            </select>
          </div>
        )}

        {/* フィルタ結果0件 */}
        {!loading && allItems.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">この条件に一致するお気に入りはありません</p>
            <button onClick={() => setFilterType("")} className="text-sm text-blue-600 hover:underline">
              フィルタをリセット
            </button>
          </div>
        )}

        {/* カード一覧 */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((item) => {
              const actionType = gyoseiShobunConfig.actionTypes.find((t) => t.slug === item.action_type);
              const industryInfo = gyoseiShobunConfig.industries.find((i) => i.slug === item.industry);
              const tc = ACTION_TYPE_COLORS[item.action_type] || ACTION_TYPE_COLORS.other;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
                  {/* アクセントバー */}
                  <div className="h-0.5" style={{ backgroundColor: tc.accent }} />

                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      {/* アイコン */}
                      <span className="text-2xl mt-0.5 shrink-0 hidden sm:block">{actionType?.icon || "📄"}</span>

                      {/* 本体 */}
                      <div className="min-w-0 flex-1">
                        {/* バッジ行 */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-0.5 rounded-md border font-bold ${tc.bg} ${tc.text} ${tc.border}`}>
                            {actionType?.label || item.action_type}
                          </span>
                          {industryInfo && (
                            <span className="text-xs text-gray-500 font-medium">
                              {industryInfo.icon} {industryInfo.label}
                            </span>
                          )}
                          <RiskScoreBadge action={item} mode="compact" />
                          {item.favorited_at && (
                            <span className="text-[10px] text-gray-400 ml-auto">
                              ⭐ {item.favorited_at.slice(0, 10)} に登録
                            </span>
                          )}
                        </div>

                        {/* 事業者名 */}
                        <h2 className="text-base font-bold text-gray-900 mb-1.5 leading-snug">
                          {item.organization_name_raw}
                        </h2>

                        {/* メタ情報 */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                          {item.action_date && <span>📅 {item.action_date}</span>}
                          {item.prefecture && <span>📍 {item.prefecture}{item.city ? ` ${item.city}` : ""}</span>}
                          {item.authority_name && <span>🏛️ {item.authority_name}</span>}
                        </div>

                        {/* 概要 */}
                        {item.summary && (
                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">{item.summary}</p>
                        )}

                        {/* アクションボタン */}
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/gyosei-shobun/${item.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            詳細を見る
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </Link>
                          <AddToCompareButton actionId={item.id} compact />
                          <WatchButton organizationName={item.organization_name_raw} industry={item.industry || ""} compact />
                          <button
                            onClick={() => handleRemove(item.id)}
                            disabled={removing === item.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {removing === item.id ? (
                              <span className="w-3 h-3 block animate-spin border-2 border-gray-300 border-t-red-500 rounded-full" />
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            )}
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* グローバルトースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-5 py-3 rounded-xl text-sm font-medium shadow-xl animate-[fadeIn_0.2s_ease-out] ${
            toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-800 text-white"
          }`}>
            {toast.message}
          </div>
        </div>
      )}
      <LegalDisclaimer mode="compact" />
    </div>
  );
}

/** 空状態コンポーネント */
function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
      <p className="text-4xl mb-4">{icon}</p>
      <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6 leading-relaxed">{description}</p>
      <Link
        href="/gyosei-shobun"
        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
      >
        行政処分DBで検索する
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </Link>
    </div>
  );
}
