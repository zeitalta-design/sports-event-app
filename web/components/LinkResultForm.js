"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Phase150: 結果紐付けフォーム
 *
 * ユーザーがゼッケン番号で自分の結果を紐付ける。
 * /my-results/link?event_id=X&event_title=Y
 */

export default function LinkResultPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-8 text-sm text-gray-400 text-center">読み込み中...</div>}>
      <LinkResultForm />
    </Suspense>
  );
}

function LinkResultForm() {
  const searchParams = useSearchParams();
  const prefillEventId = searchParams.get("event_id") || "";
  const prefillTitle = searchParams.get("event_title") || "";

  const [eventId, setEventId] = useState(prefillEventId);
  const [eventTitle] = useState(prefillTitle);
  const [bibNumber, setBibNumber] = useState("");
  const [year, setYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setSuccess(false);

    if (!eventId || !bibNumber) {
      setError("大会IDとゼッケン番号は必須です。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/my-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: Number(eventId),
          bib_number: bibNumber.trim(),
          year: year ? Number(year) : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError("ログインが必要です。先にログインしてください。");
        } else {
          setError(data.message || "紐付けに失敗しました。");
        }
        return;
      }

      setResult(data.result);
      setSuccess(true);
    } catch (err) {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (success && result) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="card p-6 text-center">
          <p className="text-3xl mb-3">🎉</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">結果を紐付けました</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left space-y-1">
            {result.category_name && (
              <p className="text-sm text-gray-600">カテゴリ: {result.category_name}</p>
            )}
            {result.overall_rank && (
              <p className="text-sm text-gray-600">総合順位: {result.overall_rank}位</p>
            )}
            {result.finish_time && (
              <p className="text-sm text-gray-600">タイム: {result.finish_time}</p>
            )}
            {result.net_time && (
              <p className="text-sm text-gray-600">ネットタイム: {result.net_time}</p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href="/my-results"
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              My Resultsを見る
            </Link>
            <button
              onClick={() => { setSuccess(false); setResult(null); setBibNumber(""); setYear(""); }}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              別の結果を追加
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/my-results" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← My Resultsに戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">結果を紐付ける</h1>
        <p className="text-sm text-gray-500 mt-1">
          ゼッケン番号を入力して、大会結果と自分のアカウントを紐付けます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {/* 大会ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            大会 <span className="text-red-400">*</span>
          </label>
          {eventTitle ? (
            <div className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              {eventTitle}
              <input type="hidden" value={eventId} />
            </div>
          ) : (
            <input
              type="number"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="大会IDを入力"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              required
            />
          )}
        </div>

        {/* ゼッケン番号 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ゼッケン番号 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={bibNumber}
            onChange={(e) => setBibNumber(e.target.value)}
            placeholder="例: 1234"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            大会当日に割り当てられたゼッケン番号を入力してください。
          </p>
        </div>

        {/* 年度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            参加年度
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="例: 2025"
            min="2000"
            max="2030"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            複数年度の結果がある場合は年度を指定してください。
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "照合中..." : "結果を紐付ける"}
        </button>
      </form>

      {/* プライバシー説明 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 leading-relaxed">
          紐付けた結果はあなたのアカウントにのみ紐付けられ、他のユーザーには公開されません。
          公開結果ページでは個人名は表示されず、ゼッケン番号のみが識別子として使用されます。
        </p>
      </div>
    </div>
  );
}
