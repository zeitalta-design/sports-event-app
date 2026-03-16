import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const races = db.prepare(
      "SELECT * FROM event_races WHERE event_id = ? ORDER BY sort_order"
    ).all(id);

    const results = db.prepare(
      "SELECT * FROM event_results WHERE event_id = ? ORDER BY result_year DESC"
    ).all(id);

    const reviews = db.prepare(
      "SELECT * FROM event_reviews WHERE event_id = ? ORDER BY created_at DESC"
    ).all(id);

    return NextResponse.json({
      ...event,
      races,
      results,
      reviews,
    });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
