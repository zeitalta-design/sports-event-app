"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const ACTION_LABELS = {
  license_revocation: "免許取消",
  business_suspension: "営業停止",
  improvement_order: "改善命令",
  warning: "指示・警告",
  guidance: "指導・勧告",
  other: "その他",
};
const ACTION_COLORS = {
  license_revocation: "text-red-700 bg-red-50 border-red-200",
  business_suspension: "text-orange-700 bg-orange-50 border-orange-200",
  improvement_order: "text-amber-700 bg-amber-50 border-amber-200",
  warning: "text-blue-700 bg-blue-50 border-blue-200",
  guidance: "text-gray-700 bg-gray-100 border-gray-200",
};
const REVIEW_STATUS = {
  pending: { label: "審査待ち", color: "bg-amber-100 text-amber-800 border-amber-300", icon: "?" },
  approved: { label: "承認済み", color: "bg-green-100 text-green-800 border-green-300", icon: "o" },
  rejected: { label: "却下", color: "bg-red-100 text-red-800 border-red-300", icon: "x" },
};

export default function GyoseiShobunAdminListPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(50);
  const [keyword, setKeyword] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [watchedKeys, setWatchedKeys] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [toast, setToast] = useState(null);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      params.set("page", String(page));
      const [listRes, watchRes, countsRes] = await Promise.all([
        fetch(`/api/admin/gyosei-shobun?${params}`),
        fetch("/api/admin/watchlist?mode=set"),
        fetch("/api/admin/gyosei-shobun?counts=1"),
      ]);
      const listData = await listRes.json();
      const watchData = await watchRes.json();
      const countsData = await countsRes.json();

      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setTotalPages(listData.totalPages || 1);
      setWatchedKeys(new Set(watchData.watchedKeys || []));
      setSelected(new Set());

      // ステータス件数はAPI全件ベースで取得
      if (countsData.statusCounts) {
        setStatusCounts(countsData.statusCounts);
      } else {
        // フォールバック: totalから推定
        setStatusCounts({ pending: 0, approved: listData.total || 0, rejected: 0, total: listData.total || 0 });
      }
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // キーワード変更時はページを1に戻す
  useEffect(() => { setPage(1); }, [keyword]);

  // フィルタ適用
  const filtered = reviewFilter === "all"
    ? items
    : items.filter((item) => (item.review_status || "pending") === reviewFilter);

  // ──── 選択操作 ────
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  // ──── MLIT手動取得 ────
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  async function handleManualSync() {
    if (syncing) return;
    if (!confirm("国交省から最新データを取得しますか？（数十秒かかります）")) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/cron/fetch-gyosei-shobun?maxPages=3", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSyncResult({ type: "success", message: `MLIT取得完了: ${data.totalFetched}件取得, ${data.created}件新規, ${data.updated}件更新 (${data.elapsed}秒)` });
        fetchItems();
      } else {
        setSyncResult({ type: "error", message: data.error || "取得に失敗しました" });
      }
    } catch {
      setSyncResult({ type: "error", message: "通信エラーが発生しました" });
    } finally {
      setSyncing(false);
    }
  }

  // ──── 都道府県別取得 ────
  const [prefSyncing, setPrefSyncing] = useState(false);

  async function handlePrefectureSync() {
    if (prefSyncing) return;
    if (!confirm("対応済み都道府県から最新データを取得しますか？（数十秒かかります）")) return;
    setPrefSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/cron/fetch-prefecture-shobun?max=5", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const totalItems = data.results.reduce((s, r) => s + (r.items || 0), 0);
        const totalCreated = data.results.reduce((s, r) => s + (r.created || 0), 0);
        setSyncResult({ type: "success", message: `都道府県取得完了: ${data.results.length}県から${totalItems}件取得, ${totalCreated}件新規 (${data.elapsed}秒)` });
        fetchItems();
      } else {
        setSyncResult({ type: "error", message: data.error || "取得に失敗しました" });
      }
    } catch {
      setSyncResult({ type: "error", message: "通信エラーが発生しました" });
    } finally {
      setPrefSyncing(false);
    }
  }

  // ──── 個別審査 ────
  async function handleReview(id, status) {
    try {
      const res = await fetch("/api/admin/gyosei-shobun/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        showToast(`${REVIEW_STATUS[status]?.label || status}に変更しました`);
        fetchItems();
      } else {
        const data = await res.json();
        showToast(data.error || "更新に失敗しました", "error");
      }
    } catch {
      showToast("通信エラーが発生しました", "error");
    }
  }

  // ──── 一括審査 ────
  async function handleBulkReview(status) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const label = REVIEW_STATUS[status]?.label || status;
    if (!confirm(`選択中の${ids.length}件を「${label}」にしますか？`)) return;

    setBulkAction(status === "approved" ? "approving" : "rejecting");
    try {
      const res = await fetch("/api/admin/gyosei-shobun/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`${data.updated}件を「${label}」に更新しました`);
        fetchItems();
      } else {
        showToast("一括更新に失敗しました", "error");
      }
    } catch {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setBulkAction(null);
    }
  }

  // ──── その他 ────
  function isItemWatched(item) {
    return watchedKeys.has(`${item.organization_name_raw}::${item.industry || ""}`);
  }

  async function toggleWatch(item) {
    const key = `${item.organization_name_raw}::${item.industry || ""}`;
    const watched = watchedKeys.has(key);
    try {
      await fetch("/api/admin/watchlist", {
        method: watched ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_name: item.organization_name_raw, industry: item.industry || "" }),
      });
      setWatchedKeys((prev) => {
        const next = new Set(prev);
        if (watched) next.delete(key); else next.add(key);
        return next;
      });
    } catch (err) { console.error("Toggle watch error:", err); }
  }

  async function togglePublish(id, current) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    try {
      await fetch(`/api/admin/gyosei-shobun/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, is_published: current ? 0 : 1 }),
      });
      fetchItems();
    } catch (err) { console.error("Toggle publish error:", err); }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">行政処分DB 管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            全{total}件
            {statusCounts.pending > 0 && <span className="text-amber-600 ml-2">（審査待ち {statusCounts.pending}件）</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleManualSync}
            disabled={syncing || prefSyncing}
            className={`text-sm border rounded-lg px-3 py-2 transition ${
              syncing ? "bg-gray-100 text-gray-400" : "hover:bg-green-50 hover:border-green-300 hover:text-green-700"
            }`}
          >
            {syncing ? "取得中..." : "MLIT更新"}
          </button>
          <button
            onClick={handlePrefectureSync}
            disabled={syncing || prefSyncing}
            className={`text-sm border rounded-lg px-3 py-2 transition ${
              prefSyncing ? "bg-gray-100 text-gray-400" : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            }`}
          >
            {prefSyncing ? "取得中..." : "都道府県更新"}
          </button>
          <Link href="/admin/watchlist" className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50">ウォッチリスト</Link>
          <Link href="/admin/gyosei-shobun/new" className="text-sm bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700">+ 新規作成</Link>
        </div>
      </div>

      {/* 同期結果 */}
      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${
          syncResult.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {syncResult.message}
          <button onClick={() => setSyncResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">x</button>
        </div>
      )}

      {/* ステータスカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { key: "all", label: "すべて", count: statusCounts.total, color: "bg-white border-gray-200 text-gray-800" },
          { key: "pending", label: "審査待ち", count: statusCounts.pending, color: "bg-amber-50 border-amber-200 text-amber-800" },
          { key: "approved", label: "承認済み", count: statusCounts.approved, color: "bg-green-50 border-green-200 text-green-800" },
          { key: "rejected", label: "却下", count: statusCounts.rejected, color: "bg-red-50 border-red-200 text-red-800" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => { setReviewFilter(s.key); setSelected(new Set()); }}
            className={`rounded-xl border p-3 text-left transition-all ${
              reviewFilter === s.key ? `${s.color} ring-2 ring-offset-1 ring-blue-400` : `${s.color} opacity-70 hover:opacity-100`
            }`}
          >
            <p className="text-xs font-medium mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.count}</p>
          </button>
        ))}
      </div>

      {/* 検索 + 一括操作バー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="事業者名・処分庁で検索..."
          className="border rounded-lg px-4 py-2 text-sm w-full sm:max-w-md"
        />

        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm font-bold text-blue-700">{selected.size}件選択中</span>
            <button
              onClick={() => handleBulkReview("approved")}
              disabled={!!bulkAction}
              className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {bulkAction === "approving" ? "処理中..." : "一括承認"}
            </button>
            <button
              onClick={() => handleBulkReview("rejected")}
              disabled={!!bulkAction}
              className="text-xs font-bold bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {bulkAction === "rejecting" ? "処理中..." : "一括却下"}
            </button>
            <button
              onClick={() => handleBulkReview("pending")}
              disabled={!!bulkAction}
              className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              一括保留
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline ml-1">解除</button>
          </div>
        )}
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="bg-white rounded-xl border p-8 animate-pulse"><div className="h-32 bg-gray-100 rounded" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          {reviewFilter !== "all" ? `「${REVIEW_STATUS[reviewFilter]?.label}」のデータがありません` : "データがありません"}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">ID</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">事業者名</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">処分種別</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">処分庁</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">処分日</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">審査</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">公開</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500 min-w-[200px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const watched = isItemWatched(item);
                const rs = REVIEW_STATUS[item.review_status || "pending"] || REVIEW_STATUS.pending;
                const isSelected = selected.has(item.id);
                return (
                  <tr key={item.id} className={`border-b transition ${isSelected ? "bg-blue-50/50" : "hover:bg-gray-50"}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="p-3 text-gray-400 text-xs">{item.id}</td>
                    <td className="p-3 text-gray-900 font-medium max-w-[200px] truncate">{item.organization_name_raw ?? "--"}</td>
                    <td className="p-3">
                      {item.action_type ? (
                        <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded border ${ACTION_COLORS[item.action_type] || ""}`}>
                          {ACTION_LABELS[item.action_type] || item.action_type}
                        </span>
                      ) : "--"}
                    </td>
                    <td className="p-3 text-gray-700 text-xs">{item.authority_name ?? "--"}</td>
                    <td className="p-3 text-gray-700 text-xs">{item.action_date?.substring(0, 10) || "--"}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg border ${rs.color}`}>
                        {rs.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => togglePublish(item.id, item.is_published)}
                        className={`text-xs px-2 py-1 rounded ${item.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {item.is_published ? "公開" : "非公開"}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5 items-center flex-wrap">
                        {(item.review_status || "pending") !== "approved" && (
                          <button onClick={() => handleReview(item.id, "approved")} className="text-[11px] font-bold bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">承認</button>
                        )}
                        {(item.review_status || "pending") !== "rejected" && (
                          <button onClick={() => handleReview(item.id, "rejected")} className="text-[11px] font-bold bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">却下</button>
                        )}
                        {(item.review_status || "pending") !== "pending" && (
                          <button onClick={() => handleReview(item.id, "pending")} className="text-[11px] font-bold bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600">保留</button>
                        )}
                        <span className="text-gray-200">|</span>
                        <button
                          onClick={() => toggleWatch(item)}
                          className={`text-[11px] px-1.5 py-1 rounded border ${watched ? "bg-amber-50 text-amber-700 border-amber-200" : "text-gray-400 border-gray-200 hover:text-amber-600"}`}
                        >
                          監視
                        </button>
                        <Link href={`/admin/gyosei-shobun/${item.id}/edit`} className="text-[11px] text-blue-600 hover:underline">編集</Link>
                        {item.slug && (
                          <Link href={`/gyosei-shobun/${item.slug}`} target="_blank" className="text-[11px] text-gray-400 hover:underline">公開</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      <div className="mt-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">管理トップ</Link>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 mr-2">
            {total > 0 ? `${(page - 1) * pageSize + 1}~${Math.min(page * pageSize, total)}件 / 全${total}件` : "0件"}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default"
              >
                最初
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default"
              >
                前へ
              </button>
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="text-xs px-1 py-1 text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`text-xs px-2.5 py-1 rounded border transition ${
                      p === page
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default"
              >
                次へ
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default"
              >
                最後
              </button>
            </div>
          )}
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${
            toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-800 text-white"
          }`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ページ番号リスト生成（1 2 ... 5 [6] 7 ... 13 14 のような表示）
 */
function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
