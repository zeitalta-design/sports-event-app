"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * Phase228: 巡回パトロール / 品質確認ページ
 * - 問題種別ごとの件数カード
 * - 問題一覧テーブル
 * - 優先度ラベル（危険 / 要確認 / 軽微）
 * - 該当大会への遷移
 */

const LEVEL_CONFIG = {
  danger: { label: "危険", dot: "bg-red-500", badge: "bg-red-100 text-red-800 border-red-200", card: "border-red-300 bg-red-50" },
  warning: { label: "要確認", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", card: "border-yellow-300 bg-yellow-50" },
  info: { label: "軽微", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-800 border-blue-200", card: "border-gray-200 bg-white" },
};

export default function PatrolPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => {
    fetch("/api/admin/ops/patrol")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadIssue = useCallback(async (issueKey) => {
    setSelectedIssue(issueKey);
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/admin/ops/patrol?issue=${issueKey}`);
      const json = await res.json();
      setEvents(json.events || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <div className="p-8 text-center text-gray-500">データを取得できませんでした</div>;

  const { issueCards, totalActive } = data;
  const totalIssues = issueCards.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">巡回パトロール</h1>
        <p className="text-sm text-gray-500 mt-1">
          掲載大会 {totalActive} 件 · 要確認 {totalIssues} 件
        </p>
      </div>

      {/* 問題種別カード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {issueCards.map((card) => {
          const lc = LEVEL_CONFIG[card.level];
          const active = selectedIssue === card.key;
          return (
            <button
              key={card.key}
              onClick={() => card.count > 0 && loadIssue(card.key)}
              disabled={card.count === 0}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50"
                  : card.count > 0
                    ? `${lc.card} hover:shadow-md cursor-pointer`
                    : "border-gray-200 bg-gray-50 opacity-60 cursor-default"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${card.count > 0 ? lc.dot : "bg-green-500"}`} />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${card.count > 0 ? lc.badge : "bg-green-100 text-green-800 border-green-200"}`}>
                  {card.count > 0 ? lc.label : "問題なし"}
                </span>
              </div>
              <p className={`text-2xl font-extrabold ${card.count > 0 ? "text-gray-900" : "text-green-700"}`}>
                {card.count}
                <span className="text-sm font-bold text-gray-500 ml-1">件</span>
              </p>
              <p className="text-xs text-gray-600 mt-1 font-medium">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* 問題一覧テーブル */}
      {selectedIssue && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900">
                {issueCards.find((c) => c.key === selectedIssue)?.label || selectedIssue}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {events.length} 件の大会が該当（最大100件表示）
              </p>
            </div>
            <button
              onClick={() => { setSelectedIssue(null); setEvents([]); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold"
            >
              閉じる
            </button>
          </div>

          {/* アクションフィードバック */}
          {actionFeedback && (
            <div className={`px-5 py-3 text-sm font-bold ${
              actionFeedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}>
              {actionFeedback.message}
            </div>
          )}

          {eventsLoading ? (
            <div className="p-8 text-center text-gray-400">読み込み中…</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-400">該当する大会はありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">ID</th>
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">大会名</th>
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">種目</th>
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">開催日</th>
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">都道府県</th>
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">最終更新</th>
                  <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{ev.id}</td>
                    <td className="px-4 py-2.5 font-bold text-gray-800 max-w-[250px] truncate">{ev.title}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{ev.sport_type || "—"}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {ev.event_date ? (
                        <span className={isDatePast(ev.event_date) ? "text-red-600 font-bold" : "text-gray-700"}>
                          {ev.event_date}
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{ev.prefecture || <span className="text-red-500 font-bold">未設定</span>}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(ev.updated_at)}</td>
                    <td className="px-4 py-2.5">
                      <EventActions
                        event={ev}
                        onAction={async (eventId, action) => {
                          try {
                            const res = await fetch("/api/admin/ops/patrol", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ event_id: eventId, action }),
                            });
                            const result = await res.json();
                            if (res.ok) {
                              setActionFeedback({ type: "success", message: result.message });
                              if (action === "toggle_active" || action === "dismiss") {
                                setEvents((prev) => prev.filter((e) => e.id !== eventId));
                              }
                            } else {
                              setActionFeedback({ type: "error", message: result.error });
                            }
                            setTimeout(() => setActionFeedback(null), 3000);
                          } catch {
                            setActionFeedback({ type: "error", message: "操作に失敗しました" });
                            setTimeout(() => setActionFeedback(null), 3000);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 選択前のガイド */}
      {!selectedIssue && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-gray-600 font-bold">問題カードをクリックすると該当大会が表示されます</p>
          <p className="text-sm text-gray-400 mt-1">件数が0の項目は問題なしです</p>
        </div>
      )}
    </div>
  );
}

function EventActions({ event, onAction }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <Link
          href={`/admin/marathon-details/${event.id}`}
          className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition-colors"
          title="編集画面へ"
        >
          編集
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="text-[11px] px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold border border-gray-200 transition-colors"
        >
          ▼
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-44 py-1">
          <Link
            href={`/${event.sport_type || "marathon"}/${event.id}`}
            target="_blank"
            className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium"
          >
            🔗 公開ページを確認
          </Link>
          <button
            onClick={() => { onAction(event.id, "toggle_active"); setOpen(false); }}
            className="block w-full text-left px-3 py-2 text-xs text-orange-700 hover:bg-orange-50 font-medium"
          >
            🔒 非公開に切替
          </button>
          <button
            onClick={() => { onAction(event.id, "flag_review"); setOpen(false); }}
            className="block w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 font-medium"
          >
            🔖 後で確認
          </button>
          <button
            onClick={() => { onAction(event.id, "dismiss"); setOpen(false); }}
            className="block w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50 font-medium"
          >
            ✅ 解消済み
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array(8).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl border h-28" />)}
      </div>
    </div>
  );
}

function isDatePast(dateStr) {
  return new Date(dateStr) < new Date();
}

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}
