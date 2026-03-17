"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

/**
 * Phase230: パスワードリセット申請画面
 * - メールアドレス入力 → リセットメール送信
 * - 存在しないメールでも同じ成功メッセージ（セキュリティ）
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "エラーが発生しました");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("通信エラーが発生しました。ネットワーク接続を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image
              src={siteConfig.logoImage}
              alt={siteConfig.siteName}
              width={140}
              height={42}
              className="h-10 w-auto mx-auto"
              priority
            />
          </Link>
        </div>

        <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">
          パスワードをリセット
        </h1>
        <p className="text-xs text-gray-500 text-center mb-6">
          登録済みメールアドレスにリセット用リンクを送信します
        </p>

        {submitted ? (
          /* 送信完了 */
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                メールを送信しました
              </h2>
              <p className="text-sm text-gray-600 mb-1">
                ご登録のメールアドレス宛にパスワードリセットの案内を送信しました。
              </p>
              <p className="text-xs text-gray-500 mb-6">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
                <br />
                リンクの有効期限は15分間です。
              </p>
              <Link
                href="/login"
                className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                ログインページへ戻る
              </Link>
            </div>
          </div>
        ) : (
          /* 入力フォーム */
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="登録済みのメールアドレス"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "送信中..." : "リセットリンクを送信"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
