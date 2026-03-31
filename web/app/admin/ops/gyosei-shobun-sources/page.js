"use client";

import { useState, useMemo } from "react";
import {
  SOURCE_REGISTRY,
  SECTORS,
  SOURCE_TYPE_LABELS,
  COVERAGE_LABELS,
  DISCOVERY_STATUS_LABELS,
  EXPECTED_COVERAGE_LABELS,
  ALL_PREFECTURES,
  getSourcesBySector,
  getMissingPrefectures,
  getDiscoveryStatusCounts,
  getCoverageMatrix,
} from "@/lib/gyosei-shobun-source-registry";

// ─── ステータスバッジ ─────────────────────

const STATUS_STYLES = {
  ok: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "正常" },
  warn: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "警告" },
  error: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "エラー" },
  unknown: { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", label: "未確認" },
  missing: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", label: "未登録" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

// ─── カバレッジセル ─────────────────────

const COVERAGE_CELL = {
  confirmed: { bg: "bg-green-100", text: "text-green-700", label: "確認済" },
  candidate: { bg: "bg-blue-100", text: "text-blue-700", label: "候補" },
  complemented: { bg: "bg-sky-50", text: "text-sky-600", label: "MLIT補完" },
  manual_review: { bg: "bg-amber-50", text: "text-amber-600", label: "要確認" },
  missing: { bg: "bg-red-50", text: "text-red-600", label: "未登録" },
};

function DiscoveryBadge({ status }) {
  const d = DISCOVERY_STATUS_LABELS[status];
  if (!d) return null;
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[d.color] || ""}`}>
      {d.label}
    </span>
  );
}

// ─── メインページ ─────────────────────

export default function GyoseiShobunSourcesPage() {
  const [sectorFilter, setSectorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState("");
  const [auditResults, setAuditResults] = useState(null);
  const [auditing, setAuditing] = useState(false);

  const activeSources = SOURCE_REGISTRY.filter((s) => s.active);
  const discoveryCounts = useMemo(() => getDiscoveryStatusCounts(), []);
  const coverageMatrix = useMemo(() => getCoverageMatrix(), []);

  // 監査結果をマージした情報源リスト
  const sourcesWithStatus = useMemo(() => {
    return SOURCE_REGISTRY.map((s) => {
      const audit = auditResults?.find((r) => r.sourceId === s.id);
      return { ...s, audit: audit || null };
    });
  }, [auditResults]);

  // フィルタ適用
  const filteredSources = useMemo(() => {
    let list = sourcesWithStatus;
    if (sectorFilter) list = list.filter((s) => s.sector === sectorFilter);
    if (discoveryFilter) list = list.filter((s) => s.discoveryStatus === discoveryFilter);
    if (statusFilter) {
      list = list.filter((s) => {
        const st = s.audit?.status || "unknown";
        return st === statusFilter;
      });
    }
    return list;
  }, [sourcesWithStatus, sectorFilter, discoveryFilter, statusFilter]);

  // 監査実行
  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch("/api/admin/ops/gyosei-shobun-sources/audit", { method: "POST" });
      const data = await res.json();
      setAuditResults(data.results || []);
    } catch {
      alert("監査の実行に失敗しました");
    } finally {
      setAuditing(false);
    }
  };

  // 監査サマリー
  const auditSummary = useMemo(() => {
    if (!auditResults) return null;
    const counts = { ok: 0, warn: 0, error: 0, unknown: 0 };
    auditResults.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [auditResults]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">行政処分DB 情報源監査</h1>
        <p className="text-sm text-gray-500">情報源台帳の管理と到達性監査</p>
      </div>

      {/* ──── サマリーカード ──── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <SummaryCard label="総情報源数" value={SOURCE_REGISTRY.length} />
        <SummaryCard label="確認済" value={discoveryCounts.confirmed} accent="green" />
        <SummaryCard label="候補" value={discoveryCounts.candidate} accent="blue" />
        <SummaryCard label="要確認" value={discoveryCounts.manual_review} accent="amber" />
        <SummaryCard label="有効" value={activeSources.length} accent="gray" />
      </div>

      {/* 監査サマリー */}
      {auditSummary && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <SummaryCard label="正常" value={auditSummary.ok} accent="green" />
          <SummaryCard label="警告" value={auditSummary.warn} accent="amber" />
          <SummaryCard label="エラー" value={auditSummary.error} accent="red" />
          <SummaryCard label="未確認" value={auditSummary.unknown} accent="gray" />
        </div>
      )}

      {/* ──── フィルタ + 監査実行 ──── */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2"
        >
          <option value="">全分野</option>
          {Object.entries(SECTORS).map(([k, v]) => (
            <option key={k} value={k}>{v.short}</option>
          ))}
        </select>
        <select
          value={discoveryFilter}
          onChange={(e) => setDiscoveryFilter(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2"
        >
          <option value="">全登録状態</option>
          <option value="confirmed">確認済</option>
          <option value="candidate">候補</option>
          <option value="manual_review">要確認</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2"
        >
          <option value="">全監査状態</option>
          <option value="ok">正常</option>
          <option value="warn">警告</option>
          <option value="error">エラー</option>
          <option value="unknown">未確認</option>
        </select>
        <button
          onClick={runAudit}
          disabled={auditing}
          className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
            auditing
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {auditing ? "監査実行中..." : "到達性監査を実行"}
        </button>
        {auditResults && (
          <span className="text-[11px] text-gray-400">
            最終実行: {auditResults[0]?.checkedAt?.substring(0, 19).replace("T", " ") || "-"}
          </span>
        )}
      </div>

      {/* ──── 情報源一覧テーブル ──── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">情報源一覧（{filteredSources.length}件）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">分野</th>
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
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {SECTORS[s.sector]?.short || s.sector}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{s.authorityName}</td>
                  <td className="px-3 py-2.5 text-gray-500">{s.prefecture || "全国"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-900 font-medium">{s.sourceName}</span>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px]"
                        >
                          {s.url}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {SOURCE_TYPE_LABELS[s.sourceType] || s.sourceType}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {COVERAGE_LABELS[s.coverageScope] || s.coverageScope}
                  </td>
                  <td className="px-3 py-2.5">
                    <DiscoveryBadge status={s.discoveryStatus} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={s.audit?.status || "unknown"} />
                    {s.audit?.httpStatus && (
                      <span className="text-[10px] text-gray-400 ml-1">{s.audit.httpStatus}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 max-w-[180px]">
                    <span className="line-clamp-2" title={s.audit?.note || s.notes}>
                      {s.audit?.note || s.notes || "-"}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredSources.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    条件に一致する情報源はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──── 都道府県カバレッジ表 ──── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">都道府県カバレッジ</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            各都道府県に対して、分野ごとの情報源登録状況を表示します。「補完」は国交省集約ソースでカバーされている状態です。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">都道府県</th>
                <th className="px-3 py-2 font-medium text-center">宅建</th>
                <th className="px-3 py-2 font-medium text-center">建設</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coverageMatrix.map((row) => (
                <tr key={row.prefecture} className="hover:bg-gray-50/50">
                  <td className="px-3 py-1.5 text-gray-700 font-medium">{row.prefecture}</td>
                  {["takken", "kensetsu"].map((sector) => {
                    const cell = COVERAGE_CELL[row[sector]];
                    return (
                      <td key={sector} className="px-3 py-1.5 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${cell.bg} ${cell.text}`}>
                          {cell.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── サマリーカード ─────────────────────

function SummaryCard({ label, value, accent = "gray" }) {
  const colors = {
    gray: "text-gray-900",
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    orange: "text-orange-600",
    red: "text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent] || colors.gray}`}>{value}</p>
    </div>
  );
}
