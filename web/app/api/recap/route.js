import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEventRecap, getUserRecapList } from "@/lib/recap-service";

/**
 * Phase168: 振り返りAPI
 *
 * GET /api/recap?event_id=X       — 特定大会の振り返り
 * GET /api/recap?list=1           — ユーザーの全振り返り一覧
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const isList = searchParams.get("list");

    if (isList) {
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const items = getUserRecapList(user.id);
      return NextResponse.json({ items });
    }

    if (!eventId) {
      return NextResponse.json({ error: "event_id or list required" }, { status: 400 });
    }

    const recap = getEventRecap(Number(eventId), {
      year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
      userId: user?.id,
    });

    if (!recap) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(recap);
  } catch (err) {
    console.error("Recap API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
