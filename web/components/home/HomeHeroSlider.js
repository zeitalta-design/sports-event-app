"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * トップページ ヒーロースライダー（本番品質）
 *
 * 3枚固定。画像の解決順序:
 *   1. 手動配置: public/hero/{手動ファイル名}.jpg
 *   2. 自動選別: public/hero/generated/{slideKey}.jpg
 *   3. フォールバック: グラデーション背景
 *
 * ヒーロー高さ: モバイル300px / PC 420px
 */

const SLIDES = [
  {
    id: "open",
    slideKey: "entry-open",
    image: "/hero/entry-open.jpg",
    generatedImage: "/hero/generated/entry-open.jpg",
    imagePosition: "center center",
    gradient: "from-blue-800 via-blue-700 to-indigo-900",
    accentColor: "bg-blue-400/20",
    overlayOpacity: "from-black/65 via-black/35 to-black/15",
    title: "今エントリーできる大会",
    subtitle: "受付中の大会をすぐ探せます",
    cta: "大会を探す",
    href: "/marathon/theme/open",
  },
  {
    id: "deadline",
    slideKey: "deadline-soon",
    image: "/hero/deadline-soon.jpg",
    generatedImage: "/hero/generated/deadline-soon.jpg",
    imagePosition: "center center",
    gradient: "from-rose-800 via-pink-700 to-red-900",
    accentColor: "bg-rose-400/20",
    overlayOpacity: "from-black/65 via-black/35 to-black/15",
    title: "締切間近の大会",
    subtitle: "申込期限が近い大会を先にチェック",
    cta: "急いでチェック",
    href: "/marathon/theme/deadline",
  },
  {
    id: "beginner",
    slideKey: "beginner-friendly",
    image: "/hero/beginner-friendly.jpg",
    generatedImage: "/hero/generated/beginner-friendly.jpg",
    imagePosition: "center center",
    gradient: "from-emerald-800 via-teal-700 to-green-900",
    accentColor: "bg-emerald-400/20",
    overlayOpacity: "from-black/65 via-black/35 to-black/15",
    title: "初心者でも参加しやすい大会",
    subtitle: "はじめてでも選びやすい大会を掲載",
    cta: "初心者向けを見る",
    href: "/marathon/theme/beginner",
  },
];

export default function HomeHeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const pauseTimeoutRef = useRef(null);
  const touchStartRef = useRef(null);

  function resolveImageSrc(slide) {
    const failed = imageErrors[slide.id] || new Set();
    if (slide.image && !failed.has(slide.image)) return slide.image;
    if (slide.generatedImage && !failed.has(slide.generatedImage)) return slide.generatedImage;
    return null;
  }

  const goTo = useCallback((index) => {
    setCurrent(index);
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 8000);
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % SLIDES.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  const goNext = useCallback(() => {
    next();
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 8000);
  }, [next]);

  const goPrev = useCallback(() => {
    prev();
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 8000);
  }, [prev]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, next]);

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  function handleTouchStart(e) {
    touchStartRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartRef.current = null;
  }

  function handleImageError(slideId, src) {
    setImageErrors((prev) => {
      const existing = prev[slideId] || new Set();
      const next = new Set(existing);
      next.add(src);
      return { ...prev, [slideId]: next };
    });
  }

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        setIsPaused(false);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="ヒーロースライド"
      role="region"
    >
      {/* ヒーロー高さ: SP 300px / PC 420px */}
      <div className="relative h-[300px] sm:h-[420px]">
        {SLIDES.map((s, i) => {
          const isActive = i === current;
          const imageSrc = resolveImageSrc(s);

          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
              aria-hidden={!isActive}
            >
              {/* グラデーション背景 */}
              <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`}>
                <div className="absolute inset-0 overflow-hidden">
                  <div className={`absolute -top-24 -left-24 w-[500px] h-[500px] rounded-full blur-3xl ${s.accentColor}`} />
                  <div className={`absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full blur-3xl ${s.accentColor}`} />
                  <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-3xl opacity-10 bg-white" />
                </div>
              </div>

              {/* 実写画像 */}
              {imageSrc && (
                <Image
                  key={imageSrc}
                  src={imageSrc}
                  alt=""
                  fill
                  className="object-cover"
                  style={{ objectPosition: s.imagePosition || "center center" }}
                  sizes="100vw"
                  priority={i === 0}
                  onError={() => handleImageError(s.id, imageSrc)}
                />
              )}

              {/* オーバーレイ */}
              <div className={`absolute inset-0 bg-gradient-to-r ${s.overlayOpacity || "from-black/65 via-black/35 to-black/15"}`} />

              {/* テキストコンテンツ */}
              <div className="relative z-10 h-full max-w-6xl mx-auto px-6 sm:px-10 flex items-center">
                <div className="max-w-2xl">
                  {isActive && (
                    <div
                      key={`content-${s.id}-${current}`}
                      className="animate-[heroFadeIn_0.6s_ease-out]"
                    >
                      <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-[1.2]">
                        {s.title}
                      </h2>
                      <p className="mt-2 sm:mt-3 text-sm sm:text-base md:text-lg text-white/90 font-normal leading-relaxed">
                        {s.subtitle}
                      </p>
                      <Link
                        href={s.href}
                        className="inline-flex items-center gap-2 mt-5 sm:mt-6 px-6 py-2.5 sm:py-3 bg-white text-gray-900 font-bold text-sm sm:text-base rounded-full hover:bg-white/90 active:bg-white/80 transition-colors shadow-xl"
                      >
                        {s.cta}
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 左右ナビ矢印 */}
        <button
          onClick={goPrev}
          className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
          aria-label="前のスライド"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={goNext}
          className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
          aria-label="次のスライド"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* ドットインジケータ */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-9 h-3 bg-white"
                  : "w-3 h-3 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`スライド ${i + 1}: ${s.title}`}
              aria-current={i === current ? "true" : undefined}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes heroFadeIn {
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
