"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * 管理画面共通一覧コンポーネント
 *
 * @param {Object} props
 * @param {string} props.title - ページタイトル
 * @param {string} props.apiPath - API パス (e.g. "/api/admin/sanpai")
 * @param {string} props.basePath - 管理画面パス (e.g. "/admin/sanpai")
 * @param {string} props.publicPath - 公開側パス (e.g. "/sanpai")
 * @param {Array<{key: string, label: string, render?: function}>} props.columns - テーブル列定義
 * @param {string} [props.slugField="slug"] - 公開側リンクに使うフィールド
 * @param {Array<{label: string, endpoint: string, confirmMessage?: string}>} [props.syncActions] - データ更新ボタン定義
 */
export default function AdminListPage({ title, apiPath, basePath, publicPath, columns, slugField = "slug", syncActions = [] }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncingIdx, setSyncingIdx] = useState(-1);
  const [syncResult, setSyncResult] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      const res = await fetch(`${apiPath}?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [apiPath, keyword]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function togglePublish(id, current) {
    try {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      await fetch(`${apiPath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, is_published: current ? 0 : 1 }),
      });
      fetchItems();
    } catch (err) {
      console.error("Toggle publish error:", err);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{total}件</p>
        </div>
        <div className="flex gap-2">
          {syncActions.map((action, i) => (
            <button
              key={i}
              onClick={async () => {
                if (syncingIdx >= 0) return;
                const msg = action.confirmMessage || `${action.label}を実行しますか？（数十秒かかります）`;
                if (!confirm(msg)) return;
                setSyncingIdx(i);
                setSyncResult(null);
                try {
                  const res = await fetch(action.endpoint, { method: "POST" });
                  const data = await res.json();
                  if (data.ok || res.ok) {
                    const detail = data.totalFetched != null
                      ? `${data.totalFetched}件取得, ${data.created || 0}件新規, ${data.updated || 0}件更新`
                      : data.message || "完了";
                    setSyncResult({ type: "success", message: `${action.label}完了: ${detail}` });
                    fetchItems();
                  } else {
                    setSyncResult({ type: "error", message: data.error || "取得に失敗しました" });
                  }
                } catch {
                  setSyncResult({ type: "error", message: "通信エラーが発生しました" });
                } finally {
                  setSyncingIdx(-1);
                }
              }}
              disabled={syncingIdx >= 0}
              className={`text-sm border rounded-lg px-3 py-2 transition ${
                syncingIdx === i ? "bg-gray-100 text-gray-400" : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {syncingIdx === i ? "⏳ 取得中..." : `🔄 ${action.label}`}
            </button>
          ))}
          <Link href={`${basePath}/new`} className="text-sm bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700">
            + 新規作成
          </Link>
        </div>
      </div>

      {/* 同期結果 */}
      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${
          syncResult.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {syncResult.message}
          <button onClick={() => setSyncResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 検索 */}
      <div className="mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="検索..."
          className="border rounded-lg px-4 py-2 text-sm w-full max-w-md"
        />
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="card p-8 animate-pulse"><div className="h-32 bg-gray-100 rounded" /></div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">データがありません</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left text-xs font-bold text-gray-500">ID</th>
                {columns.map((col) => (
                  <th key={col.key} className="p-3 text-left text-xs font-bold text-gray-500">{col.label}</th>
                ))}
                <th className="p-3 text-left text-xs font-bold text-gray-500">公開</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-400">{item.id}</td>
                  {columns.map((col) => (
                    <td key={col.key} className="p-3 text-gray-900">
                      {col.render ? col.render(item) : (item[col.key] ?? "—")}
                    </td>
                  ))}
                  <td className="p-3">
                    <button
                      onClick={() => togglePublish(item.id, item.is_published)}
                      className={`text-xs px-2 py-1 rounded ${item.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {item.is_published ? "公開中" : "非公開"}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link href={`${basePath}/${item.id}/edit`} className="text-xs text-blue-600 hover:underline">
                        編集
                      </Link>
                      {item[slugField] && (
                        <Link href={`${publicPath}/${item[slugField]}`} target="_blank" className="text-xs text-gray-400 hover:underline">
                          公開側
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">← 管理トップ</Link>
      </div>
    </div>
  );
}
