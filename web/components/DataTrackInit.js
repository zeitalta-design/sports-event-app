"use client";

import { useEffect } from "react";
import { initDataTrackListener } from "@/lib/track-event";

/**
 * Phase175: data-track属性の自動計測初期化コンポーネント
 *
 * layout.jsに配置して、[data-track]クリックを自動計測。
 */
export default function DataTrackInit() {
  useEffect(() => {
    initDataTrackListener();
  }, []);
  return null;
}
