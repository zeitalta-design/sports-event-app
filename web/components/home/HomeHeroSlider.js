"use client";
import { useState, useEffect, useCallback } from "react";

const SLIDES = [
  {
    id: 1,
    title: "春の注目大会を探そう",
    subtitle: "全国のマラソン・ランニング大会が見つかる",
    gradient: "from-blue-800 via-blue-700 to-indigo-800",
    icon: "🏃",
    accent: "bg-blue-400/20",
  },
  {
    id: 2,
    title: "週末のイベントを見つけよう",
    subtitle: "あなたの街の大会をチェック",
    gradient: "from-emerald-800 via-teal-700 to-cyan-800",
    icon: "🗓️",
    accent: "bg-emerald-400/20",
  },
  {
    id: 3,
    title: "初心者歓迎の大会も多数掲載",
    subtitle: "5km・10kmから始められる大会が見つかる",
    gradient: "from-orange-700 via-amber-700 to-yellow-800",
    icon: "⭐",
    accent: "bg-amber-400/20",
  },
  {
    id: 4,
    title: "目標の大会を比較して選ぼう",
    subtitle: "距離・制限時間・アクセスで比較できる",
    gradient: "from-purple-800 via-violet-700 to-indigo-800",
    icon: "📊",
    accent: "bg-purple-400/20",
  },
  {
    id: 5,
    title: "エントリー締切を逃さない",
    subtitle: "お気に入り登録で通知を受け取ろう",
    gradient: "from-rose-800 via-pink-700 to-fuchsia-800",
    icon: "🔔",
    accent: "bg-rose-400/20",
  },
];

export default function HomeHeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, next]);

  const slide = SLIDES[current];

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="ヒーロースライド"
    >
      {/* スライド本体 — PC 320px / SP 260px 固定 */}
      <div
        className={`relative bg-gradient-to-br ${slide.gradient} transition-all duration-700 ease-in-out h-[260px] sm:h-[320px]`}
      >
        {/* 背景装飾 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-20 -left-20 w-96 h-96 rounded-full blur-3xl ${slide.accent}`} />
          <div className={`absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-3xl ${slide.accent}`} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-5 bg-white" />
        </div>

        {/* コンテンツ — 高さ固定に合わせて中央寄せ */}
        <div className="relative max-w-6xl mx-auto px-4 h-full flex items-center">
          <div className="flex items-center gap-6 w-full">
            <div className="flex-1">
              <div
                key={slide.id}
                className="animate-[fadeInUp_0.6s_ease-out]"
              >
                <span className="text-4xl sm:text-5xl mb-3 block">{slide.icon}</span>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
                  {slide.title}
                </h2>
                <p className="mt-2 sm:mt-3 text-base sm:text-lg text-white/80 font-light">
                  {slide.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ドットナビ */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 h-2.5 bg-white"
                  : "w-2.5 h-2.5 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`スライド ${i + 1} に切り替え`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
