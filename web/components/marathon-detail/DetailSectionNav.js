"use client";

import { useState, useEffect } from "react";

/**
 * Phase98: セクションナビゲーション
 *
 * スクロール連動のアンカーナビゲーション。
 * 現在表示中のセクションをハイライト。
 */

const SECTIONS = [
  { id: "section-overview", label: "概要", icon: "📋" },
  { id: "section-races", label: "種目", icon: "🏅" },
  { id: "section-info", label: "大会情報", icon: "ℹ️" },
  { id: "section-entry", label: "参加方法", icon: "✅" },
  { id: "section-access", label: "会場", icon: "📍" },
];

export default function DetailSectionNav() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 画面内に見えているセクションのうち最も上にあるものをアクティブに
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  function handleClick(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-4 px-4 mb-6">
      <div className="flex gap-0 overflow-x-auto scrollbar-none">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => handleClick(section.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSection === section.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="hidden sm:inline text-base">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
