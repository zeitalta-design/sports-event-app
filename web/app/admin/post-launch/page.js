"use client";

import { useState, useEffect } from "react";

/**
 * Phase229: 公開後チェックダッシュボード
 *
 * /admin/post-launch
 * 公開直後の全体ステータスを一画面で確認。
 */

const STATUS_STYLES = {
  pass: { bg: "bg-green-50", text: "text-green-700", icon: "✓", border: "border-green-200" },
  warn: { bg: "bg-yellow-50", text: "text-yellow-700", icon: "!", border: "border-yellow-200" },
  fail: { bg: "bg-red-50", text: "text-red-700", icon: "✕", border: "border-red-200" },
  info: { bg: "bg-blue-50", text: "text-blue-700", icon: "ℹ", border: "border-blue-200" },
};

export default function PostLaunchPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageChecks, setPageChecks] = useState({});

  useEffect(() => {
    fetch("/api/admin/post-launch-check")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function handlePageCheck(path) {
    window.open(path, "_blank");
    setPageChecks((prev) => ({ ...prev, [path]: true }));
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-400">チェック中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-red-500">チェックAPIの取得に失敗しました。</p>
      </div>
    );
  }

  const { summary, checks } = data;

  // カテゴリ別にグループ化
  const grouped = {};
  for (const check of checks) {
    const cat = check.category || "その他";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(check);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">公開後チェック</h1>
      <p className="text-sm text-gray-500 mb-6">
        公開直後に確認すべき項目の自動チェック結果。
      </p>

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <SummaryCard label="合格" value={summary.pass} color="text-green-600" bg="bg-green-50" />
        <SummaryCard label="警告" value={summary.warn} color="text-yellow-600" bg="bg-yellow-50" />
        <SummaryCard label="失敗" value={summary.fail} color="text-red-600" bg="bg-red-50" />
        <SummaryCard label="合計" value={summary.total} color="text-gray-600" bg="bg-gray-50" />
      </div>

      {/* 全体ステータス */}
      <div className={`card p-4 mb-6 ${summary.overall === "pass" ? "border-green-300 bg-green-50" : summary.overall === "warn" ? "border-yellow-300 bg-yellow-50" : "border-red-300 bg-red-50"}`}>
        <p className={`text-sm font-bold ${summary.overall === "pass" ? "text-green-700" : summary.overall === "warn" ? "text-yellow-700" : "text-red-700"}`}>
          {summary.overall === "pass" && "✅ 全チェック合格 — 公開OK"}
          {summary.overall === "warn" && "⚠️ 一部警告あり — 確認推奨"}
          {summary.overall === "fail" && "❌ 失敗項目あり — 修正必要"}
        </p>
      </div>

      {/* カテゴリ別チェック結果 */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="card p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">{category}</h2>
          <div className="space-y-2">
            {items.map((check, i) => {
              const style = STATUS_STYLES[check.status] || STATUS_STYLES.info;

              // 主要ページリストの特殊表示
              if (check.pages) {
                return (
                  <div key={i}>
                    <p className="text-sm text-gray-700 mb-2">{check.name}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {check.pages.map((page) => (
                        <button
                          key={page.path}
                          onClick={() => handlePageCheck(page.path)}
                          className={`text-left px-3 py-2 text-xs rounded-lg border transition-colors ${
                            pageChecks[page.path]
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200"
                          }`}
                        >
                          {pageChecks[page.path] && "✓ "}
                          {page.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${style.bg}`}>
                  <span className={`w-5 h-5 rounded-full ${style.bg} ${style.text} flex items-center justify-center text-xs font-bold border ${style.border}`}>
                    {style.icon}
                  </span>
                  <span className="text-sm text-gray-700 flex-1">{check.name}</span>
                  <span className="text-xs text-gray-500">{check.detail}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-400 mt-4">
        確認日時: {new Date(data.timestamp).toLocaleString("ja-JP")} / URL: {data.baseUrl}
      </p>
    </div>
  );
}

function SummaryCard({ label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-lg p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
