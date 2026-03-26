"use client";

import { useState, useEffect, useCallback } from "react";

const DOMAIN_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "food-recall", label: "食品リコール" },
  { value: "sanpai", label: "産廃" },
  { value: "kyoninka", label: "許認可" },
  { value: "shitei", label: "指定管理" },
];

const TAB_ITEMS = [
  { key: "sync-runs", label: "同期履歴" },
  { key: "changes", label: "差分" },
  { key: "review", label: "要確認" },
  { key: "ai-extractions", label: "AI抽出" },
  { key: "notifications", label: "通知" },
  { key: "sources", label: "ソース" },
];

function formatDt(s) { return s ? s.replace("T", " ").substring(0, 19) : "—"; }

// --- 同期履歴タブ ---------------------

function SyncRunsTab({ domainId }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (domainId) params.set("domain_id", domainId);
    fetch(`/api/admin/automation/sync-runs?${params}`)
      .then((r) => r.json())
      .then((d) => setRuns(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domainId]);

  if (loading) return <p className="text-sm text-gray-500 p-4">読み込み中...</p>;
  if (runs.length === 0) return <p className="text-sm text-gray-500 p-4">同期履歴はありません</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b bg-gray-50">
          <th className="py-2 px-3 text-left">ID</th>
          <th className="py-2 px-3 text-left">ドメイン</th>
          <th className="py-2 px-3 text-left">ソース</th>
          <th className="py-2 px-3 text-left">タイプ</th>
          <th className="py-2 px-3 text-left">状態</th>
          <th className="py-2 px-3 text-right">取得</th>
          <th className="py-2 px-3 text-right">新規</th>
          <th className="py-2 px-3 text-right">更新</th>
          <th className="py-2 px-3 text-right">確認</th>
          <th className="py-2 px-3 text-right">失敗</th>
          <th className="py-2 px-3 text-left">開始</th>
        </tr></thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-3 font-mono">{r.id}</td>
              <td className="py-2 px-3">{r.domain_id}</td>
              <td className="py-2 px-3">{r.source_name || "—"}</td>
              <td className="py-2 px-3">{r.run_type}</td>
              <td className="py-2 px-3">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  r.run_status === "completed" ? "bg-green-100 text-green-700" :
                  r.run_status === "running" ? "bg-blue-100 text-blue-700" :
                  "bg-red-100 text-red-700"
                }`}>{r.run_status}</span>
              </td>
              <td className="py-2 px-3 text-right">{r.fetched_count}</td>
              <td className="py-2 px-3 text-right font-bold text-green-600">{r.created_count || 0}</td>
              <td className="py-2 px-3 text-right font-bold text-blue-600">{r.updated_count || 0}</td>
              <td className="py-2 px-3 text-right font-bold text-amber-600">{r.review_count || 0}</td>
              <td className="py-2 px-3 text-right text-red-600">{r.failed_count || 0}</td>
              <td className="py-2 px-3 text-gray-500">{formatDt(r.started_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- 差分タブ ---------------------

function ChangesTab({ domainId, reviewOnly }) {
  const [changes, setChanges] = useState([]);
  const [reviewPending, setReviewPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchChanges = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (domainId) params.set("domain_id", domainId);
    if (reviewOnly) params.set("requires_review", "true");
    fetch(`/api/admin/automation/change-logs?${params}`)
      .then((r) => r.json())
      .then((d) => { setChanges(d.items || []); setReviewPending(d.reviewPending || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domainId, reviewOnly]);

  useEffect(() => { fetchChanges(); }, [fetchChanges]);

  async function handleReview(id) {
    await fetch(`/api/admin/automation/change-logs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_reviewed" }),
    });
    fetchChanges();
  }

  if (loading) return <p className="text-sm text-gray-500 p-4">読み込み中...</p>;
  if (changes.length === 0) return <p className="text-sm text-gray-500 p-4">{reviewOnly ? "要確認の差分はありません" : "差分はありません"}</p>;

  return (
    <div>
      {reviewOnly && reviewPending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
          要確認: {reviewPending}件
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-gray-50">
            <th className="py-2 px-3 text-left">ID</th>
            <th className="py-2 px-3 text-left">ドメイン</th>
            <th className="py-2 px-3 text-left">タイプ</th>
            <th className="py-2 px-3 text-left">Slug</th>
            <th className="py-2 px-3 text-left">変化種別</th>
            <th className="py-2 px-3 text-left">フィールド</th>
            <th className="py-2 px-3 text-left">Before</th>
            <th className="py-2 px-3 text-left">After</th>
            <th className="py-2 px-3 text-left">確認</th>
            <th className="py-2 px-3 text-left">日時</th>
          </tr></thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.id} className={`border-b hover:bg-gray-50 ${c.requires_review && !c.reviewed_at ? "bg-amber-50/50" : ""}`}>
                <td className="py-2 px-3 font-mono">{c.id}</td>
                <td className="py-2 px-3">{c.domain_id}</td>
                <td className="py-2 px-3">{c.entity_type}</td>
                <td className="py-2 px-3 font-mono text-xs max-w-32 truncate">{c.entity_slug || `#${c.entity_id}`}</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    c.change_type === "created" ? "bg-green-100 text-green-700" :
                    c.change_type === "updated" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>{c.change_type}</span>
                </td>
                <td className="py-2 px-3">{c.field_name || "—"}</td>
                <td className="py-2 px-3 max-w-24 truncate text-gray-500">{c.before_value || "—"}</td>
                <td className="py-2 px-3 max-w-24 truncate font-bold">{c.after_value || "—"}</td>
                <td className="py-2 px-3">
                  {c.requires_review && !c.reviewed_at ? (
                    <button onClick={() => handleReview(c.id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">確認</button>
                  ) : c.reviewed_at ? (
                    <span className="text-xs text-green-600">済</span>
                  ) : "—"}
                </td>
                <td className="py-2 px-3 text-gray-500">{formatDt(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- 通知タブ ---------------------

function NotificationsTab({ domainId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (domainId) params.set("domain_id", domainId);
    fetch(`/api/admin/automation/notifications?${params}`)
      .then((r) => r.json())
      .then((d) => setNotifications(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domainId]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  async function markRead(id) {
    await fetch(`/api/admin/automation/notifications/${id}`, { method: "PUT" });
    fetchNotifs();
  }

  if (loading) return <p className="text-sm text-gray-500 p-4">読み込み中...</p>;
  if (notifications.length === 0) return <p className="text-sm text-gray-500 p-4">通知はありません</p>;

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <div key={n.id} className={`border rounded-lg p-3 ${n.read_at ? "bg-white" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  n.notification_type === "warning" ? "bg-amber-100 text-amber-700" :
                  n.notification_type === "error" ? "bg-red-100 text-red-700" :
                  "bg-blue-100 text-blue-700"
                }`}>{n.notification_type}</span>
                <span className="text-sm font-bold text-gray-900">{n.title}</span>
              </div>
              {n.message && <p className="text-xs text-gray-600 mt-1">{n.message}</p>}
              <p className="text-xs text-gray-400 mt-1">{formatDt(n.created_at)}</p>
            </div>
            {!n.read_at && (
              <button onClick={() => markRead(n.id)} className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 shrink-0">既読</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- AI抽出タブ ---------------------

function AiExtractionsTab({ domainId }) {
  const [extractions, setExtractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);

  const fetchExtractions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (domainId) params.set("domain_id", domainId);
    fetch(`/api/admin/automation/ai-extractions?${params}`)
      .then((r) => r.json())
      .then((d) => setExtractions(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domainId]);

  useEffect(() => { fetchExtractions(); }, [fetchExtractions]);

  async function handleApplySingle(id) {
    setApplying(id);
    try {
      await fetch("/api/admin/automation/ai-extractions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction_id: id }),
      });
      fetchExtractions();
    } catch {} finally { setApplying(null); }
  }

  async function handleBulkApply() {
    if (!domainId) { alert("ドメインを選択してください"); return; }
    setApplying("bulk");
    try {
      const res = await fetch("/api/admin/automation/ai-extractions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: domainId, bulk: true }),
      });
      const result = await res.json();
      alert(`反映完了: ${result.applied || 0}件 (${result.fieldsUpdated || 0}項目)`);
      fetchExtractions();
    } catch {} finally { setApplying(null); }
  }

  if (loading) return <p className="text-sm text-gray-500 p-4">読み込み中...</p>;
  if (extractions.length === 0) return <p className="text-sm text-gray-500 p-4">AI抽出結果はありません</p>;

  // P分類カウント
  const pending = extractions.filter(e => !e.applied_at);
  const p1Count = pending.filter(e => e.confidence_score >= 0.5 && e.quality_level !== "raw").length;

  return (
    <div>
      {/* サマリー + 一括反映ボタン */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex gap-4 text-xs">
          <span>総件数: <strong>{extractions.length}</strong></span>
          <span>未反映: <strong className="text-blue-600">{pending.length}</strong></span>
          <span>P1候補: <strong className="text-green-600">{p1Count}</strong></span>
          <span>反映済: <strong className="text-gray-500">{extractions.length - pending.length}</strong></span>
        </div>
        {domainId && p1Count > 0 && (
          <button
            onClick={handleBulkApply}
            disabled={applying === "bulk"}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {applying === "bulk" ? "反映中..." : `P1一括反映 (${p1Count}件)`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-gray-50">
            <th className="py-2 px-3 text-left">ID</th>
            <th className="py-2 px-3 text-left">ドメイン</th>
            <th className="py-2 px-3 text-left">Slug</th>
            <th className="py-2 px-3 text-left">品質</th>
            <th className="py-2 px-3 text-right">信頼度</th>
            <th className="py-2 px-3 text-left">モデル</th>
            <th className="py-2 px-3 text-right">トークン</th>
            <th className="py-2 px-3 text-left">操作</th>
            <th className="py-2 px-3 text-left">日時</th>
          </tr></thead>
          <tbody>
            {extractions.map((e) => {
              const isP1 = !e.applied_at && e.confidence_score >= 0.5 && e.quality_level !== "raw";
              return (
                <tr key={e.id} className={`border-b hover:bg-gray-50 ${e.applied_at ? "" : isP1 ? "bg-green-50/30" : "bg-blue-50/30"}`}>
                  <td className="py-2 px-3 font-mono">{e.id}</td>
                  <td className="py-2 px-3">{e.domain_id}</td>
                  <td className="py-2 px-3 font-mono text-xs max-w-32 truncate">{e.entity_slug || `#${e.entity_id}`}</td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      e.quality_level === "good" ? "bg-green-100 text-green-700" :
                      e.quality_level === "draft" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{e.quality_level}</span>
                    {isP1 && <span className="ml-1 text-xs text-green-600 font-bold">P1</span>}
                  </td>
                  <td className="py-2 px-3 text-right">{(e.confidence_score || 0).toFixed(2)}</td>
                  <td className="py-2 px-3">{e.llm_model || "—"}</td>
                  <td className="py-2 px-3 text-right">{e.llm_tokens_used || 0}</td>
                  <td className="py-2 px-3">
                    {e.applied_at ? (
                      <span className="text-xs text-green-600">反映済</span>
                    ) : isP1 ? (
                      <button onClick={() => handleApplySingle(e.id)} disabled={applying === e.id} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        {applying === e.id ? "..." : "反映"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-500">{formatDt(e.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- ソースタブ ---------------------

function SourcesTab({ domainId }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (domainId) params.set("domain_id", domainId);
    fetch(`/api/admin/automation/sources?${params}`)
      .then((r) => r.json())
      .then((d) => setSources(d.sources || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domainId]);

  if (loading) return <p className="text-sm text-gray-500 p-4">読み込み中...</p>;
  if (sources.length === 0) return <p className="text-sm text-gray-500 p-4">ソースが登録されていません</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b bg-gray-50">
          <th className="py-2 px-3 text-left">ID</th>
          <th className="py-2 px-3 text-left">ドメイン</th>
          <th className="py-2 px-3 text-left">名前</th>
          <th className="py-2 px-3 text-left">種類</th>
          <th className="py-2 px-3 text-left">取得方法</th>
          <th className="py-2 px-3 text-left">状態</th>
          <th className="py-2 px-3 text-left">公開ポリシー</th>
          <th className="py-2 px-3 text-left">最終成功</th>
        </tr></thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-3 font-mono">{s.id}</td>
              <td className="py-2 px-3">{s.domain_id}</td>
              <td className="py-2 px-3 font-bold">{s.source_name}</td>
              <td className="py-2 px-3">{s.source_type}</td>
              <td className="py-2 px-3">{s.fetch_method}</td>
              <td className="py-2 px-3">
                <span className={`px-1.5 py-0.5 rounded text-xs ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{s.status}</span>
              </td>
              <td className="py-2 px-3">{s.publish_policy}</td>
              <td className="py-2 px-3 text-gray-500">{formatDt(s.last_success_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- メインページ ---------------------

export default function AutomationDashboard() {
  const [tab, setTab] = useState("sync-runs");
  const [domainId, setDomainId] = useState("");

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">自動化ダッシュボード</h1>

      <div className="flex items-center gap-4 mb-4">
        <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          {DOMAIN_OPTIONS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
        </select>
      </div>

      <div className="flex gap-1 border-b mb-4">
        {TAB_ITEMS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-4">
        {tab === "sync-runs" && <SyncRunsTab domainId={domainId} />}
        {tab === "changes" && <ChangesTab domainId={domainId} reviewOnly={false} />}
        {tab === "review" && <ChangesTab domainId={domainId} reviewOnly={true} />}
        {tab === "ai-extractions" && <AiExtractionsTab domainId={domainId} />}
        {tab === "notifications" && <NotificationsTab domainId={domainId} />}
        {tab === "sources" && <SourcesTab domainId={domainId} />}
      </div>
    </div>
  );
}
