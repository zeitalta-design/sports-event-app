"use client";

import { useEffect } from "react";
import { initDataTrackListener } from "@/lib/track-event";

export default function DataTrackInit() {
  useEffect(() => {
    if (typeof initDataTrackListener === "function") {
      initDataTrackListener();
    }
  }, []);
  return null;
}
