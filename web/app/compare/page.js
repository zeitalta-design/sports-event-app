"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import {
  getCompareIds,
  removeCompareId,
  clearCompareIds,
  getMaxCompare,
} from "@/lib/compare-utils";
import { trackEvent, EVENTS } from "@/lib/analytics";
import CompareButton from "@/components/CompareButton";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";
import SuitabilityBadge from "@/components/SuitabilityBadge";
import { getStatusLabel, getStatusBadgeClass } from "@/lib/entry-status";
import { getRunnerProfile } from "@/lib/runner-profile";
import { buildDecisionSignals } from "@/lib/event-decision-signals";
import LoginPrompt from "@/components/LoginPrompt";
import EmptyState from "@/components/EmptyState";

// ─── ヘルパー ────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "未定";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
  } catch {
    return dateStr;
  }
}

function formatFee(feeRange) {
  if (!feeRange) return "—";
  if (feeRange.min === feeRange.max) {
    return `${feeRange.min.toLocaleString()}円`;
  }
  return `${feeRange.min.toLocaleString()}〜${feeRange.max.toLocaleString()}円`;
}

function formatDeadline(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dateStr;
  }
}

// ─── メインページ ─────────────────────────────────

export default function ComparePage() {
  const [marathons, setMarathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState([]);
  const [profile, setProfile] = useState(null);

  const fetchData = useCallback(async () => {
    const ids = getCompareIds();
    setCompareIds(ids);

    if (ids.length === 0) {
      setMarathons([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/compare?ids=${ids.join(",")}`);
      const data = await res.json();
      setMarathons(data.marathons || []);
    } catch {
      setMarathons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setProfile(getRunnerProfile());
    fetchData();
    trackEvent(EVENTS.COMPARE_VIEW, {
      compare_count: getCompareIds().length,
      source_page: "compare_page",
    });

    function onCompareChange() {
      fetchData();
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, [fetchData]);

  function handleRemove(id, title) {
    removeCompareId(id);
    trackEvent(EVENTS.COMPARE_REMOVE, {
      marathon_id: id,
      marathon_name: title,
      compare_count: getCompareIds().length,
      source_page: "compare_page",
    });
  }

  function handleClear() {
    const count = compareIds.length;
    clearCompareIds();
    trackEvent(EVENTS.COMPARE_CLEAR, {
      compare_count: count,
      source_page: "compare_page",
    });
  }

  // ── ローディング ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">大会比較</h1>
        <p className="text-sm text-gray-500 mb-6">読み込み中...</p>
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── 空状態 ──
  if (marathons.length === 0) {
    return <CompareEmptyState />;
  }

  const colCount = marathons.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">大会比較</h1>
          <p className="text-sm text-gray-500">
            {marathons.length}件の大会を比較しています
            {marathons.length < getMaxCompare() &&
              ` ・ あと${getMaxCompare() - marathons.length}件追加できます`}
          </p>
        </div>
        <button
          onClick={handleClear}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-300 transition-colors"
        >
          すべてクリア
        </button>
      </div>

      {/* 比較表 (横スクロール対応) */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div
          className="grid gap-0 border border-gray-200 rounded-xl overflow-hidden bg-white"
          style={{
            gridTemplateColumns: `140px repeat(${colCount}, minmax(200px, 1fr))`,
          }}
        >
          {/* ── 大会名ヘッダー行 ── */}
          <div className="bg-gray-50 p-3 border-b border-r border-gray-200 flex items-center">
            <span className="text-xs font-bold text-gray-500">大会名</span>
          </div>
          {marathons.map((m) => (
            <div
              key={`name-${m.id}`}
              className="bg-gray-50 p-3 border-b border-r border-gray-200 last:border-r-0"
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <Link
                  href={getEventDetailPath(m)}
                  className="text-sm font-bold text-blue-700 hover:text-blue-900 line-clamp-2 leading-snug"
                >
                  {m.title}
                </Link>
                <button
                  onClick={() => handleRemove(m.id, m.title)}
                  className="shrink-0 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="比較から外す"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
              {m.tagline && (
                <p className="text-xs text-gray-500 line-clamp-1">{m.tagline}</p>
              )}
            </div>
          ))}

          {/* ── 比較行 ── */}
          <CompareRow label="開催日" values={marathons.map((m) => formatDate(m.event_date))} />

          {/* Phase92: 募集状態 — OfficialStatusBadge 統一 */}
          <CompareRow
            label="募集状態"
            values={marathons.map((m) => (
              <OfficialStatusBadge key={m.id} event={m} variant="badge" showDeadline />
            ))}
          />

          {/* Phase92: 適性スコア（プロフィール存在時のみ） */}
          {profile && (
            <CompareRow
              label="あなたへの適性"
              values={marathons.map((m) => (
                <SuitabilityBadge key={m.id} event={m} variant="inline" profile={profile} />
              ))}
            />
          )}

          {/* Phase92: 判断シグナル */}
          <CompareRow
            label="注目ポイント"
            values={marathons.map((m) => {
              const signals = buildDecisionSignals(m);
              if (!signals.signals || signals.signals.length === 0) return "—";
              const top = signals.signals[0];
              const typeColors = {
                urgent: "text-red-600",
                caution: "text-amber-600",
                positive: "text-green-600",
                info: "text-blue-600",
              };
              return (
                <span key={m.id} className={`text-xs font-medium ${typeColors[top.type] || "text-gray-600"}`}>
                  {top.label}
                </span>
              );
            })}
          />

          {/* Phase192: 口コミ平均 */}
          <CompareRow
            label="口コミ評価"
            values={marathons.map((m) => {
              const s = m.reviewSummary;
              if (!s || !s.avg_overall || s.total === 0) return "—";
              return (
                <div key={m.id} className="flex items-center gap-1.5">
                  <span className="text-amber-500 text-sm">★</span>
                  <span className="font-bold text-gray-900 tabular-nums">{s.avg_overall.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({s.total}件)</span>
                </div>
              );
            })}
            highlight
          />

          {/* Phase192: 信頼スコア */}
          <CompareRow
            label="信頼スコア"
            values={marathons.map((m) => {
              const ts = m.trustScore;
              if (!ts || ts.score === 0) return "—";
              const colorMap = { emerald: "text-emerald-600", blue: "text-blue-600", amber: "text-amber-600", gray: "text-gray-500" };
              return (
                <div key={m.id} className="flex items-center gap-1.5">
                  <span className={`text-sm font-bold tabular-nums ${colorMap[ts.color] || "text-gray-600"}`}>
                    {ts.score}
                  </span>
                  <span className={`text-xs ${colorMap[ts.color] || "text-gray-500"}`}>{ts.label}</span>
                </div>
              );
            })}
            highlight
          />

          {/* Phase192: 写真数 */}
          <CompareRow
            label="写真"
            values={marathons.map((m) =>
              m.photoCount > 0 ? `${m.photoCount}枚` : "—"
            )}
          />

          {/* Phase192: 開催年数 */}
          <CompareRow
            label="開催年数"
            values={marathons.map((m) => {
              const h = m.eventHistory;
              if (!h || !h.editions || h.editions.length <= 1) return "—";
              return (
                <div key={m.id}>
                  <span className="font-bold text-gray-900 tabular-nums">{h.editions.length}</span>
                  <span className="text-xs text-gray-500 ml-0.5">年</span>
                </div>
              );
            })}
          />

          <CompareRow
            label="開催地"
            values={marathons.map((m) =>
              [m.prefecture, m.city].filter(Boolean).join(" ") || "—"
            )}
          />

          <CompareRow
            label="会場"
            values={marathons.map((m) => m.venue_name || "—")}
          />

          <CompareRow
            label="種目"
            values={marathons.map((m) =>
              m.distanceLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {m.distanceLabels.map((dl) => (
                    <span
                      key={dl}
                      className="inline-block px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                    >
                      {dl}
                    </span>
                  ))}
                </div>
              ) : (
                "—"
              )
            )}
          />

          <CompareRow
            label="参加費"
            values={marathons.map((m) => formatFee(m.feeRange))}
            highlight
          />

          <CompareRow
            label="制限時間"
            values={marathons.map((m) => {
              // time_limits (構造化データ) 優先、なければレースから
              const limits = m.time_limits.length > 0 ? m.time_limits : m.timeLimitsFromRaces;
              if (limits.length === 0) return "—";
              return (
                <div className="space-y-0.5">
                  {limits.slice(0, 3).map((tl, i) => (
                    <div key={i} className="text-xs">
                      {tl.race || tl.race_name ? (
                        <span className="text-gray-500">
                          {tl.race || tl.race_name}:{" "}
                        </span>
                      ) : null}
                      <span className="font-medium">
                        {tl.limit || tl.time_limit || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            highlight
          />

          <CompareRow
            label="申込締切"
            values={marathons.map((m) => formatDeadline(m.entry_end_date))}
          />

          <CompareRow
            label="特徴"
            values={marathons.map((m) =>
              m.features.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {m.features.slice(0, 5).map((f) => (
                    <span
                      key={f}
                      className="inline-block px-1.5 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded"
                    >
                      {f}
                    </span>
                  ))}
                  {m.features.length > 5 && (
                    <span className="text-xs text-gray-400">
                      +{m.features.length - 5}
                    </span>
                  )}
                </div>
              ) : (
                "—"
              )
            )}
          />

          <CompareRow
            label="レベル"
            values={marathons.map((m) =>
              m.level_labels.length > 0
                ? m.level_labels.join("、")
                : "—"
            )}
          />

          <CompareRow
            label="計測"
            values={marathons.map((m) => m.measurement_method || "—")}
          />

          <CompareRow
            label="アクセス"
            values={marathons.map((m) => {
              const parts = [m.venue_address, m.access_info].filter(Boolean);
              if (parts.length === 0) return "—";
              return (
                <div className="text-xs leading-relaxed line-clamp-3">
                  {parts.join(" / ")}
                </div>
              );
            })}
          />

          <CompareRow
            label="主催者"
            values={marathons.map((m) => m.organizer_name || "—")}
          />

          {/* ── 導線行 ── */}
          <div className="bg-gray-50 p-3 border-t border-r border-gray-200 flex items-center">
            <span className="text-xs font-bold text-gray-500">リンク</span>
          </div>
          {marathons.map((m) => (
            <div
              key={`links-${m.id}`}
              className="bg-gray-50 p-3 border-t border-r border-gray-200 last:border-r-0"
            >
              <div className="flex flex-col gap-1.5">
                <Link
                  href={getEventDetailPath(m)}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  詳細を見る →
                </Link>
                {m.entry_url && m.entry_status === "open" && (
                  <a
                    href={m.entry_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:text-green-800 hover:underline"
                  >
                    エントリー →
                  </a>
                )}
                {m.official_url && (
                  <a
                    href={m.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    公式サイト →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase92: 比較サマリー */}
      {marathons.length >= 2 && (
        <CompareSummary marathons={marathons} profile={profile} />
      )}

      {/* 補助メッセージ */}
      {marathons.length === 1 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-sm text-blue-700">
            もう1件追加すると比較しやすくなります。
            <Link
              href="/marathon"
              className="underline hover:text-blue-900 ml-1"
            >
              大会を探す →
            </Link>
          </p>
        </div>
      )}

      {/* Phase99: ログイン誘導 */}
      <div className="mt-6"><LoginPrompt /></div>

      {/* 下部ナビ */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-3 text-sm">
        <Link
          href="/my-events"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          検討中の大会
        </Link>
        <Link
          href="/saved"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          あとで見る
        </Link>
        <Link
          href="/alerts"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          見直しリスト
        </Link>
        <Link
          href="/marathon"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          大会を探す
        </Link>
      </div>
    </div>
  );
}

// ─── 比較行コンポーネント ─────────────────────────

function CompareRow({ label, values, highlight = false }) {
  // 値に差異があるかチェック（文字列のみ比較、JSXは対象外）
  const allStrings = values.every((v) => typeof v === "string");
  const hasDiff =
    highlight &&
    allStrings &&
    values.length > 1 &&
    !values.every((v) => v === values[0]);

  return (
    <>
      <div
        className={`p-3 border-b border-r border-gray-200 flex items-start ${
          hasDiff ? "bg-amber-50/50" : ""
        }`}
      >
        <span className="text-xs font-bold text-gray-500">{label}</span>
      </div>
      {values.map((val, idx) => (
        <div
          key={idx}
          className={`p-3 border-b border-r border-gray-200 last:border-r-0 text-sm text-gray-700 ${
            hasDiff ? "bg-amber-50/30" : ""
          }`}
        >
          {val}
        </div>
      ))}
    </>
  );
}

// ─── Phase92: 比較サマリー ───────────────────────────

function CompareSummary({ marathons, profile: summaryProfile }) {
  const insights = [];

  // 締切が最も近い大会
  const withDeadline = marathons
    .filter((m) => m.entry_end_date)
    .map((m) => ({ ...m, _deadline: new Date(m.entry_end_date) }))
    .filter((m) => !isNaN(m._deadline.getTime()) && m._deadline >= new Date())
    .sort((a, b) => a._deadline - b._deadline);

  if (withDeadline.length > 0) {
    insights.push({
      icon: "⏰",
      text: `締切が最も近いのは「${withDeadline[0].title}」（${formatDeadline(withDeadline[0].entry_end_date)}）`,
    });
  }

  // 適性が最も高い大会（プロフィールあり時）
  if (summaryProfile) {
    try {
      const { calculateSuitability } = require("@/lib/event-suitability");
      const suits = marathons.map((m) => ({
        title: m.title,
        suit: calculateSuitability(m, summaryProfile),
      }));
      const best = suits.sort((a, b) => b.suit.score - a.suit.score)[0];
      if (best.suit.score > 0) {
        insights.push({
          icon: "🎯",
          text: `適性が最も高いのは「${best.title}」（${best.suit.levelDef.label} ${best.suit.score}点）`,
        });
      }
    } catch {}
  }

  // Phase192: 口コミ評価が最も高い大会
  const withReviews = marathons
    .filter((m) => m.reviewSummary?.avg_overall && m.reviewSummary.total > 0)
    .sort((a, b) => b.reviewSummary.avg_overall - a.reviewSummary.avg_overall);
  if (withReviews.length > 0 && marathons.length >= 2) {
    const best = withReviews[0];
    insights.push({
      icon: "⭐",
      text: `口コミ評価が最も高いのは「${best.title}」（★${best.reviewSummary.avg_overall.toFixed(1)} / ${best.reviewSummary.total}件）`,
    });
  }

  // Phase192: 信頼スコアが最も高い大会
  const withTrust = marathons
    .filter((m) => m.trustScore?.score > 0)
    .sort((a, b) => b.trustScore.score - a.trustScore.score);
  if (withTrust.length > 0 && marathons.length >= 2) {
    const best = withTrust[0];
    insights.push({
      icon: "🛡️",
      text: `情報の充実度が最も高いのは「${best.title}」（${best.trustScore.label} ${best.trustScore.score}点）`,
    });
  }

  // 受付中の大会数
  const openCount = marathons.filter(
    (m) => ["open", "closing_soon", "capacity_warning"].includes(m.official_entry_status) || m.entry_status === "open"
  ).length;
  if (openCount > 0 && openCount < marathons.length) {
    insights.push({
      icon: "✅",
      text: `${marathons.length}件中${openCount}件が現在エントリー可能です`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
      <h3 className="text-sm font-bold text-indigo-800 mb-2 flex items-center gap-1.5">
        📊 比較まとめ
      </h3>
      <ul className="space-y-1.5">
        {insights.map((ins, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-indigo-700">
            <span>{ins.icon}</span>
            <span>{ins.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── 空状態 ──────────────────────────────────────

function CompareEmptyState() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">大会比較</h1>
      <p className="text-sm text-gray-500 mb-8">
        気になる大会を並べて比較できます
      </p>

      <div className="card">
        <EmptyState preset="compare" />
      </div>
    </div>
  );
}
