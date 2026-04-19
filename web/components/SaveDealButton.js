"use client";

/**
 * SaveDealButton — 有望案件の保存 / 保存解除トグル（Phase J-14）
 *
 * - 保存状態は props.initialSaved で親から受け取り、内部で optimistic update
 * - 401（未ログイン）は静かに無視して disabled にする
 * - 402 save_limit_reached (Phase M-5) はアップグレード誘導 modal を出す
 * - `compact` でアイコンのみの小さいボタン（TopDeals / 一覧バッジ用）
 */
import { useState, useCallback } from "react";
import Link from "next/link";

export default function SaveDealButton({
  dealSlug,
  initialSaved = false,
  compact = false,
  onChange,
}) {
  const [saved, setSaved] = useState(!!initialSaved);
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(null);

  const toggle = useCallback(async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!dealSlug || busy || disabled) return;
    const next = !saved;
    setSaved(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(next ? "/api/deals/save" : "/api/deals/unsave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_slug: dealSlug }),
      });
      if (res.status === 401) {
        // 未ログイン: 状態を戻して以降は disabled
        setSaved(!next);
        setDisabled(true);
        return;
      }
      if (res.status === 402) {
        // Phase M-5: 非 Pro の保存上限オーバー → rollback + upgrade 誘導
        setSaved(!next);
        try {
          const d = await res.json();
          setUpgradePrompt({
            message: d?.message || "無料プランでは 3 件までしか保存できません",
            limit: d?.limit || 3,
            upgradeUrl: d?.upgradeUrl || "/pricing",
          });
        } catch {
          setUpgradePrompt({ message: "保存上限に達しました", limit: 3, upgradeUrl: "/pricing" });
        }
        return;
      }
      if (!res.ok) {
        setSaved(!next); // rollback
        return;
      }
      onChange?.(next);
    } catch {
      setSaved(!next); // rollback
    } finally {
      setBusy(false);
    }
  }, [dealSlug, saved, busy, disabled, onChange]);

  const button = compact ? (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || disabled}
      className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 ${
        saved
          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
      }`}
      title={saved ? "保存済み（クリックで解除）" : "案件を保存"}
      aria-pressed={saved}
    >
      {saved ? "★ 保存済み" : "☆ 保存"}
    </button>
  ) : (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        saved
          ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
      aria-pressed={saved}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      <span>{saved ? "保存済み" : "保存"}</span>
    </button>
  );

  return (
    <>
      {button}
      {upgradePrompt && (
        <UpgradeModal
          message={upgradePrompt.message}
          limit={upgradePrompt.limit}
          upgradeUrl={upgradePrompt.upgradeUrl}
          onClose={() => setUpgradePrompt(null)}
        />
      )}
    </>
  );
}

// Phase M-5: 非 Pro ユーザーの保存上限到達時に出す modal
function UpgradeModal({ message, limit, upgradeUrl, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900 mb-2">
          保存は {limit} 件までです
        </h3>
        <p className="text-sm text-gray-600 mb-5">
          {message}。続けて保存するには 入札ナビ Pro をご利用ください。
        </p>
        <div className="flex flex-col sm:flex-row-reverse gap-2">
          <Link
            href={upgradeUrl}
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg text-center hover:bg-blue-700"
          >
            アップグレード →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
