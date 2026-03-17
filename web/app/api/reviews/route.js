import { NextResponse } from "next/server";
import { getEventReviews, getEventReviewSummary, createReview } from "@/lib/review-service";
import { getCurrentUser } from "@/lib/auth";

/**
 * Phase138-139: 口コミAPI
 *
 * GET  /api/reviews?event_id=X          — 口コミ一覧（認証不要）
 * GET  /api/reviews?event_id=X&summary=1 — サマリーのみ（認証不要）
 * POST /api/reviews                      — 口コミ投稿（認証必須）
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const isSummary = searchParams.get("summary") === "1";
    if (isSummary) {
      const summary = getEventReviewSummary(parseInt(eventId));
      return NextResponse.json({ summary });
    }

    const sort = searchParams.get("sort") || "newest";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const { reviews, total } = getEventReviews(parseInt(eventId), { limit, offset, sort });
    const summary = getEventReviewSummary(parseInt(eventId));

    return NextResponse.json({ reviews, total, summary });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // 認証チェック（必須）
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "口コミを投稿するにはログインが必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event_id, rating_overall, review_body, nickname } = body;

    if (!event_id) {
      return NextResponse.json({ error: "大会IDが必要です" }, { status: 400 });
    }
    if (!rating_overall || rating_overall < 1 || rating_overall > 5) {
      return NextResponse.json({ error: "総合評価（1〜5）を入力してください" }, { status: 400 });
    }
    if (!review_body || review_body.trim().length < 10) {
      return NextResponse.json({ error: "感想を10文字以上で入力してください" }, { status: 400 });
    }

    const id = createReview({
      event_id: parseInt(event_id),
      sport_type: body.sport_type || null,
      user_id: user.id,
      rating_overall: parseInt(rating_overall),
      rating_course: body.rating_course ? parseInt(body.rating_course) : null,
      rating_access: body.rating_access ? parseInt(body.rating_access) : null,
      rating_venue: body.rating_venue ? parseInt(body.rating_venue) : null,
      rating_beginner: body.rating_beginner ? parseInt(body.rating_beginner) : null,
      review_title: body.review_title || null,
      review_body: review_body.trim(),
      participant_type: body.participant_type || null,
      visit_type: body.visit_type || null,
      year_joined: body.year_joined ? parseInt(body.year_joined) : null,
      nickname: nickname?.trim() || user.name || "匿名ランナー",
      recommended_for: body.recommended_for || null,
    });

    return NextResponse.json({ id, message: "口コミを投稿しました" });
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
