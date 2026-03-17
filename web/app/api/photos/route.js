import { NextResponse } from "next/server";
import {
  getEventPhotos,
  getEventPhotoTypes,
  getEventPhotoYears,
} from "@/lib/photo-service";

/**
 * Phase158: 公開写真API
 * GET /api/photos?event_id=X&image_type=Y&limit=50&offset=0
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const imageType = searchParams.get("image_type") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Number(searchParams.get("offset")) || 0;

    const { photos, total } = getEventPhotos(Number(eventId), { imageType, limit, offset });
    const types = getEventPhotoTypes(Number(eventId));
    const years = getEventPhotoYears(Number(eventId));

    return NextResponse.json({ photos, total, types, years });
  } catch (err) {
    console.error("Photos API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
