"use client";

import { useState, useEffect, useMemo } from "react";
import {
  SOURCE_REGISTRY,
  SECTORS,
  SOURCE_TYPE_LABELS,
  COVERAGE_LABELS,
  DISCOVERY_STATUS_LABELS,
  ALL_PREFECTURES,
  getRegisteredPrefectures,
  getMissingPrefectures,
  getCoverageMatrix,
} from "@/lib/gyosei-shobun-source-registry";

// ─── カテゴリ定義 ─────────────────────

const CATEGORIES = [
  { id: "gyosei-shobun", label: "行政処分", registrySectors: ["takken", "kensetsu", "architect_office"], description: "宅建業・建設業・建築士事務所の行政処分情報源" },
  { id: "sanpai", label: "産廃処分", registrySectors: ["sanpai"], description: "産業廃棄物処理業の行政処分情報源" },
  { id: "nyusatsu", label: "入札", dbDomain: "nyusatsu", description: "官公庁・自治体の入札・公募情報源" },
  { id: "shitei", label: "指定管理", dbDomain: "shitei", description: "自治体の指定管理者公募情報源" },
  { id: "hojokin", label: "補助金", dbDomain: "hojokin", description: "国・自治体の補助金・助成金情報源" },
  { id: "kyoninka", label: "許認可", dbDomain: "kyoninka", description: "許認可・登録事業者情報源" },
  { id: "food-recall", label: "食品リコール", dbDomain: "food-recall", description: "食品リコール・自主回収情報源" },
  { id: "yutai", label: "株主優待", dbDomain: "yutai", description: "上場企業の株主優待情報源" },
  { id: "minpaku", label: "民泊", dbDomain: "minpaku", description: "住宅宿泊事業者届出情報源" },
];

// ─── バッジ ─────────────────────

const STATUS_STYLES = {
  ok: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "正常" },
  warn: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "警告" },
  error: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "エラー" },
  unknown: { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", label: "未確認" },
  active: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "有効" },
  inactive: { bg: "bg-gray-50", text: "text-gray-400", border: "border-gray-200", label: "無効" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  return <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>;
}

const COVERAGE_CELL = {
  confirmed: { bg: "bg-green-100", text: "text-green-700", label: "確認済" },
  candidate: { bg: "bg-blue-100", text: "text-blue-700", label: "候補" },
  complemented: { bg: "bg-sky-50", text: "text-sky-600", label: "補完" },
  manual_review: { bg: "bg-amber-50", text: "text-amber-600", label: "要確認" },
  missing: { bg: "bg-red-50", text: "text-red-600", label: "未登録" },
};

function DiscoveryBadge({ status }) {
  const d = DISCOVERY_STATUS_LABELS[status];
  if (!d) return null;
  const colors = { green: "bg-green-50 text-green-700 border-green-200", blue: "bg-blue-50 text-blue-700 border-blue-200", amber: "bg-amber-50 text-amber-700 border-amber-200" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[d.color] || ""}`}>{d.label}</span>;
}

// ─── メインページ ─────────────────────

export default function DataSourceAuditPage() {
  const [activeCategory, setActiveCategory] = useState("gyosei-shobun");
  const [sectorFilter, setSectorFilter] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState("");
  const [auditResults, setAuditResults] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [dbSources, setDbSources] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeCat = CATEGORIES.find((c) => c.id === activeCategory);
  const isRegistryBased = !!activeCat?.registrySectors;
  const registrySectors = activeCat?.registrySectors || [];

  // DB カテゴリのソース取得
  useEffect(() => {
    if (isRegistryBased) return;
    setDbLoading(true);
    fetch(`/api/admin/ops/gyosei-shobun-sources?category=${activeCat.dbDomain}`)
      .then((r) => r.json())
      .then((data) => setDbSources(data.sources || []))
      .catch(() => setDbSources([]))
      .finally(() => setDbLoading(false));
  }, [activeCategory, isRegistryBased, activeCat?.dbDomain]);

  // レジストリソース
  const registrySources = useMemo(() => {
    if (!isRegistryBased) return [];
    let list = SOURCE_REGISTRY.filter((s) => registrySectors.includes(s.sector));
    if (sectorFilter) list = list.filter((s) => s.sector === sectorFilter);
    return list;
  }, [isRegistryBased, registrySectors, sectorFilter]);

  const sourcesWithAudit = useMemo(() => {
    return registrySources.map((s) => {
      const audit = auditResults?.find((r) => r.sourceId === s.id);
      return { ...s, audit: audit || null };
    });
  }, [registrySources, auditResults]);

  const filteredSources = useMemo(() => {
    let list = sourcesWithAudit;
    if (discoveryFilter) list = list.filter((s) => s.discoveryStatus === discoveryFilter);
    return list;
  }, [sourcesWithAudit, discoveryFilter]);

  // カバレッジ
  const coverageMatrix = useMemo(() => getCoverageMatrix(), []);

  // 分野別サマリー
  const sectorSummaries = useMemo(() => {
    return registrySectors.map((sec) => {
      const sources = SOURCE_REGISTRY.filter((s) => s.sector === sec);
      const registered = getRegisteredPrefectures(sec);
      const missing = getMissingPrefectures(sec);
      return {
        sector: sec,
        label: SECTORS[sec]?.short || sec,
        total: sources.length,
        active: sources.filter((s) => s.active).length,
        confirmed: sources.filter((s) => s.discoveryStatus === "confirmed").length,
        candidate: sources.filter((s) => s.discoveryStatus === "candidate").length,
        manualReview: sources.filter((s) => s.discoveryStatus === "manual_review").length,
        prefCovered: registered.length,
        prefMissing: missing.length,
      };
    });
  }, [registrySectors]);

  const totalSummary = useMemo(() => {
    return {
      total: sectorSummaries.reduce((s, v) => s + v.total, 0),
      active: sectorSummaries.reduce((s, v) => s + v.active, 0),
      confirmed: sectorSummaries.reduce((s, v) => s + v.confirmed, 0),
      candidate: sectorSummaries.reduce((s, v) => s + v.candidate, 0),
      manualReview: sectorSummaries.reduce((s, v) => s + v.manualReview, 0),
    };
  }, [sectorSummaries]);

  // 監査
  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch("/api/admin/ops/gyosei-shobun-sources/audit", { method: "POST" });
      const data = await res.json();
      setAuditResults(data.results || []);
    } catch { alert("監査の実行に失敗しました"); }
    finally { setAuditing(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">データソース監査</h1>
        <p className="text-sm text-gray-500">カテゴリ別の情報源管理・到達性監査・都道府県カバレッジ確認</p>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" /> 確認済 — 正式登録</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> 候補 — 調査中</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-400" /> 補完 — 上位ソースで補完</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> 要確認 — 手動確認必要</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> 未登録 — 情報源なし</span>
      </div>

      {/* カテゴリタブ */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setSectorFilter(""); setDiscoveryFilter(""); setShowAddForm(false); }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeCategory === cat.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* カテゴリ説明 */}
      <p className="text-xs text-gray-400 mb-4">{activeCat.description}</p>

      {/* ========== レジストリベースカテゴリ ========== */}
      {isRegistryBased && (
        <>
          {/* 分野別サマリー */}
          {sectorSummaries.length > 1 ? (
            <div className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {sectorSummaries.map((ss) => (
                  <button
                    key={ss.sector}
                    onClick={() => setSectorFilter(sectorFilter === ss.sector ? "" : ss.sector)}
                    className={`bg-white rounded-xl border p-4 text-left transition-all ${
                      sectorFilter === ss.sector ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900">{ss.label}</span>
                      <span className="text-[10px] text-gray-400">{ss.total}件</span>
                    </div>
                    <div className="flex gap-2 text-[10px]">
                      <span className="text-green-600">確認済 {ss.confirmed}</span>
                      <span className="text-blue-600">候補 {ss.candidate}</span>
                      <span className="text-amber-600">要確認 {ss.manualReview}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">
                      都道府県カバー: <span className={ss.prefMissing > 0 ? "text-red-500 font-bold" : "text-green-600 font-bold"}>{ss.prefCovered}/47</span>
                    </div>
                  </button>
                ))}
              </div>
              {sectorFilter && (
                <button onClick={() => setSectorFilter("")} className="text-[11px] text-blue-600 hover:underline">
                  × フィルタ解除（全分野表示）
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <SummaryCard label="情報源数" value={totalSummary.total} />
              <SummaryCard label="有効" value={totalSummary.active} />
              <SummaryCard label="確認済" value={totalSummary.confirmed} accent="green" />
              <SummaryCard label="候補" value={totalSummary.candidate} accent="blue" />
              <SummaryCard label="要確認" value={totalSummary.manualReview} accent="amber" />
              <SummaryCard label="都道府県カバー" value={`${sectorSummaries[0]?.prefCovered || 0}/47`} accent="green" />
              <SummaryCard label="未登録" value={sectorSummaries[0]?.prefMissing || 0} accent={sectorSummaries[0]?.prefMissing > 0 ? "red" : "green"} />
            </div>
          )}

          {/* フィルタ + 監査ボタン */}
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <select value={discoveryFilter} onChange={(e) => setDiscoveryFilter(e.target.value)} className="text-xs border rounded-lg px-3 py-2">
              <option value="">全登録状態</option>
              <option value="confirmed">確認済</option>
              <option value="candidate">候補</option>
              <option value="manual_review">要確認</option>
            </select>
            <button onClick={runAudit} disabled={auditing} className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${auditing ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
              {auditing ? "監査実行中..." : "到達性監査を実行"}
            </button>
            <span className="text-[11px] text-gray-400">{filteredSources.length}件表示</span>
          </div>

          {/* 情報源テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">
                {activeCat.label} 情報源一覧（{filteredSources.length}件）
                {sectorFilter && <span className="text-gray-400 font-normal ml-2">— {SECTORS[sectorFilter]?.short}のみ表示</span>}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left">
                    {registrySectors.length > 1 && <th className="px-3 py-2 font-medium">分野</th>}
                    <th className="px-3 py-2 font-medium">行政主体</th>
                    <th className="px-3 py-2 font-medium">都道府県</th>
                    <th className="px-3 py-2 font-medium">情報源名</th>
                    <th className="px-3 py-2 font-medium">種別</th>
                    <th className="px-3 py-2 font-medium">カバレッジ</th>
                    <th className="px-3 py-2 font-medium">登録</th>
                    <th className="px-3 py-2 font-medium">監査</th>
                    <th className="px-3 py-2 font-medium">メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSources.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      {registrySectors.length > 1 && (
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{SECTORS[s.sector]?.short || s.sector}</span>
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-gray-700">{s.authorityName}</td>
                      <td className="px-3 py-2.5 text-gray-500">{s.prefecture || "全国"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-900 font-medium">{s.sourceName}</span>
                          {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate max-w-[220px]">{s.url}</a>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{SOURCE_TYPE_LABELS[s.sourceType] || s.sourceType}</td>
                      <td className="px-3 py-2.5 text-gray-500">{COVERAGE_LABELS[s.coverageScope] || s.coverageScope}</td>
                      <td className="px-3 py-2.5"><DiscoveryBadge status={s.discoveryStatus} /></td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={s.audit?.status || "unknown"} />
                        {s.audit?.httpStatus && <span className="text-[10px] text-gray-400 ml-1">{s.audit.httpStatus}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 max-w-[180px]">
                        <span className="line-clamp-2" title={s.audit?.note || s.notes}>{s.audit?.note || s.notes || "-"}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredSources.length === 0 && (
                    <tr><td colSpan={registrySectors.length > 1 ? 9 : 8} className="px-3 py-8 text-center text-gray-400">条件に一致する情報源はありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 都道府県カバレッジマトリクス */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">都道府県カバレッジ（47都道府県）</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                各都道府県の情報源登録状況。
                {sectorSummaries.map((ss) => (
                  <span key={ss.sector} className="ml-2">{ss.label}: {ss.prefCovered}/47</span>
                ))}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left">
                    <th className="px-3 py-2 font-medium sticky left-0 bg-gray-50">都道府県</th>
                    {registrySectors.map((sec) => (
                      <th key={sec} className="px-3 py-2 font-medium text-center">{SECTORS[sec]?.short || sec}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {coverageMatrix.map((row) => (
                    <tr key={row.prefecture} className="hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 text-gray-700 font-medium sticky left-0 bg-white">{row.prefecture}</td>
                      {registrySectors.map((sector) => {
                        const cell = COVERAGE_CELL[row[sector]] || COVERAGE_CELL.missing;
                        return (
                          <td key={sector} className="px-3 py-1.5 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded ${cell.bg} ${cell.text}`}>{cell.label}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========== DBベースカテゴリ ========== */}
      {!isRegistryBased && (
        <>
          {dbLoading ? (
            <div className="py-16 text-center text-gray-400">読み込み中...</div>
          ) : (
            <>
              {/* サマリー */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <SummaryCard label="登録ソース数" value={dbSources.length} />
                <SummaryCard label="有効" value={dbSources.filter((s) => s.status === "active").length} accent="green" />
                <SummaryCard label="日次巡回" value={dbSources.filter((s) => s.run_frequency === "daily").length} accent="blue" />
                <SummaryCard label="最終確認" value={
                  dbSources.length > 0
                    ? dbSources.reduce((l, s) => (s.last_checked_at && s.last_checked_at > l ? s.last_checked_at : l), "").substring(0, 10) || "未確認"
                    : "—"
                } />
              </div>

              {/* 新規追加ボタン */}
              <div className="mb-6">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {showAddForm ? "閉じる" : "+ 新規情報源を追加"}
                </button>
              </div>

              {/* 新規追加フォーム */}
              {showAddForm && (
                <AddSourceForm
                  category={activeCat.dbDomain}
                  onAdded={() => {
                    setShowAddForm(false);
                    // リロード
                    fetch(`/api/admin/ops/gyosei-shobun-sources?category=${activeCat.dbDomain}`)
                      .then((r) => r.json())
                      .then((data) => setDbSources(data.sources || []));
                  }}
                />
              )}

              {/* ソーステーブル or 空状態 */}
              {dbSources.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{activeCat.label}のデータソース</h3>
                  <p className="text-sm text-gray-500 mb-2">このカテゴリにはまだデータソースが登録されていません。</p>
                  <p className="text-xs text-gray-400">上の「+ 新規情報源を追加」ボタンから登録できます。</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-bold text-gray-700">{activeCat.label} データソース一覧（{dbSources.length}件）</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-left">
                          <th className="px-3 py-2 font-medium">ソース名</th>
                          <th className="px-3 py-2 font-medium">種別</th>
                          <th className="px-3 py-2 font-medium">URL</th>
                          <th className="px-3 py-2 font-medium">取得方法</th>
                          <th className="px-3 py-2 font-medium">巡回頻度</th>
                          <th className="px-3 py-2 font-medium">最終確認</th>
                          <th className="px-3 py-2 font-medium">ステータス</th>
                          <th className="px-3 py-2 font-medium">メモ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dbSources.map((s) => (
                          <tr key={s.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 text-gray-900 font-medium">{s.source_name}</td>
                            <td className="px-3 py-2.5 text-gray-500">{s.source_type || "web"}</td>
                            <td className="px-3 py-2.5">
                              {s.source_url ? <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px] block">{s.source_url}</a> : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">{s.fetch_method || "manual"}</td>
                            <td className="px-3 py-2.5 text-gray-500">{s.run_frequency || "-"}</td>
                            <td className="px-3 py-2.5 text-gray-400">{s.last_checked_at?.substring(0, 10) || "未確認"}</td>
                            <td className="px-3 py-2.5"><StatusBadge status={s.status || "unknown"} /></td>
                            <td className="px-3 py-2.5 text-gray-400 max-w-[180px]"><span className="line-clamp-2">{s.notes || "-"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── 新規情報源追加フォーム ─────────────────────

function AddSourceForm({ category, onAdded }) {
  const [form, setForm] = useState({
    source_name: "",
    source_type: "web",
    source_url: "",
    fetch_method: "manual",
    run_frequency: "daily",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source_name.trim()) { setError("ソース名を入力してください"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ops/gyosei-shobun-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, domain_id: category }),
      });
      if (res.ok) {
        onAdded();
      } else {
        const data = await res.json();
        setError(data.error || "登録に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
      <h3 className="text-sm font-bold text-gray-900">新規情報源を追加</h3>
      {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ソース名 *</label>
          <input type="text" value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 東京都 産業廃棄物処理業者名簿" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
          <input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">取得方法</label>
          <select value={form.fetch_method} onChange={(e) => setForm({ ...form, fetch_method: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="manual">手動</option>
            <option value="scraping">自動スクレイピング</option>
            <option value="api">API連携</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">巡回頻度</label>
          <select value={form.run_frequency} onChange={(e) => setForm({ ...form, run_frequency: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="daily">毎日</option>
            <option value="weekly">週1回</option>
            <option value="monthly">月1回</option>
            <option value="manual">手動のみ</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="備考（任意）" />
      </div>
      <button type="submit" disabled={submitting} className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {submitting ? "登録中..." : "登録する"}
      </button>
    </form>
  );
}

// ─── サマリーカード ─────────────────────

function SummaryCard({ label, value, accent = "gray" }) {
  const colors = { gray: "text-gray-900", blue: "text-blue-600", green: "text-green-600", amber: "text-amber-600", red: "text-red-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent] || colors.gray}`}>{value}</p>
    </div>
  );
}
