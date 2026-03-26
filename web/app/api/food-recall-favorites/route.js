import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ favorites: [], ids: [], total: 0 });
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const checkId = searchParams.get("check");

    if (checkId) {
      const fav = db.prepare("SELECT id FROM food_recall_favorites WHERE user_key = ? AND food_recall_id = ?").get(user.userKey, checkId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    const favorites = db.prepare(`
      SELECT f.food_recall_id, f.created_at as favorited_at,
        fri.slug, fri.product_name, fri.manufacturer, fri.category,
        fri.risk_level, fri.reason, fri.recall_date, fri.status, fri.summary
      FROM food_recall_favorites f
      JOIN food_recall_items fri ON fri.id = f.food_recall_id
      WHERE f.user_key = ?
      ORDER BY f.created_at DESC
    `).all(user.userKey);

    const ids = db.prepare("SELECT food_recall_id FROM food_recall_favorites WHERE user_key = ?").all(user.userKey).map((r) => r.food_recall_id);
    return NextResponse.json({ favorites, ids, total: favorites.length });
  } catch (error) {
    console.error("GET /api/food-recall-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const db = getDb();
    const { food_recall_id } = await request.json();
    if (!food_recall_id) return NextResponse.json({ error: "food_recall_id is required" }, { status: 400 });

    const item = db.prepare("SELECT id FROM food_recall_items WHERE id = ?").get(food_recall_id);
    if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

    try {
      db.prepare("INSERT INTO food_recall_favorites (user_key, food_recall_id, created_at) VALUES (?, ?, datetime('now'))").run(user.userKey, food_recall_id);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ message: "already favorited" });
      throw err;
    }
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/food-recall-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
