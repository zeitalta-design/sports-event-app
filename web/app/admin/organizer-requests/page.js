"use client";

import { useState, useEffect } from "react";

/**
 * Phase135: 運営修正依頼管理ページ
 *
 * /admin/organizer-requests — 依頼一覧と対応ステータス管理
 */

const STATUS_LABELS = {
  pending: { label: "未対応", color: "bg-red-100 text-red-700" },
  in_progress: { label: "対応中", color: "bg-amber-100 text-amber-700" },
  applied: { label: "反映済み", color: "bg-green-100 text-green-700" },
  needs_recheck: { label: "要再確認", color: "bg-purple-100 text-purple-700" },
};

const ROLE_LABELS = {
  organizer: "主催者",
  operator: "運営事務局",
  staff: "スタッフ",
  other: "その他",
};

export default function AdminOrganizerRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadRequests();
  }, [filterStatus]);

  async function loadRequests() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/organizer-requests?${params}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || {});
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      await fetch("/api/admin/organizer-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      loadRequests();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">運営リクエスト管理</h1>

      {/* KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { key: "pending", label: "未対応", count: stats.pending || 0, color: "text-red-600" },
          { key: "in_progress", label: "対応中", count: stats.in_progress || 0, color: "text-amber-600" },
          { key: "applied", label: "反映済み", count: stats.applied || 0, color: "text-green-600" },
          { key: "needs_recheck", label: "要再確認", count: stats.needs_recheck || 0, color: "text-purple-600" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilterStatus(filterStatus === item.key ? "" : item.key)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              filterStatus === item.key ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
            <p className="text-xs text-gray-500">{item.label}</p>
          </button>
        ))}
      </div>

      {/* テーブル */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">リクエストはありません</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const statusInfo = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
            const isExpanded = expandedId === req.id;
            return (
              <div key={req.id} className="border border-gray-200 rounded-lg bg-white">
                {/* ヘッダー行 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-gray-400 w-8">#{req.id}</span>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{req.event_name}</span>
                  <span className="text-xs text-gray-500">{ROLE_LABELS[req.requester_role] || req.requester_role}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(req.created_at)}</span>
                  <span className="text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                </button>

                {/* 展開詳細 */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                    {req.official_url && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">公式URL</p>
                        <a href={req.official_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                          {req.official_url}
                        </a>
                      </div>
                    )}
                    {req.correction_items && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">修正項目</p>
                        <p className="text-xs text-gray-700">{req.correction_items}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">修正内容</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{req.correction_content}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">連絡先</p>
                      <p className="text-xs text-gray-700">{req.contact_email}</p>
                    </div>
                    {req.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">備考</p>
                        <p className="text-xs text-gray-700">{req.notes}</p>
                      </div>
                    )}

                    {/* ステータス変更ボタン */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">ステータス変更:</span>
                      {Object.entries(STATUS_LABELS).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => updateStatus(req.id, key)}
                          disabled={req.status === key}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            req.status === key
                              ? `${info.color} border-current opacity-70`
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {info.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
