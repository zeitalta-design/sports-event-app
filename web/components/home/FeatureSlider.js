"use client";
import { useRef, useState, useEffect, useCallback } from "react";

/**
 * 特集カルーセル — 無限ループ風・補助導線
 *
 * 仕組み: 前後にクローンカードを追加し、端到達時にアニメーションなしで位置補正
 * PC: 3枚表示 / スマホ: 1.2枚見え / 高さ: 130px
 */

const FEATURES = [
  {
    id: "spring",
    label: "春のおすすめ大会",
    desc: "桜の季節に走ろう",
    href: "/marathon?month=4",
    image: "/feature/spring.jpg",
  },
  {
    id: "beginner",
    label: "初心者歓迎の大会",
    desc: "5km・10kmから気軽に参加",
    href: "/marathon/theme/beginner",
    image: "/feature/beginner.jpg",
  },
  {
    id: "deadline",
    label: "締切間近の大会",
    desc: "エントリーはお早めに",
    href: "/marathon?sort=entry_end_date",
    image: "/feature/deadline.jpg",
  },
  {
    id: "trail",
    label: "トレイルラン特集",
    desc: "山を駆け抜ける爽快レース",
    href: "/trail",
    image: "/feature/trail.jpg",
  },
  {
    id: "featured",
    label: "注目の大会",
    desc: "いま話題のレースをチェック",
    href: "/marathon?sort=popularity",
    image: "/feature/featured.jpg",
  },
];

// クローン: 末尾3枚を先頭に、先頭3枚を末尾に追加
const CLONE_COUNT = 3;
const clonesBefore = FEATURES.slice(-CLONE_COUNT).map((f, i) => ({ ...f, _key: `clone-before-${i}` }));
const clonesAfter = FEATURES.slice(0, CLONE_COUNT).map((f, i) => ({ ...f, _key: `clone-after-${i}` }));
const ALL_SLIDES = [...clonesBefore, ...FEATURES.map(f => ({ ...f, _key: f.id })), ...clonesAfter];

export default function FeatureSlider() {
  const trackRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const pausedRef = useRef(false);
  const cardWidthRef = useRef(0);

  // カード幅を計測
  const measureCard = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    const card = track.querySelector("[data-feature-card]");
    if (!card) return 280;
    // カード幅 + gap(16px)
    const w = card.offsetWidth + 16;
    cardWidthRef.current = w;
    return w;
  }, []);

  // 初期位置: クローン分をスキップ
  useEffect(() => {
    const w = measureCard();
    if (w > 0) {
      setIsTransitioning(false);
      setOffset(CLONE_COUNT * w);
      // 次のフレームでtransition有効化
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsTransitioning(true));
      });
    }
  }, [measureCard]);

  // リサイズ対応
  useEffect(() => {
    function handleResize() {
      const w = measureCard();
      if (w > 0) {
        setIsTransitioning(false);
        setOffset(CLONE_COUNT * w);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIsTransitioning(true));
        });
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [measureCard]);

  // transition終了時にクローン位置からリアル位置に瞬時補正
  function handleTransitionEnd() {
    const w = cardWidthRef.current;
    if (w <= 0) return;
    const realStart = CLONE_COUNT * w;
    const realEnd = realStart + FEATURES.length * w;

    if (offset >= realEnd) {
      // 末尾クローンに到達 → リアル先頭に瞬時移動
      setIsTransitioning(false);
      setOffset(realStart + (offset - realEnd));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsTransitioning(true));
      });
    } else if (offset < realStart) {
      // 先頭クローンに到達 → リアル末尾に瞬時移動
      setIsTransitioning(false);
      setOffset(realEnd - (realStart - offset));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsTransitioning(true));
      });
    }
  }

  function slideNext() {
    const w = cardWidthRef.current || measureCard();
    setIsTransitioning(true);
    setOffset((prev) => prev + w);
  }

  function slidePrev() {
    const w = cardWidthRef.current || measureCard();
    setIsTransitioning(true);
    setOffset((prev) => prev - w);
  }

  // 自動スライド: 4秒
  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) slideNext();
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // スワイプ
  const touchRef = useRef(null);
  function onTouchStart(e) { touchRef.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchRef.current === null) return;
    const diff = touchRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) slideNext();
      else slidePrev();
      pausedRef.current = true;
      setTimeout(() => { pausedRef.current = false; }, 6000);
    }
    touchRef.current = null;
  }

  return (
    <section
      className="bg-gray-50 py-5 sm:py-6"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* 見出し + 矢印 */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold text-gray-800">特集から探す</h2>
          <div className="hidden sm:flex gap-1">
            <button
              onClick={() => { slidePrev(); pausedRef.current = true; setTimeout(() => { pausedRef.current = false; }, 6000); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
              aria-label="前へ"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => { slideNext(); pausedRef.current = true; setTimeout(() => { pausedRef.current = false; }, 6000); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
              aria-label="次へ"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* カルーセル — overflow hidden + transform方式 */}
        <div
          className="overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            ref={trackRef}
            className="flex gap-4"
            style={{
              transform: `translateX(-${offset}px)`,
              transition: isTransitioning ? "transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1)" : "none",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {ALL_SLIDES.map((f) => (
              <a
                key={f._key}
                href={f.href}
                data-feature-card
                className="group flex-shrink-0 w-[78%] sm:w-[calc((100%-2rem)/3)]"
              >
                <div className="relative overflow-hidden rounded-xl h-[130px] shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200">
                  <img
                    src={f.image}
                    alt={f.label}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                    <p
                      className="text-white font-bold text-sm leading-snug"
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                    >
                      {f.label}
                    </p>
                    <p className="text-white/70 text-[10px] mt-0.5">{f.desc}</p>
                  </div>
                  <svg
                    className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all"
                    fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
