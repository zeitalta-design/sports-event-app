"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "taikai_notification_settings";

const DEFAULT_SETTINGS = {
  deadlineReminder: true,
  deadlineReminderDays: 3,
  eventReminder: true,
  eventReminderDays: 7,
};

function getSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * 通知設定パネル — マイカレンダー内に表示
 */
export default function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  function handleChange(key, value) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* トグルヘッダー */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <span className="text-sm font-bold text-gray-700">通知設定</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* 設定内容 */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            ブラウザ通知でリマインドします（準備中）
          </p>

          {/* 締切リマインダー */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">エントリー締切リマインダー</p>
              <p className="text-xs text-gray-500">締切前にお知らせ</p>
            </div>
            <ToggleSwitch
              checked={settings.deadlineReminder}
              onChange={(v) => handleChange("deadlineReminder", v)}
            />
          </div>

          {settings.deadlineReminder && (
            <div className="ml-4 flex items-center gap-2">
              <span className="text-xs text-gray-500">締切の</span>
              <select
                value={settings.deadlineReminderDays}
                onChange={(e) => handleChange("deadlineReminderDays", Number(e.target.value))}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value={1}>1日前</option>
                <option value={3}>3日前</option>
                <option value={5}>5日前</option>
                <option value={7}>7日前</option>
              </select>
              <span className="text-xs text-gray-500">に通知</span>
            </div>
          )}

          {/* 大会リマインダー */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">大会日リマインダー</p>
              <p className="text-xs text-gray-500">大会前にお知らせ</p>
            </div>
            <ToggleSwitch
              checked={settings.eventReminder}
              onChange={(v) => handleChange("eventReminder", v)}
            />
          </div>

          {settings.eventReminder && (
            <div className="ml-4 flex items-center gap-2">
              <span className="text-xs text-gray-500">大会の</span>
              <select
                value={settings.eventReminderDays}
                onChange={(e) => handleChange("eventReminderDays", Number(e.target.value))}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value={1}>1日前</option>
                <option value={3}>3日前</option>
                <option value={7}>7日前</option>
                <option value={14}>14日前</option>
              </select>
              <span className="text-xs text-gray-500">に通知</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
