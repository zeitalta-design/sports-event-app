"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase139: 口コミ投稿ページ（認証必須）
 *
 * /reviews/new?event_id=X&event_title=Y&sport_type=Z
 * 未ログイン時はログイン誘導UIを表示。
 */

const PARTICIPANT_TYPES = [
  { value: "beginner", label: "初参加・初心者" },
  { value: "intermediate", label: "何度か参加経験あり" },
  { value: "experienced", label: "ベテラン・上級者" },
  { value: "spectator", label: "応援・観戦者" },
];

const VISIT_TYPES = [
  { value: "first", label: "初めて" },
  { value: "repeat", label: "リピート参加" },
];

const RATING_ITEMS = [
  { key: "rating_overall", label: "総合評価", required: true },
  { key: "rating_course", label: "コース満足度" },
  { key: "rating_access", label: "アクセスの良さ" },
  { key: "rating_venue", label: "会場・運営" },
  { key: "rating_beginner", label: "初心者へのおすすめ度" },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - i);

export default function ReviewNewPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-12 text-center text-sm text-gray-400">読み込み中...</div>}>
      <ReviewNewForm />
    </Suspense>
  );
}

function ReviewNewForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoggedIn, isLoading } = useAuthStatus();

  const [form, setForm] = useState({
    event_id: "",
    event_title: "",
    sport_type: "",
    rating_overall: 0,
    rating_course: 0,
    rating_access: 0,
    rating_venue: 0,
    rating_beginner: 0,
    review_title: "",
    review_body: "",
    recommended_for: "",
    nickname: "",
    participant_type: "",
    visit_type: "",
    year_joined: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      event_id: searchParams.get("event_id") || "",
      event_title: searchParams.get("event_title") || "",
      sport_type: searchParams.get("sport_type") || "",
    }));
  }, [searchParams]);

  // ログイン済みならニックネームにユーザー名をセット
  useEffect(() => {
    if (user?.name && !form.nickname) {
      setForm((prev) => ({ ...prev, nickname: user.name }));
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.event_id) {
      setError("大会情報が不足しています。大会詳細ページからお越しください。");
      return;
    }
    if (form.rating_overall < 1) {
      setError("総合評価を選択してください。");
      return;
    }
    if (!form.review_body.trim() || form.review_body.trim().length < 10) {
      setError("感想を10文字以上で入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: form.event_id,
          sport_type: form.sport_type,
          rating_overall: form.rating_overall,
          rating_course: form.rating_course || null,
          rating_access: form.rating_access || null,
          rating_venue: form.rating_venue || null,
          rating_beginner: form.rating_beginner || null,
          review_title: form.review_title,
          review_body: form.review_body,
          recommended_for: form.recommended_for,
          nickname: form.nickname,
          participant_type: form.participant_type,
          visit_type: form.visit_type,
          year_joined: form.year_joined ? parseInt(form.year_joined) : null,
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

  // ローディング中
  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    );
  }

  // 未ログイン → ログイン誘導
  if (!isLoggedIn) {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "/reviews/new";
    const loginUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
    const signupUrl = `/signup?redirect=${encodeURIComponent(currentUrl)}`;

    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            ✍️
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">
            口コミを書くにはログインが必要です
          </h1>
          {form.event_title && (
            <p className="text-sm text-blue-600 font-medium mb-2">{form.event_title}</p>
          )}
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            あなたの参加体験が、次のランナーの大会選びに役立ちます。ログインして口コミを投稿しましょう。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={loginUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              data-track="review_login_prompt"
            >
              ログインして口コミを書く
            </Link>
            <Link
              href={signupUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              data-track="review_signup_prompt"
            >
              会員登録して口コミを書く
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            会員登録は無料です。口コミ投稿のほか、大会の保存や通知機能も利用できます。
          </p>

          {form.event_id && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href={`/marathon/${form.event_id}`}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                ← 大会ページに戻る
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 投稿完了
  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            ✓
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">
            口コミを投稿しました
          </h1>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            貴重な体験談をありがとうございます。あなたの声が、次のランナーの大会選びに役立ちます。
          </p>
          {form.event_id && (
            <Link
              href={`/marathon/${form.event_id}`}
              className="inline-block px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              大会ページに戻る
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── 投稿フォーム（ログイン済み） ──
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">口コミを投稿する</h1>
        {form.event_title && (
          <p className="text-sm text-blue-600 font-medium">{form.event_title}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          あなたの体験が、次に参加するランナーの参考になります
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 総合評価（必須） */}
        {RATING_ITEMS.map((item) => (
          <div key={item.key}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {item.label}
              {item.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <StarRating
              value={form[item.key]}
              onChange={(val) => setForm({ ...form, [item.key]: val })}
            />
          </div>
        ))}

        {/* タイトル */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            タイトル
          </label>
          <input
            type="text"
            value={form.review_title}
            onChange={(e) => setForm({ ...form, review_title: e.target.value })}
            placeholder="例: 初マラソンに最適な大会でした"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
          />
        </div>

        {/* 感想 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            感想 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.review_body}
            onChange={(e) => setForm({ ...form, review_body: e.target.value })}
            rows={5}
            placeholder={"大会に参加してみての感想をお書きください。\nコースの雰囲気、沿道の応援、会場の様子、運営の良かった点など、\n次に参加する人の参考になることを教えてください。"}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            {form.review_body.length}文字（10文字以上）
          </p>
        </div>

        {/* どんな人に向いているか */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            この大会はどんな人に向いていますか？
          </label>
          <input
            type="text"
            value={form.recommended_for}
            onChange={(e) => setForm({ ...form, recommended_for: e.target.value })}
            placeholder="例: 初マラソンの方、記録を狙いたい方、景色を楽しみたい方"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={200}
          />
        </div>

        {/* 参加者属性 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              あなたの経験
            </label>
            <select
              value={form.participant_type}
              onChange={(e) => setForm({ ...form, participant_type: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {PARTICIPANT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              この大会は
            </label>
            <select
              value={form.visit_type}
              onChange={(e) => setForm({ ...form, visit_type: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {VISIT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 参加年 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参加した年
            </label>
            <select
              value={form.year_joined}
              onChange={(e) => setForm({ ...form, year_joined: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ニックネーム
            </label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="匿名ランナー"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={30}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "送信中..." : "口コミを投稿する"}
        </button>

        <p className="text-xs text-gray-400 text-center">
          投稿された口コミは公開されます。個人を特定できる情報の記載はお控えください。
        </p>
      </form>
    </div>
  );
}

// ── 星評価コンポーネント ──
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-110"
          aria-label={`${star}点`}
        >
          <span
            className={`text-2xl ${
              star <= (hover || value)
                ? "text-yellow-400"
                : "text-gray-200"
            }`}
          >
            ★
          </span>
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm text-gray-500 ml-2">{value}.0</span>
      )}
    </div>
  );
}
