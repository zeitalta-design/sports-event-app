/**
 * Phase88: レコメンドAPI
 *
 * GET /api/recommendations?distances=full,half&prefectures=東京都&level=intermediate&exclude=1,2,3&limit=10
 *
 * runner-profile.js の buildRecommendationParams() 出力と互換。
 */

import { NextResponse } from "next/server";
import { getPersonalizedRecommendations } from "@/lib/recommendation-engine";
import { getCurrentUser } from "@/lib/auth";
import { getHistoryBasedRecommendations } from "@/lib/participation-recommendation";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // パラメータ解析
    const distancesRaw = searchParams.get("distances");
    const distances = distancesRaw ? distancesRaw.split(",").filter(Boolean) : [];

    // distance 単一パラメータ対応（buildRecommendationParams 互換）
    const distanceSingle = searchParams.get("distance");
    if (distanceSingle && distances.length === 0) {
      const mapped = distanceSingle === "10" ? "10km"
        : distanceSingle === "5" ? "5km"
        : distanceSingle;
      distances.push(mapped);
    }

    const prefecturesRaw = searchParams.get("prefectures") || searchParams.get("prefecture");
    const prefectures = prefecturesRaw ? prefecturesRaw.split(",").filter(Boolean) : [];

    const level = searchParams.get("level") || null;

    const goalsRaw = searchParams.get("goals");
    const goals = goalsRaw ? goalsRaw.split(",").filter(Boolean) : [];

    const excludeRaw = searchParams.get("exclude");
    const excludeIds = excludeRaw
      ? excludeRaw.split(",").map(Number).filter(Boolean)
      : [];

    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);
    const sessionId = searchParams.get("session_id") || null;
    const includeHistory = searchParams.get("include_history") === "1";

    // プロフィール構築
    const profile = (distances.length > 0 || prefectures.length > 0 || level)
      ? { distances, prefectures, level, goals }
      : null;

    const recommendations = getPersonalizedRecommendations({
      profile,
      excludeIds,
      limit,
      sessionId,
    });

    // Phase172: ログインユーザーの参加履歴ベースレコメンド
    let historyRecommendations = [];
    if (includeHistory) {
      try {
        const user = await getCurrentUser();
        if (user) {
          const recIds = recommendations.map((r) => r.id);
          historyRecommendations = getHistoryBasedRecommendations(user.id, {
            limit: 6,
            excludeIds: [...excludeIds, ...recIds],
          });
        }
      } catch {}
    }

    return NextResponse.json({
      recommendations,
      historyRecommendations,
      count: recommendations.length,
      hasProfile: profile !== null,
      hasHistory: historyRecommendations.length > 0,
    });
  } catch (err) {
    console.error("Recommendations API error:", err);
    return NextResponse.json(
      { error: "Failed to get recommendations", recommendations: [], count: 0, historyRecommendations: [] },
      { status: 500 }
    );
  }
}
