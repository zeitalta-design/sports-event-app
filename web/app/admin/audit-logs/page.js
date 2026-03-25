"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const ACTION_OPTIONS = [
  { value: "", label: "すべてのアクション" },
  { value: "admin_item_created", label: "作成" },
  { value: "admin_item_updated", label: "更新" },
  { value: "login_success", label: "ログイン成功" },
  { value: "login_failed", label: "ログイン失敗" },
  { value: "logout", label: "ログアウト" },
  { value: "password_changed", label: "パスワード変更" },
];

function ActionBadge({ action }) {
  const colors = {
    admin_item_created: "bg-green-100 text-green-700",
    admin_item_updated: "bg-blue-100 text-blue-700",
    login_success: "bg-gray-100 text-gray-600",
    login_failed: "bg-red-100 text-red-700",
    logout: "bg-gray-100 text-gray-500",
  };
  const labels = {
    admin_item_created: "作成",
    admin_item_updated: "更新",
    login_success: "ログイン",
    login_failed: "ログイン失敗",
    logout: "ログアウト",
    password_changed: "PW変更",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[action] || "bg-gray-100 text-gray-600"}`}>
      {labels[action] || action}
    </span>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (q) params.set("q", q);
      params.set("page", String(page));
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Audit log fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [action, q, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">監査ログ</h1>
          <p className="text-sm text-gray-500 mt-1">{total}件の記録</p>
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="検索（slug, title, ID...）" className="border rounded-lg px-4 py-2 text-sm flex-1 max-w-md" />
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="card p-8 animate-pulse"><div className="h-32 bg-gray-100 rounded" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">監査ログがありません</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left text-xs font-bold text-gray-500">日時</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">アクション</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">ドメイン</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">対象</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">詳細</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">ユーザー</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{log.created_at?.replace("T", " ").substring(0, 19)}</td>
                  <td className="p-3"><ActionBadge action={log.action} /></td>
                  <td className="p-3 text-gray-700">{log.details?.domain || log.target_type || "—"}</td>
                  <td className="p-3 text-gray-900">
                    {log.details?.title && <span className="font-medium">{log.details.title}</span>}
                    {log.target_id && <span className="text-gray-400 ml-1">#{log.target_id}</span>}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {log.details?.slug && <span className="mr-2">{log.details.slug}</span>}
                    {log.details?.is_published_changed && (
                      <span className="text-amber-600">公開: {log.details.is_published_changed}</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">ID:{log.user_id || "—"}</td>
                  <td className="p-3 text-gray-400 text-xs">{log.ip_address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {page > 1 && <button onClick={() => setPage(page - 1)} className="btn-secondary text-xs">前へ</button>}
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          {page < totalPages && <button onClick={() => setPage(page + 1)} className="btn-secondary text-xs">次へ</button>}
        </div>
      )}

      <div className="mt-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">← 管理トップ</Link>
      </div>
    </div>
  );
}
