"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * MOSHICOM統合 検証レビュー画面
 *
 * 検証ログの一覧表示・手動レビュー・レポート表示
 */

const FILTERS = [
  { value: "all", label: "すべて" },
  { value: "matched", label: "マッチ(≥80)" },
  { value: "needs_check", label: "要確認(50-79)" },
  { value: "unmatched", label: "未マッチ" },
  { value: "pending", label: "未レビュー" },
  { value: "reviewed", label: "レビュー済" },
  { value: "error", label: "エラー" },
  { value: "selector_issues", label: "セレクタ問題" },
];

const REVIEW_LABELS = {
  correct: { label: "正しい", color: "bg-green-100 text-green-700" },
  incorrect: { label: "誤マッチ", color: "bg-red-100 text-red-700" },
  needs_adjustment: { label: "要調整", color: "bg-amber-100 text-amber-700" },
};

export default function MergeVerificationPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("score_desc");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // レビュー操作
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    loadData();
  }, [filter, sort, offset]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, sort, limit: LIMIT, offset });
      const res = await fetch(`/api/admin/merge-verification?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setReport(data.report || null);
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleReview(id, result) {
    try {
      await fetch("/api/admin/merge-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, review_result: result, review_note: reviewNote }),
      });
      setReviewingId(null);
      setReviewNote("");
      loadData();
    } catch {}
  }

  function scoreColor(score) {
    if (score >= 80) return "bg-green-200 text-green-800";
    if (score >= 50) return "bg-amber-200 text-amber-800";
    if (score > 0) return "bg-gray-200 text-gray-600";
    return "bg-red-100 text-red-500";
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <h1 className="text-xl font-bold text-gray-900 mb-1">
        🔬 統合検証レビュー
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        MOSHICOM検索マッチングの精度を検証・レビュー
      </p>

      {/* レポートカード */}
      {report && report.total > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          <ReportCard label="検証件数" value={report.total} />
          <ReportCard
            label="正常一致率"
            value={`${pct(report.high_score, report.total)}%`}
            target="≥90%"
            ok={report.high_score / report.total >= 0.9}
          />
          <ReportCard
            label="誤マッチ率"
            value={`${pct(report.reviewed_incorrect, report.total)}%`}
            target="≤3%"
            ok={report.reviewed_incorrect / report.total <= 0.03}
          />
          <ReportCard label="候補未検出" value={`${pct(report.no_result, report.total)}%`} />
          <ReportCard label="セレクタ問題" value={report.selector_issues} />
          <ReportCard label="未レビュー" value={report.pending_review} />
        </div>
      )}

      {/* レビュー進捗バー */}
      {report && report.total > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
            <span>レビュー進捗</span>
            <span className="font-medium text-gray-700">
              {(report.reviewed_correct || 0) + (report.reviewed_incorrect || 0) + (report.reviewed_needs_adj || 0)} / {report.total}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {report.reviewed_correct > 0 && (
              <div className="bg-green-500 h-full" style={{ width: `${(report.reviewed_correct / report.total) * 100}%` }} />
            )}
            {report.reviewed_incorrect > 0 && (
              <div className="bg-red-500 h-full" style={{ width: `${(report.reviewed_incorrect / report.total) * 100}%` }} />
            )}
            {report.reviewed_needs_adj > 0 && (
              <div className="bg-amber-400 h-full" style={{ width: `${(report.reviewed_needs_adj / report.total) * 100}%` }} />
            )}
          </div>
          <div className="flex gap-4 mt-1 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />正しい: {report.reviewed_correct || 0}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />誤マッチ: {report.reviewed_incorrect || 0}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />要調整: {report.reviewed_needs_adj || 0}</span>
          </div>
        </div>
      )}

      {/* フィルタ＋ソート */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setOffset(0); }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5"
          >
            <option value="score_desc">スコア高い順</option>
            <option value="score_asc">スコア低い順</option>
            <option value="date">日付順</option>
          </select>
          <span className="text-xs text-gray-400">{total}件</span>
        </div>
      </div>

      {/* ログ一覧 */}
      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">読み込み中...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm mb-2">検証ログがありません</p>
          <p className="text-xs">
            <code className="bg-gray-100 px-2 py-1 rounded">node scripts/verify-moshicom-match.js --limit 50</code>
            <br />を実行して検証データを生成してください
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`border rounded-lg p-4 ${
                log.review_result === "incorrect"
                  ? "border-red-200 bg-red-50"
                  : log.review_result === "correct"
                  ? "border-green-200 bg-green-50"
                  : log.review_result === "needs_adjustment"
                  ? "border-amber-200 bg-amber-50"
                  : "border-gray-100"
              }`}
            >
              {/* ヘッダー行 */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(log.score)}`}>
                      {log.score}点
                    </span>
                    {log.review_result && REVIEW_LABELS[log.review_result] && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${REVIEW_LABELS[log.review_result].color}`}>
                        {REVIEW_LABELS[log.review_result].label}
                      </span>
                    )}
                    {log.search_error && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        エラー
                      </span>
                    )}
                    {log.selector_errors_json && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                        セレクタ問題
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    RUNNET: {log.runnet_title}
                  </p>
                  {log.moshicom_title && (
                    <p className="text-sm text-blue-700 truncate mt-0.5">
                      MOSHICOM: {log.moshicom_title}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>ID:{log.event_id}</span>
                    <span>{log.event_date || "日付不明"}</span>
                    <span>{log.prefecture || ""}</span>
                    {log.moshicom_url && (
                      <a href={log.moshicom_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        MOSHICOM ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* セレクタエラー詳細 */}
              {log.selector_errors_json && (
                <div className="text-[10px] text-purple-600 bg-purple-50 rounded px-2 py-1 mb-2">
                  セレクタ: {JSON.parse(log.selector_errors_json).join(", ")}
                </div>
              )}

              {/* 検索エラー */}
              {log.search_error && (
                <div className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                  {log.search_error}
                </div>
              )}

              {/* 候補一覧（展開可能） */}
              {log.all_candidates_json && (
                <CandidatesList candidatesJson={log.all_candidates_json} />
              )}

              {/* レビューボタン */}
              {log.human_review === "pending" ? (
                reviewingId === log.id ? (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      placeholder="メモ（任意）"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(log.id, "correct")} className="px-3 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700">
                        正しい
                      </button>
                      <button onClick={() => handleReview(log.id, "incorrect")} className="px-3 py-1 text-[10px] bg-red-600 text-white rounded hover:bg-red-700">
                        誤マッチ
                      </button>
                      <button onClick={() => handleReview(log.id, "needs_adjustment")} className="px-3 py-1 text-[10px] bg-amber-500 text-white rounded hover:bg-amber-600">
                        要調整
                      </button>
                      <button onClick={() => setReviewingId(null)} className="px-3 py-1 text-[10px] text-gray-500 hover:text-gray-700">
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReviewingId(log.id)}
                    className="mt-2 text-[10px] text-blue-600 hover:underline"
                  >
                    レビューする →
                  </button>
                )
              ) : (
                log.review_note && (
                  <p className="mt-2 text-[10px] text-gray-500">メモ: {log.review_note}</p>
                )
              )}
            </div>
          ))}

          {/* ページング */}
          {total > LIMIT && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs bg-gray-100 rounded disabled:opacity-30"
              >
                前へ
              </button>
              <span className="text-xs text-gray-500 py-1.5">
                {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
              </span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                className="px-3 py-1.5 text-xs bg-gray-100 rounded disabled:opacity-30"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidatesList({ candidatesJson }) {
  const [open, setOpen] = useState(false);
  let candidates;
  try { candidates = JSON.parse(candidatesJson); } catch { return null; }
  if (!candidates || candidates.length <= 1) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-gray-500 hover:text-gray-700"
      >
        {open ? "▼" : "▶"} 他の候補 ({candidates.length - 1}件)
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-3 border-l-2 border-gray-100">
          {candidates.slice(1).map((c, i) => (
            <div key={i} className="text-[10px] text-gray-500 flex items-center gap-2">
              <span className="font-mono">{c.score}点</span>
              <span className="truncate flex-1">{c.title}</span>
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline shrink-0">
                  ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ label, value, target, ok }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
      <div className={`text-lg font-bold ${ok === false ? "text-red-600" : ok === true ? "text-green-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
      {target && (
        <div className={`text-[9px] mt-0.5 ${ok === false ? "text-red-400" : ok === true ? "text-green-400" : "text-gray-400"}`}>
          目標: {target}
        </div>
      )}
    </div>
  );
}

function pct(n, total) {
  if (!total || total === 0) return 0;
  return Math.round(((n || 0) / total) * 100);
}
