"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Phase229: 管理者アカウント画面
 * - アカウント情報表示
 * - パスワード変更
 * - ログアウト導線
 * - 青基調・信頼感のある管理者UI
 */
export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // パスワード変更フォーム
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // ログアウト
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/account")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    setPwLoading(true);

    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirm }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setPwError(data.error || "パスワード変更に失敗しました");
        return;
      }

      setPwSuccess("パスワードを変更しました。次回ログインから新しいパスワードをお使いください。");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setShowPasswordForm(false);
    } catch {
      setPwError("通信エラーが発生しました");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-red-600">アカウント情報を取得できませんでした。</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">アカウント設定</h1>
        <p className="text-sm text-gray-500 mt-1">管理者アカウントの情報確認とセキュリティ設定</p>
      </div>

      {/* アカウント情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          アカウント情報
        </h2>

        <dl className="space-y-3">
          <div className="flex items-center gap-3">
            <dt className="text-sm font-medium text-gray-500 w-32 shrink-0">名前</dt>
            <dd className="text-sm text-gray-900 font-medium">{user.name || "（未設定）"}</dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="text-sm font-medium text-gray-500 w-32 shrink-0">メールアドレス</dt>
            <dd className="text-sm text-gray-900">{user.email}</dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="text-sm font-medium text-gray-500 w-32 shrink-0">ロール</dt>
            <dd>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {user.role}
              </span>
            </dd>
          </div>
          {user.lastLoginAt && (
            <div className="flex items-center gap-3">
              <dt className="text-sm font-medium text-gray-500 w-32 shrink-0">最終ログイン</dt>
              <dd className="text-sm text-gray-600">{user.lastLoginAt}</dd>
            </div>
          )}
          {user.passwordChangedAt && (
            <div className="flex items-center gap-3">
              <dt className="text-sm font-medium text-gray-500 w-32 shrink-0">パスワード変更日</dt>
              <dd className="text-sm text-gray-600">{user.passwordChangedAt}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* セキュリティ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          セキュリティ
        </h2>

        {/* 成功メッセージ */}
        {pwSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {pwSuccess}
          </div>
        )}

        {!showPasswordForm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 font-medium">パスワード</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {user.passwordChangedAt
                  ? `最終変更: ${user.passwordChangedAt}`
                  : "初期設定のパスワードを使用中"}
              </p>
            </div>
            <button
              onClick={() => {
                setShowPasswordForm(true);
                setPwError("");
                setPwSuccess("");
              }}
              className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              パスワード変更
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {pwError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                現在のパスワード
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="8文字以上"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500 mt-1">8文字以上で設定してください</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={pwLoading}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {pwLoading ? "変更中..." : "パスワードを変更"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                  setPwError("");
                }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}
      </section>

      {/* MFA（将来拡張プレースホルダー） */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6 opacity-60">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 18.75h6" />
          </svg>
          二要素認証（MFA）
          <span className="text-xs font-normal text-gray-400 ml-1">準備中</span>
        </h2>
        <p className="text-sm text-gray-500">
          今後のアップデートで、ワンタイムパスワード（OTP）による二要素認証に対応予定です。
        </p>
      </section>

      {/* ログアウト */}
      <section className="bg-white rounded-xl border border-red-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">セッション</h2>
        <p className="text-sm text-gray-500 mb-4">
          ログアウトすると、現在のセッションが終了します。再度ログインが必要です。
        </p>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="px-5 py-2.5 bg-red-50 text-red-700 text-sm font-bold rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-colors"
        >
          {logoutLoading ? "ログアウト中..." : "ログアウト"}
        </button>
      </section>
    </div>
  );
}
