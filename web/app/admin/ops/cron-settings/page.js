"use client";

import { useState, useEffect } from "react";

/**
 * 自動更新設定ページ
 * 各カテゴリの自動データ取得スケジュールを管理
 */

const TARGET_LABELS = {
  mlit: "国交省（MLIT）データ取得",
  prefecture: "都道府県データ取得",
  sanpai_sync: "産廃処分データ同期",
  nyusatsu_sync: "入札情報データ同期",
  shitei_sync: "指定管理データ同期",
  hojokin_sync: "補助金情報データ同期",
  kyoninka_sync: "許認可情報データ同期",
};

export default function CronSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch("/api/admin/cron-settings")
      .then((r) => r.json())
      .then((data) => setSettings(data.settings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveSetting(setting) {
    setSaving(setting.domain_id);
    setToast(null);
    try {
      const res = await fetch("/api/admin/cron-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });
      if (res.ok) {
        setToast({ type: "success", message: `${setting.label}の設定を保存しました` });
      } else {
        const data = await res.json();
        setToast({ type: "error", message: data.error || "保存に失敗しました" });
      }
    } catch {
      setToast({ type: "error", message: "通信エラー" });
    } finally {
      setSaving(null);
    }
  }

  function updateSetting(domainId, key, value) {
    setSettings((prev) =>
      prev.map((s) => (s.domain_id === domainId ? { ...s, [key]: value } : s))
    );
  }

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto"><div className="animate-pulse h-64 bg-gray-100 rounded-xl" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">自動更新設定</h1>
        <p className="text-sm text-gray-500">各カテゴリの自動データ取得スケジュールを管理</p>
      </div>

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-bold mb-1">自動更新について</p>
        <p className="text-xs text-blue-600">
          有効にしたカテゴリは、指定時刻にデータ取得が自動実行されます。
          実行結果はこの画面および各カテゴリの管理画面で確認できます。
        </p>
      </div>

      {/* トースト */}
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
          toast.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* カテゴリ別設定カード */}
      <div className="space-y-4">
        {settings.map((s) => (
          <div key={s.domain_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* ヘッダー */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-gray-900">{s.label}</h3>
                {s.enabled ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">有効</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">無効</span>
                )}
              </div>
              {/* トグルスイッチ */}
              <button
                onClick={() => updateSetting(s.domain_id, "enabled", !s.enabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${s.enabled ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${s.enabled ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {/* 設定内容 */}
            <div className={`px-5 py-4 space-y-4 ${s.enabled ? "" : "opacity-50 pointer-events-none"}`}>
              {/* 実行時間 */}
              <div className="flex items-center gap-4">
                <label className="text-xs font-medium text-gray-700 w-24 shrink-0">実行時刻</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">毎日</span>
                  <select
                    value={s.schedule_hour}
                    onChange={(e) => updateSetting(s.domain_id, "schedule_hour", parseInt(e.target.value))}
                    className="border rounded-lg px-3 py-1.5 text-sm w-20"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">（JST）</span>
                </div>
              </div>

              {/* 更新対象 */}
              <div className="flex items-start gap-4">
                <label className="text-xs font-medium text-gray-700 w-24 shrink-0 pt-1">更新対象</label>
                <div className="space-y-2">
                  {(s.availableTargets || s.targets || []).map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(s.targets || []).includes(t)}
                        onChange={(e) => {
                          const newTargets = e.target.checked
                            ? [...(s.targets || []), t]
                            : (s.targets || []).filter((x) => x !== t);
                          updateSetting(s.domain_id, "targets", newTargets);
                        }}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      {TARGET_LABELS[t] || t}
                    </label>
                  ))}
                </div>
              </div>

              {/* 通知設定 */}
              <div className="flex items-center gap-4">
                <label className="text-xs font-medium text-gray-700 w-24 shrink-0">完了通知</label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.notify_on_complete}
                    onChange={(e) => updateSetting(s.domain_id, "notify_on_complete", e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  更新完了時に管理者に通知する
                </label>
              </div>

              {/* 前回実行 */}
              <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                <span className="text-xs font-medium text-gray-700 w-24 shrink-0">前回実行</span>
                {s.last_run_at ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700 font-medium">{s.last_run_at?.replace("T", " ").slice(0, 16)}</span>
                    <span className="text-gray-300">—</span>
                    {s.last_run_items > 0 && (
                      <span className="text-green-600 font-bold">{s.last_run_items}件更新</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      s.last_run_result === "success" ? "bg-green-100 text-green-700" :
                      s.last_run_result?.startsWith("error") ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {s.last_run_result === "success" ? "成功" : s.last_run_result?.startsWith("error") ? "エラー" : s.last_run_result || "—"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">未実行</span>
                )}
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => saveSetting(s)}
                disabled={saving === s.domain_id}
                className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                  saving === s.domain_id
                    ? "bg-gray-200 text-gray-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {saving === s.domain_id ? "保存中..." : "設定を保存"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Vercel Cron 情報 */}
      <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-2">Vercel Cron 現在の設定</h3>
        <p className="text-xs text-gray-500 mb-3">
          vercel.json に定義されている自動実行スケジュール（UTC）
        </p>
        <div className="space-y-1.5 text-xs text-gray-600 font-mono">
          <div className="flex gap-4"><span className="text-gray-400 w-36">MLIT取得</span><span>毎週月曜 18:00 UTC（月曜 3:00 JST）</span></div>
          <div className="flex gap-4"><span className="text-gray-400 w-36">都道府県取得</span><span>毎週水曜 19:00 UTC（木曜 4:00 JST）</span></div>
          <div className="flex gap-4"><span className="text-gray-400 w-36">ウォッチリスト通知</span><span>毎週月曜 19:00 UTC（月曜 4:00 JST）</span></div>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          ※ Vercel Cronスケジュールの変更はvercel.jsonの編集が必要です。上記の設定画面は管理DB上の設定であり、
          実際の自動実行はvercel.jsonのCron定義に従います。
        </p>
      </div>
    </div>
  );
}
