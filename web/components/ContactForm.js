"use client";
import { useState } from "react";

/**
 * Phase228: 問い合わせフォーム（公開側）
 * 送信時にDB保存 → 管理画面で一元管理
 */

const INQUIRY_TYPES = [
  { value: "general", label: "一般的なお問い合わせ" },
  { value: "listing_request", label: "大会の掲載依頼" },
  { value: "correction", label: "掲載情報の修正依頼" },
  { value: "deletion", label: "掲載情報の削除依頼" },
  { value: "bug_report", label: "不具合の報告" },
  { value: "organizer_apply", label: "主催者としての登録申請" },
];

export default function ContactForm() {
  const [form, setForm] = useState({
    inquiry_type: "general",
    subject: "",
    body: "",
    name: "",
    email: "",
    target_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source_page: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: "success", message: "お問い合わせを受け付けました。2〜3営業日以内にご返信いたします。" });
        setForm({ inquiry_type: "general", subject: "", body: "", name: "", email: "", target_url: "" });
      } else {
        setResult({ type: "error", message: data.error || "送信に失敗しました" });
      }
    } catch {
      setResult({ type: "error", message: "通信エラーが発生しました。時間をおいて再度お試しください。" });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.type === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <div className="text-3xl mb-3">✅</div>
        <p className="text-green-800 font-bold text-lg mb-1">送信完了</p>
        <p className="text-green-700 text-sm">{result.message}</p>
        <button
          onClick={() => setResult(null)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-bold"
        >
          別の問い合わせを送る
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      {result?.type === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm font-bold">
          {result.message}
        </div>
      )}

      {/* 種別 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">お問い合わせ種別</label>
        <select
          value={form.inquiry_type}
          onChange={(e) => updateField("inquiry_type", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* 氏名 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          お名前 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          placeholder="山田 太郎"
        />
      </div>

      {/* メール */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          メールアドレス <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          placeholder="example@email.com"
        />
      </div>

      {/* 件名 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          件名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={form.subject}
          onChange={(e) => updateField("subject", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          placeholder="お問い合わせの件名"
        />
      </div>

      {/* 対象URL（任意） */}
      {(form.inquiry_type === "correction" || form.inquiry_type === "deletion") && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">対象ページURL（任意）</label>
          <input
            type="url"
            value={form.target_url}
            onChange={(e) => updateField("target_url", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            placeholder="https://..."
          />
        </div>
      )}

      {/* 本文 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          お問い合わせ内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={6}
          value={form.body}
          onChange={(e) => updateField("body", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none"
          placeholder="お問い合わせ内容をできるだけ詳しくご記入ください"
        />
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-base"
      >
        {submitting ? "送信中…" : "送信する"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        送信いただいた内容は、
        <a href="/privacy" className="text-blue-500 hover:underline">プライバシーポリシー</a>
        に基づき取り扱います。
      </p>
    </form>
  );
}
