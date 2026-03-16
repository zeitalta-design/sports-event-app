import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const SETTING_COLUMNS = [
  "enable_deadline_7d",
  "enable_deadline_3d",
  "enable_deadline_today",
  "enable_saved_search_match",
  "enable_favorite_deadline_7d",
  "enable_favorite_deadline_3d",
  "enable_favorite_deadline_today",
];

function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL UNIQUE,
      enable_deadline_7d INTEGER NOT NULL DEFAULT 1,
      enable_deadline_3d INTEGER NOT NULL DEFAULT 1,
      enable_deadline_today INTEGER NOT NULL DEFAULT 1,
      enable_saved_search_match INTEGER NOT NULL DEFAULT 1,
      enable_favorite_deadline_7d INTEGER NOT NULL DEFAULT 1,
      enable_favorite_deadline_3d INTEGER NOT NULL DEFAULT 1,
      enable_favorite_deadline_today INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getOrCreateSettings(db, userKey) {
  let settings = db
    .prepare("SELECT * FROM notification_settings WHERE user_key = ?")
    .get(userKey);

  if (!settings) {
    db.prepare("INSERT INTO notification_settings (user_key) VALUES (?)").run(
      userKey
    );
    settings = db
      .prepare("SELECT * FROM notification_settings WHERE user_key = ?")
      .get(userKey);
  }

  return settings;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ settings: null });
    }
    const db = getDb();
    ensureTable(db);
    const userKey = user.userKey;
    const settings = getOrCreateSettings(db, userKey);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET /api/notification-settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }
    const db = getDb();
    ensureTable(db);
    const userKey = user.userKey;
    const body = await request.json();

    // Ensure settings exist
    getOrCreateSettings(db, userKey);

    // Build SET clause from valid columns only
    const updates = [];
    const params = [];
    for (const col of SETTING_COLUMNS) {
      if (body[col] !== undefined) {
        updates.push(`${col} = ?`);
        params.push(body[col] ? 1 : 0);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    params.push(userKey);

    db.prepare(
      `UPDATE notification_settings SET ${updates.join(", ")} WHERE user_key = ?`
    ).run(...params);

    const settings = getOrCreateSettings(db, userKey);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("PATCH /api/notification-settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
