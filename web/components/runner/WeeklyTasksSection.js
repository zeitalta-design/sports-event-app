"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import { hasRunnerProfile } from "@/lib/runner-profile";

/**
 * Phase103: 今週のタスクリスト
 *
 * クライアントサイドで生成。
 * - 締切3日以内の保存大会数
 * - 比較中の大会 → 「決めましょう」
 * - プロフィール未設定 → 「設定しましょう」
 */

export default function WeeklyTasksSection() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    buildTasks();

    function onChange() {
      buildTasks();
    }
    window.addEventListener("saved-change", onChange);
    window.addEventListener("compare-change", onChange);
    window.addEventListener("runner-profile-change", onChange);
    return () => {
      window.removeEventListener("saved-change", onChange);
      window.removeEventListener("compare-change", onChange);
      window.removeEventListener("runner-profile-change", onChange);
    };
  }, []);

  async function buildTasks() {
    const newTasks = [];
    const savedIds = getSavedIds();
    const compareIds = getCompareIds();

    // 締切3日以内の大会チェック
    if (savedIds.length > 0) {
      try {
        const res = await fetch(`/api/events/by-ids?ids=${savedIds.join(",")}`);
        if (res.ok) {
          const data = await res.json();
          const events = data.events || [];
          const now = new Date();
          const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          const urgentCount = events.filter((ev) => {
            if (!ev.entry_end_date) return false;
            const deadline = new Date(ev.entry_end_date);
            return deadline >= now && deadline <= threeDaysLater;
          }).length;

          if (urgentCount > 0) {
            newTasks.push({
              icon: "⏰",
              text: `${urgentCount}件の大会が3日以内に締切`,
              href: "/alerts",
              priority: "high",
            });
          }
        }
      } catch {}
    }

    // 比較中の大会
    if (compareIds.length >= 2) {
      newTasks.push({
        icon: "📊",
        text: `${compareIds.length}件の大会を比較中 — 決めましょう`,
        href: "/compare",
        priority: "medium",
      });
    }

    // プロフィール未設定
    if (!hasRunnerProfile()) {
      newTasks.push({
        icon: "👤",
        text: "プロフィールを設定しておすすめを受け取る",
        href: "/profile",
        priority: "low",
      });
    }

    setTasks(newTasks);
  }

  if (tasks.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-3">
        <span>📋</span> 今週やること
      </h2>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <Link
            key={i}
            href={task.href}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:shadow-sm ${
              task.priority === "high"
                ? "bg-red-50 border-red-200 hover:bg-red-100"
                : task.priority === "medium"
                  ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span className="text-base flex-shrink-0">{task.icon}</span>
            <span className="text-sm text-gray-700 flex-1">{task.text}</span>
            <span className="text-xs text-blue-600 flex-shrink-0">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
