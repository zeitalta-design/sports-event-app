"use client";
import { useState, useEffect } from "react";

const STATUS_LABELS = {
  success: { label: "成功", className: "bg-green-100 text-green-800" },
  failed: { label: "失敗", className: "bg-red-100 text-red-800" },
  running: { label: "実行中", className: "bg-yellow-100 text-yellow-800" },
  partial_success: {
    label: "一部成功",
    className: "bg-orange-100 text-orange-800",
  },
};

export default function AdminJobsPage() {
  const [dailyJobs, setDailyJobs] = useState([]);
  const [todayJob, setTodayJob] = useState(null);
  const [stats, setStats] = useState({});
  const [userStats, setUserStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchDailyJobs();
  }, [page]);

  async function fetchDailyJobs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      const res = await fetch(`/api/admin/daily-jobs?${params}`);
      const data = await res.json();
      setDailyJobs(data.jobs || []);
      setTodayJob(data.todayJob || null);
      setStats(data.stats || {});
      setUserStats(data.userStats || {});
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunNow() {
    if (running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/run-daily-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setRunResult(data);
      fetchDailyJobs();
    } catch (err) {
      setRunResult({ success: false, error: err.message });
    } finally {
      setRunning(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return dateStr.replace("T", " ").slice(0, 19);
  }

  function formatDuration(ms) {
    if (ms == null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function parseSummary(json) {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">運用ダッシュボード</h1>
      <p className="text-sm text-gray-500 mb-4">
        日次ジョブの実行状況を確認・管理します
      </p>

      {/* 今日のサマリーカード */}
      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-900 text-sm mb-3">今日の実行状況</h2>
        {todayJob ? (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">
                  {todayJob.notifications_inserted ?? 0}
                </p>
                <p className="text-xs text-gray-500">通知挿入</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-600">
                  {todayJob.email_jobs_inserted ?? 0}
                </p>
                <p className="text-xs text-gray-500">メールキュー</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">
                  {todayJob.emails_sent ?? 0}
                </p>
                <p className="text-xs text-gray-500">メール送信</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-600">
                  {todayJob.emails_failed ?? 0}
                </p>
                <p className="text-xs text-gray-500">メール失敗</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                ステータス:{" "}
                <span
                  className={`inline-block px-2 py-0.5 rounded-full font-medium ${
                    (STATUS_LABELS[todayJob.status] || {}).className ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {(STATUS_LABELS[todayJob.status] || {}).label || todayJob.status}
                </span>
              </span>
              <span>実行時間: {formatDuration(todayJob.duration_ms)}</span>
              <span>開始: {formatDate(todayJob.started_at)}</span>
              {todayJob.error_message && (
                <span className="text-red-500">
                  エラー: {todayJob.error_message}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            今日はまだ実行されていません
          </p>
        )}
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">
            {stats.total || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">総実行数</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {stats.success || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">成功</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">
            {stats.partial_success || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">一部成功</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {stats.failed || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">失敗</p>
        </div>
      </div>

      {/* ユーザー統計 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{userStats.totalUsers || 0}</p>
          <p className="text-xs text-gray-500 mt-1">アクティブユーザー</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{userStats.usersWithNotifications || 0}</p>
          <p className="text-xs text-gray-500 mt-1">通知あり</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{userStats.usersWithEmailJobs || 0}</p>
          <p className="text-xs text-gray-500 mt-1">メールキューあり</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{userStats.usersWithPendingEmails || 0}</p>
          <p className="text-xs text-gray-500 mt-1">未送信メールあり</p>
        </div>
      </div>

      {/* 手動実行 */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">日次ジョブ手動実行</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              通知生成 → メールキュー生成を実行します
            </p>
          </div>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? "実行中..." : "今すぐ実行"}
          </button>
        </div>
        {runResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm ${
              runResult.success
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {runResult.success ? (
              <>
                日次ジョブ #{runResult.dailyJobId} {runResult.status} — 通知挿入:{" "}
                {runResult.notifications_inserted}件 / メールキュー:{" "}
                {runResult.email_jobs_inserted}件 / 送信: {runResult.emails_sent}件
                ({runResult.durationMs}ms)
              </>
            ) : (
              <>エラー: {runResult.error}</>
            )}
          </div>
        )}
      </div>

      {/* 実行履歴 */}
      <h2 className="font-bold text-gray-900 text-sm mb-3">実行履歴</h2>
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded" />
          ))}
        </div>
      ) : dailyJobs.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">
          実行履歴がありません
        </div>
      ) : (
        <div className="space-y-2">
          {dailyJobs.map((job) => {
            const st = STATUS_LABELS[job.status] || {
              label: job.status,
              className: "bg-gray-100 text-gray-600",
            };
            const isExpanded = expandedId === job.id;
            const summary = parseSummary(job.summary_json);
            return (
              <div
                key={job.id}
                className={`card overflow-hidden ${
                  job.status === "failed" ? "ring-1 ring-red-300" : ""
                }`}
              >
                <div
                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                >
                  <span className="text-xs text-gray-400 font-mono w-8">
                    #{job.id}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.className}`}
                  >
                    {st.label}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    {job.run_date}
                  </span>
                  <span className="flex-1 text-xs text-gray-500">
                    通知:{job.notifications_inserted ?? 0} / メール:
                    {job.email_jobs_inserted ?? 0} / 送信:{job.emails_sent ?? 0}
                    {(job.emails_failed || 0) > 0 && (
                      <span className="text-red-500">
                        {" "}/ 失敗:{job.emails_failed}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {formatDuration(job.duration_ms)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(job.started_at).slice(5)}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">対象日:</span>{" "}
                        <span className="text-gray-700">{job.run_date}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">開始:</span>{" "}
                        <span className="text-gray-700">
                          {formatDate(job.started_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">完了:</span>{" "}
                        <span className="text-gray-700">
                          {formatDate(job.finished_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">通知生成:</span>{" "}
                        <span className="text-gray-700">
                          {job.notifications_generated}件
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">通知挿入:</span>{" "}
                        <span className="text-gray-700">
                          {job.notifications_inserted}件
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">メールキュー:</span>{" "}
                        <span className="text-gray-700">
                          {job.email_jobs_generated}件 → {job.email_jobs_inserted}件挿入
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">メール送信:</span>{" "}
                        <span className="text-gray-700">
                          {job.emails_sent}件
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">メール失敗:</span>{" "}
                        <span
                          className={
                            (job.emails_failed || 0) > 0
                              ? "text-red-600"
                              : "text-gray-700"
                          }
                        >
                          {job.emails_failed}件
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">メール送信:</span>{" "}
                        <span className="text-gray-700">
                          {job.with_email_send ? "ON" : "OFF"}
                        </span>
                      </div>
                      {job.error_message && (
                        <div className="col-span-full">
                          <span className="text-gray-500">エラー:</span>{" "}
                          <span className="text-red-600">
                            {job.error_message}
                          </span>
                        </div>
                      )}
                    </div>
                    {summary && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          ステップ詳細:
                        </p>
                        <pre className="text-xs text-gray-700 bg-white border rounded p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                          {JSON.stringify(summary, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ページネーション */}
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
