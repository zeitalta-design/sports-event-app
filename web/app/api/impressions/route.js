import { NextResponse } from "next/server";
import { recordImpressions } from "@/lib/placement-analytics";

/**
 * POST /api/impressions
 *
 * フロントから表示イベント群のインプレッションをバッチ記録する。
 * Body: { items: [{ eventId: 123, placement: "featured" }, ...] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    // 最大100件に制限
    const limited = items.slice(0, 100);
    const result = recordImpressions(limited);

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/impressions error:", err);
    return NextResponse.json({ ok: true }); // 静かに返す
  }
}
