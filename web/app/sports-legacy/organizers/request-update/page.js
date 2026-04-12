"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Phase130: 情報修正依頼フォーム
 *
 * /organizers/request-update — 大会運営者からの情報修正リクエスト
 * 認証不要。?event_id=X&event_title=Y でプリフィル対応。
 */

const ROLE_OPTIONS = [
  { value: "", label: "選択してください" },
  { value: "organizer", label: "主催者" },
  { value: "operator", label: "運営事務局" },
  { value: "staff", label: "スタッフ・関係者" },
  { value: "other", label: "その他" },
];

const CORRECTION_ITEMS = [
  { key: "event_date", label: "開催日" },
  { key: "venue", label: "会場・場所" },
  { key: "races", label: "種目・距離" },
  { key: "fee", label: "参加費" },
  { key: "deadline", label: "申込締切日" },
  { key: "entry_status", label: "受付状態" },
  { key: "organizer_info", label: "主催者情報" },
  { key: "other", label: "その他" },
];

export default function RequestUpdatePage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
      <RequestUpdateForm />
    </Suspense>
  );
}

function RequestUpdateForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    event_name: "",
    event_id: "",
    official_url: "",
    requester_role: "",
    correction_items: [],
    correction_content: "",
    contact_email: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const eventId = searchParams.get("event_id");
    const eventTitle = searchParams.get("event_title");
    if (eventId || eventTitle) {
      setForm((prev) => ({
        ...prev,
        event_id: eventId || "",
        event_name: eventTitle || "",
      }));
    }
  }, [searchParams]);

  function handleItemToggle(key) {
    setForm((prev) => ({
      ...prev,
      correction_items: prev.correction_items.includes(key)
        ? prev.correction_items.filter((k) => k !== key)
        : [...prev.correction_items, key],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.event_name.trim()) {
      setError("大会名を入力してください。");
      return;
    }
    if (!form.requester_role) {
      setError("ご担当の立場を選択してください。");
      return;
    }
    if (!form.correction_content.trim()) {
      setError("修正内容を入力してください。");
      return;
    }
    if (!form.contact_email.trim() || !form.contact_email.includes("@")) {
      setError("有効なメールアドレスを入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/organizers/request-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          correction_items: form.correction_items.join(","),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "送信に失敗しました");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card p-10 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
            ✓
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">
            リクエストを受け付けました
          </h1>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            ご送信ありがとうございます。内容を確認の上、通常2〜3営業日以内にご対応いたします。
            確認結果については、ご記入いただいたメールアドレスにご連絡いたします。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/organizers"
              className="px-5 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              運営者ページに戻る
            </Link>
            <Link
              href="/"
              className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              トップページへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          大会情報の修正・更新リクエスト
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          掲載情報の修正や最新情報への更新をご希望の場合は、以下のフォームからお知らせください。
          ランナーに正確な情報を届けるためのご協力に感謝いたします。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 大会名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            大会名 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.event_name}
            onChange={(e) => setForm({ ...form, event_name: e.target.value })}
            placeholder="例: 東京マラソン2026"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {form.event_id && (
            <p className="text-xs text-gray-400 mt-1">大会ID: {form.event_id}</p>
          )}
        </div>

        {/* 公式URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            公式サイトURL
          </label>
          <input
            type="url"
            value={form.official_url}
            onChange={(e) => setForm({ ...form, official_url: e.target.value })}
            placeholder="https://"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 立場 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ご担当の立場 <span className="text-red-400">*</span>
          </label>
          <select
            value={form.requester_role}
            onChange={(e) => setForm({ ...form, requester_role: e.target.value })}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 修正項目 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            修正したい項目（複数選択可）
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CORRECTION_ITEMS.map((item) => (
              <label
                key={item.key}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border cursor-pointer transition-colors ${
                  form.correction_items.includes(item.key)
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.correction_items.includes(item.key)}
                  onChange={() => handleItemToggle(item.key)}
                  className="sr-only"
                />
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                  form.correction_items.includes(item.key)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300"
                }`}>
                  {form.correction_items.includes(item.key) && "✓"}
                </span>
                {item.label}
              </label>
            ))}
          </div>
        </div>

        {/* 修正内容 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            修正内容 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.correction_content}
            onChange={(e) => setForm({ ...form, correction_content: e.target.value })}
            rows={5}
            placeholder={"修正したい内容を具体的にお書きください。\n例: 「開催日が2026年4月5日→4月12日に変更」のように、現在の掲載内容と正しい内容の両方をご記入いただくとスムーズです。\n\n写真に関するご要望（掲載写真の追加・差し替え等）もこちらからお送りください。"}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* メールアドレス */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ご連絡先メールアドレス <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="example@example.com"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            確認結果のご連絡に使用いたします。
          </p>
        </div>

        {/* 備考 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            備考
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="その他お伝えしたいことがあればご記入ください。"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* エラー */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 送信 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "送信中..." : "リクエストを送信する"}
          </button>
        </div>
      </form>

      {/* フッター */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <Link href="/organizers" className="text-sm text-blue-600 hover:text-blue-800">
          ← 運営者ページに戻る
        </Link>
      </div>
    </div>
  );
}
