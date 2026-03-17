"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";
import ResultsPrivacyNote from "@/components/ResultsPrivacyNote";
import EventRecapCard from "@/components/EventRecapCard";
import EventMemoEditor from "@/components/EventMemoEditor";
import RunnerStatsCard from "@/components/RunnerStatsCard";
import ReviewPromptBanner from "@/components/ReviewPromptBanner";

/**
 * Phase169: My Results ページ — 振り返り体験強化版
 *
 * タブ: 振り返り / 全記録 / 自己ベスト / 成長推移 / タイムライン
 * 参加後ループの中心ページ。
 */

const FINISH_STATUS_LABELS = {
  finished: { label: "完走", color: "text-green-600" },
  dnf: { label: "DNF", color: "text-red-500" },
  dns: { label: "DNS", color: "text-gray-400" },
  dq: { label: "DQ", color: "text-red-600" },
};

const VIEW_TABS = [
  { key: "recap", label: "振り返り" },
  { key: "all", label: "全記録" },
  { key: "pbs", label: "自己ベスト" },
  { key: "timeline", label: "タイムライン" },
  { key: "growth", label: "成長推移" },
];

export default function MyResultsPage() {
  const { user, isLoggedIn, isLoading: authLoading } = useAuthStatus();
  const [results, setResults] = useState([]);
  const [pbs, setPbs] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [recapItems, setRecapItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("recap");
  const [growthCategory, setGrowthCategory] = useState("");
  const [unlinking, setUnlinking] = useState(null);

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn, view, growthCategory]);

  async function loadData() {
    setLoading(true);
    try {
      if (view === "recap") {
        const [recapRes, resultsRes] = await Promise.all([
          fetch("/api/recap?list=1"),
          fetch("/api/my-results"),
        ]);
        const recapData = await recapRes.json();
        const resultsData = await resultsRes.json();
        setRecapItems(recapData.items || []);
        setResults(resultsData.results || []);
        setPbs(resultsData.pbs || []);
        setTotal(resultsData.total || 0);
      } else if (view === "pbs") {
        const res = await fetch("/api/my-results?view=pbs");
        const data = await res.json();
        setPbs(data.pbs || []);
      } else if (view === "growth") {
        const url = `/api/my-results?view=growth${growthCategory ? `&category=${encodeURIComponent(growthCategory)}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        setGrowth(data.growth || []);
      } else {
        const res = await fetch("/api/my-results");
        const data = await res.json();
        setResults(data.results || []);
        setPbs(data.pbs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load my results:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink(resultId) {
    if (!confirm("この結果の紐付けを解除しますか?")) return;
    setUnlinking(resultId);
    try {
      await fetch("/api/my-results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result_id: resultId }),
      });
      loadData();
    } catch (err) {
      console.error("Failed to unlink:", err);
    } finally {
      setUnlinking(null);
    }
  }

  if (authLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center"><p className="text-sm text-gray-400">読み込み中...</p></div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-3xl mb-3">🏅</p>
        <h1 className="text-lg font-bold text-gray-900 mb-2">あなたのスポーツ履歴</h1>
        <p className="text-sm text-gray-500 mb-4">
          大会記録の管理、振り返り、成長の可視化。ログインして始めましょう。
        </p>
        <Link href="/login" className="inline-flex px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          ログイン
        </Link>
      </div>
    );
  }

  const categories = [...new Set(results.filter((r) => r.category_name).map((r) => r.category_name))].sort();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total}件の大会記録 — あなたのスポーツ履歴` : "大会記録を紐付けて、振り返りを始めましょう"}
          </p>
        </div>
        <Link href="/my-results/link" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          結果を追加
        </Link>
      </div>

      {/* Phase191: Runner Stats */}
      {(view === "recap" || view === "all") && <RunnerStatsCard />}

      {/* Phase201: 口コミ投稿プロンプト（未レビュー結果がある場合） */}
      {(view === "recap" || view === "all") && results.length > 0 && (
        <div className="mb-4">
          <ReviewPromptBanner variant="my-results" />
        </div>
      )}

      {/* PBカード（recap/allビュー時） */}
      {(view === "recap" || view === "all") && pbs.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">🏆 自己ベスト</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pbs.map((pb) => (
              <div key={pb.category} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{pb.category}</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{pb.finish_time}</p>
                {pb.net_time && pb.net_time !== pb.finish_time && (
                  <p className="text-xs text-gray-400 tabular-nums">ネット: {pb.net_time}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{pb.event_title} ({pb.result_year}){pb.overall_rank && ` — ${pb.overall_rank}位`}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="flex items-center gap-0 mb-4 border-b border-gray-200 overflow-x-auto scrollbar-none">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              view === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 成長ビューのカテゴリフィルタ */}
      {view === "growth" && categories.length > 0 && (
        <div className="mb-4">
          <select value={growthCategory} onChange={(e) => setGrowthCategory(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600">
            <option value="">全カテゴリ</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* コンテンツ */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : view === "recap" ? (
        <RecapView recapItems={recapItems} results={results} />
      ) : view === "all" ? (
        <AllResultsView results={results} unlinking={unlinking} onUnlink={handleUnlink} />
      ) : view === "pbs" ? (
        <PBsView pbs={pbs} />
      ) : view === "timeline" ? (
        <TimelineView results={results} />
      ) : (
        <GrowthView growth={growth} />
      )}

      {/* 空状態 */}
      {!loading && total === 0 && (view === "all" || view === "recap") && (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🏅</p>
          <p className="text-sm text-gray-500 mb-2">大会に参加したら、結果を記録しましょう</p>
          <p className="text-xs text-gray-400 mb-4">ゼッケン番号で簡単に紐付けできます</p>
          <Link href="/my-results/link" className="inline-flex px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            最初の結果を追加する
          </Link>
        </div>
      )}

      {/* 次大会CTA（記録がある場合） */}
      {!loading && total > 0 && (view === "recap" || view === "all") && (
        <div className="mt-6 card p-5 text-center bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
          <p className="text-sm font-medium text-gray-700 mb-2">振り返りが済んだら、次の挑戦へ</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/next-race" className="px-4 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-full hover:bg-blue-50 transition-colors">
              🎯 次のレースを見つける
            </Link>
            <Link href="/marathon" className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
              🔍 大会を探す
            </Link>
          </div>
        </div>
      )}

      {/* プライバシー */}
      <div className="mt-8">
        <ResultsPrivacyNote variant="personal" />
      </div>
    </div>
  );
}

// --- Phase169: 振り返りビュー ---
function RecapView({ recapItems, results }) {
  if (recapItems.length === 0 && results.length === 0) return null;

  // recapItemsがあればそれを使い、なければresultsから簡易カード
  const items = recapItems.length > 0 ? recapItems : results;

  if (recapItems.length > 0) {
    return (
      <div className="space-y-4">
        {recapItems.map((item) => (
          <div key={`${item.event_id}-${item.result_year}`} className="card overflow-hidden">
            {/* 写真バナー */}
            {item.heroPhotoUrl && (
              <div className="relative" style={{ aspectRatio: "21/6" }}>
                <img src={item.heroPhotoUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="text-white text-sm font-bold truncate">{item.title}</p>
                  <p className="text-white/70 text-xs">{item.result_year}年{item.prefecture && ` · ${item.prefecture}`}</p>
                </div>
              </div>
            )}
            <div className="p-4">
              {!item.heroPhotoUrl && (
                <Link href={`/marathon/${item.event_id}`} className="text-sm font-bold text-gray-900 hover:text-blue-600 block mb-2">
                  {item.title} <span className="text-xs text-gray-400 font-normal">({item.result_year})</span>
                </Link>
              )}

              {/* 結果 */}
              {item.finish_time && (
                <div className="flex items-center gap-3 mb-3">
                  <div className={`px-3 py-1.5 rounded-lg ${item.finish_status === "finished" ? "bg-green-50" : "bg-gray-50"}`}>
                    <p className={`text-lg font-bold tabular-nums ${item.finish_status === "finished" ? "text-green-600" : "text-gray-600"}`}>
                      {item.finish_time}
                    </p>
                  </div>
                  <div>
                    {item.overall_rank && <p className="text-sm text-gray-600">総合 <strong>{item.overall_rank}</strong>位</p>}
                    {item.category_name && <p className="text-xs text-gray-400">{item.category_name}</p>}
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {!item.hasReview && (
                  <Link href={`/reviews/new?event_id=${item.event_id}&event_title=${encodeURIComponent(item.title)}&sport_type=${item.sport_type || "marathon"}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-full border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    data-track="recap_write_review">
                    ✍️ 口コミを書く
                  </Link>
                )}
                {item.hasReview && <span className="text-xs text-green-500 px-2 py-1">口コミ投稿済み</span>}
                {item.photoCount > 0 && (
                  <Link href={`/marathon/${item.event_id}/photos`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-full border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    data-track="recap_view_photos">
                    📸 写真{item.photoCount}枚
                  </Link>
                )}
                <Link href={`/marathon/${item.event_id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-full border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                  data-track="recap_find_similar">
                  🔍 似た大会を探す
                </Link>
              </div>

              {/* メモエディタ */}
              <div className="pt-2">
                <EventMemoEditor eventId={item.event_id} phaseFilter="after" compact />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // fallback: シンプルなカード
  return (
    <div className="space-y-3">
      {results.map((r) => (
        <div key={r.result_id} className="card p-4">
          <Link href={`/marathon/${r.event_id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
            {r.event_title}
          </Link>
          {r.finish_time && <p className="text-lg font-bold text-gray-800 tabular-nums mt-1">{r.finish_time}</p>}
        </div>
      ))}
    </div>
  );
}

// --- Phase173: タイムラインビュー ---
function TimelineView({ results }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">結果を追加するとタイムラインが表示されます</p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => {
    if (a.result_year !== b.result_year) return a.result_year - b.result_year;
    return (a.event_date || "").localeCompare(b.event_date || "");
  });

  // マイルストーン判定
  const milestones = new Set();
  const seenCategories = new Set();
  for (const r of sorted) {
    if (r.category_name && !seenCategories.has(r.category_name)) {
      milestones.add(r.result_id);
      seenCategories.add(r.category_name);
    }
  }

  let prevYear = null;

  return (
    <div className="relative pl-8">
      {/* タイムライン軸 */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

      {sorted.map((r, idx) => {
        const showYear = r.result_year !== prevYear;
        prevYear = r.result_year;
        const isMilestone = milestones.has(r.result_id);
        const status = FINISH_STATUS_LABELS[r.finish_status] || FINISH_STATUS_LABELS.finished;

        return (
          <div key={r.result_id}>
            {/* 年度マーカー */}
            {showYear && (
              <div className="relative mb-3 -ml-8 pl-8">
                <div className="absolute left-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center z-10">
                  {String(r.result_year).slice(2)}
                </div>
                <p className="text-sm font-bold text-gray-700 pt-0.5">{r.result_year}年</p>
              </div>
            )}

            {/* イベントカード */}
            <div className="relative mb-4">
              <div className={`absolute -left-[21px] w-3 h-3 rounded-full z-10 ${isMilestone ? "bg-yellow-400 ring-2 ring-yellow-100" : "bg-gray-300"}`} />
              <div className="card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/marathon/${r.event_id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block">
                      {r.event_title || `大会 #${r.event_id}`}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {r.category_name && <span className="text-xs text-gray-500">{r.category_name}</span>}
                      <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                      {r.event_date && <span className="text-[10px] text-gray-400">{r.event_date}</span>}
                    </div>
                    {isMilestone && (
                      <p className="text-[10px] text-yellow-600 font-medium mt-1">{r.category_name}初参加</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {r.finish_time && <p className="text-base font-bold tabular-nums text-gray-900">{r.finish_time}</p>}
                    {r.overall_rank && <p className="text-[10px] text-gray-400">{r.overall_rank}位</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- 全記録ビュー ---
function AllResultsView({ results, unlinking, onUnlink }) {
  if (results.length === 0) return null;

  const grouped = {};
  for (const r of results) {
    const year = r.result_year || "不明";
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(r);
  }
  const sortedYears = Object.keys(grouped).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {sortedYears.map((year) => (
        <div key={year}>
          <h3 className="text-sm font-bold text-gray-700 mb-2">{year}年</h3>
          <div className="space-y-2">
            {grouped[year].map((r) => {
              const status = FINISH_STATUS_LABELS[r.finish_status] || FINISH_STATUS_LABELS.finished;
              return (
                <div key={r.result_id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link href={`/marathon/${r.event_id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {r.event_title || `大会 #${r.event_id}`}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {r.category_name && <span className="text-xs text-gray-500">{r.category_name}</span>}
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                        {r.event_date && <span className="text-xs text-gray-400">{r.event_date}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {r.finish_time && <p className="text-lg font-bold text-gray-900 tabular-nums">{r.finish_time}</p>}
                      {r.overall_rank && <p className="text-xs text-gray-500">{r.overall_rank}位</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                    {r.bib_number && <span>No.{r.bib_number}</span>}
                    {r.net_time && r.net_time !== r.finish_time && <span>ネット: {r.net_time}</span>}
                    {r.gender_rank && <span>性別順位: {r.gender_rank}位</span>}
                    {r.age_rank && <span>年代順位: {r.age_rank}位</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <div className="flex gap-2">
                      <Link href={`/marathon/${r.event_id}/photos`} className="text-xs text-blue-500 hover:text-blue-700 transition-colors" data-track="results_view_photos">📸 写真</Link>
                      <Link href={`/reviews/new?event_id=${r.event_id}&event_title=${encodeURIComponent(r.event_title)}`} className="text-xs text-blue-500 hover:text-blue-700 transition-colors" data-track="results_write_review">✍️ 口コミ</Link>
                    </div>
                    <button onClick={() => onUnlink(r.result_id)} disabled={unlinking === r.result_id}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                      {unlinking === r.result_id ? "解除中..." : "紐付け解除"}
                    </button>
                  </div>
                  <EventMemoEditor eventId={r.event_id} phaseFilter="after" compact />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PBsView({ pbs }) {
  if (pbs.length === 0) {
    return <div className="text-center py-8"><p className="text-sm text-gray-400">完走記録を紐付けると自己ベストが表示されます</p></div>;
  }
  return (
    <div className="space-y-3">
      {pbs.map((pb) => (
        <div key={pb.category} className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{pb.category}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{pb.finish_time}</p>
              {pb.net_time && pb.net_time !== pb.finish_time && <p className="text-sm text-gray-400 tabular-nums">ネット: {pb.net_time}</p>}
            </div>
            <div className="text-right">
              {pb.overall_rank && <p className="text-lg font-bold text-gray-700">{pb.overall_rank}<span className="text-xs font-normal text-gray-400">位</span></p>}
              <p className="text-xs text-gray-400">{pb.result_year}年</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">{pb.event_title}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Phase196: 成長グラフ — CSS-based time progression chart
 *
 * 横棒グラフでタイム推移を可視化。
 * ・棒の長さ = タイム（短い = 良い → 棒が短い = 右寄り表示）
 * ・PBライン表示
 * ・改善/悪化の色分け
 */
function GrowthView({ growth }) {
  if (growth.length === 0) {
    return <div className="text-center py-8"><p className="text-sm text-gray-400">同じ距離カテゴリの完走記録が2回以上になると、タイムの推移を確認できます</p></div>;
  }

  // タイムを秒に変換して範囲を計算
  const withSeconds = growth.map((item) => ({
    ...item,
    seconds: timeToSeconds(item.finish_time),
  })).filter((item) => item.seconds > 0);

  if (withSeconds.length < 2) {
    return (
      <div className="space-y-2">
        {growth.map((item) => (
          <GrowthListItem key={`${item.event_id}-${item.result_year}`} item={item} growth={growth} />
        ))}
      </div>
    );
  }

  const minTime = Math.min(...withSeconds.map((d) => d.seconds));
  const maxTime = Math.max(...withSeconds.map((d) => d.seconds));
  const range = maxTime - minTime || 1;
  // グラフ範囲: min-10%, max+10%
  const chartMin = Math.max(0, minTime - range * 0.1);
  const chartMax = maxTime + range * 0.1;
  const chartRange = chartMax - chartMin;
  const pbSeconds = minTime;

  // PB位置(%)
  const pbPercent = ((pbSeconds - chartMin) / chartRange) * 100;

  return (
    <div className="space-y-6" data-track="growth_chart_view">
      {/* CSSグラフ */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          📊 タイム推移グラフ
        </h3>

        <div className="relative">
          {/* PBライン */}
          <div
            className="absolute top-0 bottom-0 w-px bg-green-400 z-10"
            style={{ left: `${pbPercent}%` }}
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-green-600 font-bold whitespace-nowrap">
              PB
            </span>
          </div>

          <div className="space-y-2 pt-4">
            {withSeconds.map((item, idx) => {
              const prev = idx > 0 ? withSeconds[idx - 1] : null;
              const barEnd = ((item.seconds - chartMin) / chartRange) * 100;
              const isPB = item.seconds === pbSeconds;
              const improved = prev && item.seconds < prev.seconds;
              const slower = prev && item.seconds > prev.seconds;

              const barColor = isPB
                ? "bg-gradient-to-r from-green-400 to-green-500"
                : improved
                ? "bg-gradient-to-r from-blue-300 to-blue-500"
                : slower
                ? "bg-gradient-to-r from-amber-300 to-amber-400"
                : "bg-gradient-to-r from-gray-300 to-gray-400";

              return (
                <div key={`${item.event_id}-${item.result_year}`} className="flex items-center gap-2">
                  {/* 年ラベル */}
                  <span className="text-xs text-gray-500 w-10 flex-shrink-0 text-right tabular-nums">
                    {item.result_year}
                  </span>

                  {/* バー */}
                  <div className="flex-1 relative h-6">
                    <div
                      className={`absolute left-0 top-0.5 h-5 rounded-r-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.max(barEnd, 2)}%` }}
                    >
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white tabular-nums whitespace-nowrap">
                        {item.finish_time}
                      </span>
                    </div>
                  </div>

                  {/* 改善インジケーター */}
                  <span className="w-4 flex-shrink-0 text-center text-xs">
                    {improved && <span className="text-green-500">↑</span>}
                    {slower && <span className="text-red-400">↓</span>}
                    {!improved && !slower && idx > 0 && <span className="text-gray-300">→</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-green-400 inline-block" /> 自己ベスト
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-blue-400 inline-block" /> タイム改善
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> タイム低下
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-1 h-3 bg-green-400 inline-block" /> PBライン
          </span>
        </div>
      </div>

      {/* 詳細リスト */}
      <div className="space-y-2">
        {growth.map((item, idx) => (
          <GrowthListItem key={`${item.event_id}-${item.result_year}`} item={item} growth={growth} idx={idx} />
        ))}
      </div>
    </div>
  );
}

function GrowthListItem({ item, growth, idx = 0 }) {
  const prev = idx > 0 ? growth[idx - 1] : null;
  let diff = null;
  if (prev?.finish_time && item.finish_time) {
    diff = item.finish_time < prev.finish_time ? "improved" : item.finish_time > prev.finish_time ? "slower" : "same";
  }

  // タイム差分を計算
  let timeDiffLabel = null;
  if (prev?.finish_time && item.finish_time && diff !== "same") {
    const prevSec = timeToSeconds(prev.finish_time);
    const curSec = timeToSeconds(item.finish_time);
    if (prevSec > 0 && curSec > 0) {
      const diffSec = Math.abs(curSec - prevSec);
      const mm = Math.floor(diffSec / 60);
      const ss = diffSec % 60;
      timeDiffLabel = mm > 0 ? `${mm}分${ss}秒` : `${ss}秒`;
    }
  }

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 text-center flex-shrink-0"><p className="text-sm font-bold text-gray-700">{item.result_year}</p></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{item.event_title}</p>
        {item.event_date && <p className="text-xs text-gray-400">{item.event_date}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold tabular-nums text-gray-900">{item.finish_time}</p>
        {item.overall_rank && <p className="text-xs text-gray-400">{item.overall_rank}位</p>}
      </div>
      <div className="w-16 flex-shrink-0 text-center">
        {diff === "improved" && (
          <div>
            <span className="text-green-500 text-sm">↑</span>
            {timeDiffLabel && <p className="text-[9px] text-green-500">-{timeDiffLabel}</p>}
          </div>
        )}
        {diff === "slower" && (
          <div>
            <span className="text-red-400 text-sm">↓</span>
            {timeDiffLabel && <p className="text-[9px] text-red-400">+{timeDiffLabel}</p>}
          </div>
        )}
        {diff === "same" && <span className="text-gray-300 text-sm">→</span>}
      </div>
    </div>
  );
}

/** HH:MM:SS or H:MM:SS → seconds */
function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
