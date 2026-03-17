import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_PATH = join(process.cwd(), "data", "hero-images.json");

/**
 * GET /api/admin/hero-images
 *
 * ヒーロー画像の候補一覧・ステータスを返す
 */
export async function GET() {
  try {
    if (!existsSync(DATA_PATH)) {
      return NextResponse.json({
        exists: false,
        message: "hero-images.json が未作成です。scripts/fetch-hero-images.js を実行してください。",
        slides: {},
      });
    }

    const raw = readFileSync(DATA_PATH, "utf-8");
    const store = JSON.parse(raw);

    // 各スライドのサマリーを生成
    const summary = {};
    for (const [key, slide] of Object.entries(store.slides || {})) {
      const approved = slide.candidates?.filter((c) => c.status === "approved") || [];
      const active = slide.candidates?.filter((c) => c.status === "active") || [];
      const candidates = slide.candidates?.filter((c) => c.status === "candidate") || [];

      summary[key] = {
        active: slide.active,
        counts: {
          total: slide.candidates?.length || 0,
          approved: approved.length,
          active: active.length,
          candidate: candidates.length,
        },
        candidates: (slide.candidates || []).slice(0, 20), // 上位20件
      };
    }

    return NextResponse.json({
      exists: true,
      updatedAt: store.updatedAt,
      slides: summary,
    });
  } catch (error) {
    console.error("Hero images API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
