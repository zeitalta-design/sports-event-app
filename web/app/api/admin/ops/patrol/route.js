import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * Phase228: 巡回パトロール / 品質確認API
 * 大会情報の欠損・矛盾・重複候補を検出
 */
export async function GET(request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const issue = searchParams.get("issue");
    const now = new Date().toISOString().split("T")[0];
    const staleDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    // 問題種別ごとの件数
    const issueCounts = {
      no_date: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (event_date IS NULL OR event_date = '')`
      ).get().c,
      no_prefecture: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (prefecture IS NULL OR prefecture = '')`
      ).get().c,
      no_venue: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (venue IS NULL OR venue = '')`
      ).get().c,
      no_distance: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND id NOT IN (SELECT DISTINCT event_id FROM event_races)`
      ).get().c,
      no_url: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND (official_url IS NULL OR official_url = '')`
      ).get().c,
      past_active: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND event_date < ? AND event_date IS NOT NULL AND event_date != ''`
      ).get(now).c,
      stale: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND updated_at < ?`
      ).get(staleDate + "T00:00:00").c,
      conflict: db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE is_active = 1 AND verification_conflict = 1`
      ).get().c,
    };

    // 問題ラベルとレベル
    const ISSUE_META = {
      no_date: { label: "開催日未設定", level: "danger", priority: 1 },
      no_prefecture: { label: "都道府県未設定", level: "danger", priority: 2 },
      no_venue: { label: "会場未設定", level: "warning", priority: 3 },
      no_distance: { label: "種目（距離）未設定", level: "warning", priority: 4 },
      no_url: { label: "公式URL未設定", level: "warning", priority: 5 },
      past_active: { label: "過去開催なのに公開中", level: "danger", priority: 6 },
      stale: { label: "30日以上未更新", level: "info", priority: 7 },
      conflict: { label: "情報矛盾あり", level: "warning", priority: 8 },
    };

    const issueCards = Object.entries(issueCounts).map(([key, count]) => ({
      key,
      ...ISSUE_META[key],
      count,
    })).sort((a, b) => {
      if (a.count > 0 && b.count === 0) return -1;
      if (a.count === 0 && b.count > 0) return 1;
      return a.priority - b.priority;
    });

    // 指定された問題種別の一覧取得
    let events = [];
    if (issue && ISSUE_META[issue]) {
      const queries = {
        no_date: `SELECT id, title, sport_type, event_date, prefecture, updated_at FROM events WHERE is_active = 1 AND (event_date IS NULL OR event_date = '')`,
        no_prefecture: `SELECT id, title, sport_type, event_date, prefecture, updated_at FROM events WHERE is_active = 1 AND (prefecture IS NULL OR prefecture = '')`,
        no_venue: `SELECT id, title, sport_type, event_date, venue, updated_at FROM events WHERE is_active = 1 AND (venue IS NULL OR venue = '')`,
        no_distance: `SELECT id, title, sport_type, event_date, prefecture, updated_at FROM events WHERE is_active = 1 AND id NOT IN (SELECT DISTINCT event_id FROM event_races)`,
        no_url: `SELECT id, title, sport_type, event_date, prefecture, updated_at FROM events WHERE is_active = 1 AND (official_url IS NULL OR official_url = '')`,
        past_active: `SELECT id, title, sport_type, event_date, prefecture, updated_at FROM events WHERE is_active = 1 AND event_date < '${now}' AND event_date IS NOT NULL AND event_date != '' ORDER BY event_date DESC`,
        stale: `SELECT id, title, sport_type, event_date, prefecture, updated_at FROM events WHERE is_active = 1 AND updated_at < '${staleDate}T00:00:00' ORDER BY updated_at ASC`,
        conflict: `SELECT id, title, sport_type, event_date, prefecture, verification_conflict_summary, updated_at FROM events WHERE is_active = 1 AND verification_conflict = 1`,
      };

      events = db.prepare(queries[issue] + " LIMIT 100").all();
    }

    return NextResponse.json({
      issueCards,
      events,
      selectedIssue: issue,
      totalActive: db.prepare("SELECT COUNT(*) as c FROM events WHERE is_active = 1").get().c,
    });
  } catch (err) {
    console.error("Patrol API error:", err);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

/**
 * PATCH: 大会に対するアクション
 * - toggle_active: 公開/非公開切替
 * - flag_review: 後で確認フラグ（admin_event_notesに記録）
 * - dismiss: 解消済み扱い（admin_event_notesに記録）
 */
export async function PATCH(request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const db = getDb();
    const body = await request.json();
    const { event_id, action } = body;

    if (!event_id || !action) {
      return NextResponse.json({ error: "event_id と action は必須です" }, { status: 400 });
    }

    switch (action) {
      case "toggle_active": {
        const ev = db.prepare("SELECT is_active FROM events WHERE id = ?").get(event_id);
        if (!ev) return NextResponse.json({ error: "大会が見つかりません" }, { status: 404 });
        const newActive = ev.is_active ? 0 : 1;
        db.prepare("UPDATE events SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(newActive, event_id);
        return NextResponse.json({ event_id, is_active: newActive, message: newActive ? "公開に変更しました" : "非公開に変更しました" });
      }

      case "flag_review": {
        db.prepare(
          `INSERT INTO admin_event_notes (event_id, note_type, note_text, created_by)
           VALUES (?, 'patrol_review', '巡回パトロールで「後で確認」フラグを設定', 'admin')`
        ).run(event_id);
        return NextResponse.json({ event_id, message: "後で確認フラグを設定しました" });
      }

      case "dismiss": {
        db.prepare(
          `INSERT INTO admin_event_notes (event_id, note_type, note_text, created_by)
           VALUES (?, 'patrol_dismiss', '巡回パトロールで解消済みとして処理', 'admin')`
        ).run(event_id);
        return NextResponse.json({ event_id, message: "解消済みとして記録しました" });
      }

      default:
        return NextResponse.json({ error: `不明なアクション: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Patrol PATCH error:", err);
    return NextResponse.json({ error: "操作に失敗しました" }, { status: 500 });
  }
}
