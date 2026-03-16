"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";

const SETTING_GROUPS = [
  {
    label: "お気に入り大会の締切通知",
    description: "お気に入り登録した大会の締切が近づくと通知します",
    items: [
      { key: "enable_favorite_deadline_7d", label: "7日前" },
      { key: "enable_favorite_deadline_3d", label: "3日前" },
      { key: "enable_favorite_deadline_today", label: "当日" },
    ],
  },
  {
    label: "一般締切通知",
    description: "全大会の締切日を通知します",
    items: [
      { key: "enable_deadline_7d", label: "7日前" },
      { key: "enable_deadline_3d", label: "3日前" },
      { key: "enable_deadline_today", label: "当日" },
    ],
  },
  {
    label: "保存検索一致通知",
    description: "保存した検索条件に一致する大会が見つかると通知します",
    items: [
      { key: "enable_saved_search_match", label: "一致通知" },
    ],
  },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/notification-settings");
      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(key) {
    setSettings((prev) => ({ ...prev, [key]: prev[key] ? 0 : 1 }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const body = {};
      for (const group of SETTING_GROUPS) {
        for (const item of group.items) {
          body[item.key] = !!settings[item.key];
        }
      }
      const res = await fetch("/api/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setMsg("保存しました");
      } else {
        setMsg("保存に失敗しました");
      }
    } catch {
      setMsg("保存に失敗しました");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-40 bg-gray-200 rounded" />
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">通知設定</h1>
        <Link href="/notifications" className="text-xs text-gray-500 hover:text-blue-600">
          ← 通知一覧
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">受け取る通知の種類を選択できます</p>

      <div className="space-y-6">
        {SETTING_GROUPS.map((group) => (
          <div key={group.label} className="card p-5">
            <h2 className="font-bold text-gray-900 mb-1">{group.label}</h2>
            <p className="text-xs text-gray-500 mb-4">{group.description}</p>
            <div className="space-y-3">
              {group.items.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(item.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      settings[item.key] ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings[item.key] ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {saving ? "保存中..." : "設定を保存"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.includes("失敗") ? "text-red-500" : "text-green-600"}`}>
            {msg}
          </span>
        )}
      </div>
      </div>
    </AuthGuard>
  );
}
