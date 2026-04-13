"use client";

import { useState, useEffect, useMemo } from "react";
import {
  SOURCE_REGISTRY,
  SECTORS,
  SOURCE_TYPE_LABELS,
  COVERAGE_LABELS,
  DISCOVERY_STATUS_LABELS,
  ALL_PREFECTURES,
  getSourcesBySector,
  getRegisteredPrefectures,
  getMissingPrefectures,
  getCoverageMatrix,
} from "@/lib/gyosei-shobun-source-registry";

// ─── カテゴリ定義 ─────────────────────
// registrySector: SOURCE_REGISTRY内のsectorキー（あればレジストリ表示）
// dbDomain: data_sourcesテーブルのdomain_id（あればDB表示）

const CATEGORIES = [
  { id: "gyosei-shobun", label: "行政処分", registrySectors: ["takken", "kensetsu", "architect_office"] },
  { id: "sanpai", label: "産廃処分", registrySectors: ["sanpai"] },
  { id: "nyusatsu", label: "入札", dbDomain: "nyusatsu" },
  { id: "shitei", label: "指定管理", dbDomain: "shitei" },
  { id: "hojokin", label: "補助金", dbDomain: "hojokin" },
  { id: "kyoninka", label: "許認可", dbDomain: "kyoninka" },
  { id: "food-recall", label: "食品リコール", dbDomain: "food-recall" },
  { id: "yutai", label: "株主優待", dbDomain: "yutai" },
  { id: "minpaku", label: "民泊", dbDomain: "minpaku" },
];

// ─── バッジコンポーネント ─────────────────────

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
  const [discoveryFilter, setDiscoveryFilter] = useState("");
  const [auditResults, setAuditResults] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [dbSources, setDbSources] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);

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

  // ─── レジストリベースのデータ ─────
  const registrySources = useMemo(() => {
    if (!isRegistryBased) return [];
    return SOURCE_REGISTRY.filter((s) => registrySectors.includes(s.sector));
  }, [isRegistryBased, registrySectors]);

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

  // カバレッジマトリクス（該当sectorのみ）
  const coverageMatrix = useMemo(() => getCoverageMatrix(), []);

  // サマリー
  const summary = useMemo(() => {
    const sources = registrySources;
    return {
      total: sources.length,
      active: sources.filter((s) => s.active).length,
      confirmed: sources.filter((s) => s.discoveryStatus === "confirmed").length,
      candidate: sources.filter((s) => s.discoveryStatus === "candidate").length,
      manual_review: sources.filter((s) => s.discoveryStatus === "manual_review").length,
      prefCovered: getRegisteredPrefectures(registrySectors[0] || "").length,
      prefMissing: getMissingPrefectures(registrySectors[0] || "").length,
    };
  }, [registrySources, registrySectors]);

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

  const auditSummary = useMemo(() => {
    if (!auditResults) return null;
    const relevant = auditResults.filter((r) => registrySources.some((s) => s.id === r.sourceId));
    const counts = { ok: 0, warn: 0, error: 0, unknown: 0 };
    relevant.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [auditResults, registrySources]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">データソース監査</h1>
        <p className="text-sm text-gray-500">カテゴリ別の情報源管理・到達性監査・カバレッジ確認</p>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" /> 確認済み — 正式登録</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> 候補 — 調査中</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-400" /> 補完 — 上位ソースで補完</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> 未登録 — 情報源なし</span>
      </div>

      {/* カテゴリタブ */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setDiscoveryFilter(""); }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeCategory === cat.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ──── レジストリベースカテゴリ（行政処分・産廃） ──── */}
      {isRegistryBased && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <SummaryCard label="情報源数" value={summary.total} />
            <SummaryCard label="有効" value={summary.active} />
            <SummaryCard label="確認済" value={summary.confirmed} accent="green" />
            <SummaryCard label="候補" value={summary.candidate} accent="blue" />
            <SummaryCard label="要確認" value={summary.manual_review} accent="amber" />
            <SummaryCard label="都道府県カバー" value={`${summary.prefCovered}/47`} accent="green" />
            <SummaryCard label="未登録都道府県" value={summary.prefMissing} accent={summary.prefMissing > 0 ? "red" : "green"} />
          </div>

          {/* 監査サマリー */}
          {auditSummary && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              <SummaryCard label="正常" value={auditSummary.ok} accent="green" />
              <SummaryCard label="警告" value={auditSummary.warn} accent="amber" />
              <SummaryCard label="エラー" value={auditSummary.error} accent="red" />
              <SummaryCard label="未確認" value={auditSummary.unknown} />
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
            <span className="text-[11px] text-gray-400">
              {filteredSources.length}件表示
            </span>
          </div>

          {/* 情報源テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">
                {activeCat.label} 情報源一覧（{filteredSources.length}件）
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
              <h2 className="text-sm font-bold text-gray-700">都道府県カバレッジ</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">各都道府県の情報源登録状況。47都道府県中 {summary.prefCovered}件カバー済み。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left">
                    <th className="px-3 py-2 font-medium">都道府県</th>
                    {registrySectors.map((sec) => (
                      <th key={sec} className="px-3 py-2 font-medium text-center">{SECTORS[sec]?.short || sec}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {coverageMatrix.map((row) => (
                    <tr key={row.prefecture} className="hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 text-gray-700 font-medium">{row.prefecture}</td>
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

      {/* ──── DBベースカテゴリ ──── */}
      {!isRegistryBased && (
        <>
          {dbLoading ? (
            <div className="py-16 text-center text-gray-400">読み込み中...</div>
          ) : dbSources.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{activeCat.label}のデータソース</h3>
              <p className="text-sm text-gray-500 mb-4">このカテゴリにはまだデータソースが登録されていません。</p>
              <p className="text-xs text-gray-400">管理者がデータソースを登録すると、ここに一覧表示されます。</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <SummaryCard label="登録ソース数" value={dbSources.length} />
                <SummaryCard label="有効" value={dbSources.filter((s) => s.status === "active").length} accent="green" />
                <SummaryCard label="日次巡回" value={dbSources.filter((s) => s.run_frequency === "daily").length} accent="blue" />
                <SummaryCard label="最終確認" value={dbSources.reduce((l, s) => (s.last_checked_at && s.last_checked_at > l ? s.last_checked_at : l), "-").substring(0, 10)} />
              </div>
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
            </>
          )}
        </>
      )}
    </div>
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
