"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

const STATUS_LABELS = {
  pending: { label: "待機中", className: "bg-yellow-100 text-yellow-800" },
  sent: { label: "送信済", className: "bg-green-100 text-green-800" },
  failed: { label: "失敗", className: "bg-red-100 text-red-800" },
  skipped: { label: "スキップ", className: "bg-gray-100 text-gray-600" },
};

const TYPE_LABELS = {
  deadline_today: "当日締切",
  deadline_3d: "3日前締切",
  deadline_7d: "7日前締切",
  saved_search_match: "検索一致",
  favorite_deadline_today: "お気に入り当日",
  favorite_deadline_3d: "お気に入り3日前",
  favorite_deadline_7d: "お気に入り7日前",
};

export default function AdminEmailsPage() {
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, [page, statusFilter]);

  async function fetchEmails() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/emails?${params}`);
      const data = await res.json();
      setEmails(data.emails || []);
      setStats(data.stats || {});
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/generate-email-jobs", {
        method: "POST",
      });
      const data = await res.json();
      setGenResult(data);
      fetchEmails();
    } catch (err) {
      setGenResult({ success: false, error: err.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      setSendResult(data);
      fetchEmails();
    } catch (err) {
      setSendResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  async function handleRetryFailed() {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/admin/emails/retry-failed", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) fetchEmails();
    } catch (err) {
      console.error(err);
    } finally {
      setRetrying(false);
    }
  }

  const lastSent = emails.find((e) => e.status === "sent");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">メールキュー管理</h1>
      <p className="text-sm text-gray-500 mb-4">
        通知からのメール送信キューを管理します
      </p>
      <AdminNav />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "待機中", value: stats.pending || 0, color: "text-yellow-600" },
          { label: "送信済", value: stats.sent || 0, color: "text-green-600" },
          { label: "失敗", value: stats.failed || 0, color: "text-red-600" },
          { label: "合計", value: stats.total || 0, color: "text-gray-700" },
          { label: "対象ユーザー", value: stats.userCount || 0, color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Generate button */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">キュー生成</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              未メール化の通知からメールキューを生成します
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "生成中..." : "メールキューを生成"}
          </button>
        </div>
        {genResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm ${
              genResult.success
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {genResult.success ? (
              <>
                完了 — 生成: {genResult.total}件 / 新規挿入:{" "}
                {genResult.inserted}件 / スキップ: {genResult.skipped}件 (
                {genResult.durationMs}ms)
              </>
            ) : (
              <>エラー: {genResult.error}</>
            )}
          </div>
        )}
      </div>

      {/* Send button */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">メール送信</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              待機中のメールを実際に送信します（SMTP未設定時はEtherealテスト送信）
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(stats.failed || 0) > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={retrying}
                className="px-3 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {retrying ? "処理中..." : `失敗を再送 (${stats.failed}件)`}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={sending || !(stats.pending > 0)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? "送信中..." : `今すぐ送信 (${stats.pending || 0}件)`}
            </button>
          </div>
        </div>
        {sendResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm ${
              sendResult.success
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {sendResult.success ? (
              <>
                完了 — 対象: {sendResult.pending}件 / 送信済:{" "}
                {sendResult.sent}件 / 失敗: {sendResult.failed}件
                {sendResult.transporterInfo?.type === "ethereal" && (
                  <span className="block mt-1 text-xs text-gray-500">
                    Etherealテスト送信 — プレビューは各メールの詳細から確認できます
                  </span>
                )}
              </>
            ) : (
              <>エラー: {sendResult.error}</>
            )}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">ステータス:</span>
        {["", "pending", "sent", "failed", "skipped"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}
          >
            {s === "" ? "すべて" : STATUS_LABELS[s]?.label || s}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">全{total}件</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">
          メールキューがありません
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => {
            const st = STATUS_LABELS[email.status] || {
              label: email.status,
              className: "bg-gray-100 text-gray-600",
            };
            const isExpanded = expandedId === email.id;
            return (
              <div key={email.id} className={`card overflow-hidden ${email.status === "failed" ? "ring-1 ring-red-300" : ""} ${email.status === "sent" ? "opacity-75" : ""}`}>
                <div
                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                >
                  <span className="text-xs text-gray-400 font-mono w-8">
                    #{email.id}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.className}`}
                  >
                    {st.label}
                  </span>
                  <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded whitespace-nowrap">
                    {TYPE_LABELS[email.send_type] || email.send_type}
                  </span>
                  <span className="text-sm text-gray-800 truncate flex-1 font-medium">
                    {email.subject}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {email.user_name || email.to_email}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {(email.created_at || "").replace("T", " ").slice(0, 16)}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">送信先:</span>{" "}
                        <span className="text-gray-700">{email.to_email}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">ユーザー:</span>{" "}
                        <span className="text-gray-700">{email.user_name || email.user_key}{email.user_id ? ` (#${email.user_id})` : ""}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">notification_id:</span>{" "}
                        <span className="text-gray-700">
                          {email.notification_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">event_id:</span>{" "}
                        <span className="text-gray-700">
                          {email.event_id ? (
                            <Link
                              href={`/marathon/${email.event_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              #{email.event_id}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">作成日時:</span>{" "}
                        <span className="text-gray-700">
                          {(email.created_at || "").replace("T", " ").slice(0, 19)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">送信日時:</span>{" "}
                        <span className="text-gray-700">
                          {email.sent_at
                            ? email.sent_at.replace("T", " ").slice(0, 19)
                            : "-"}
                        </span>
                      </div>
                      {email.error_message && (
                        <div className="col-span-2">
                          <span className="text-gray-500">エラー:</span>{" "}
                          <span className="text-red-600">
                            {email.error_message}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">本文:</p>
                      <pre className="text-xs text-gray-700 bg-white border rounded p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                        {email.body_text}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-30"
          >
            前へ
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-30"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
