import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const status = searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    const db = getDb();

    let where = "";
    const params = [];
    if (status) {
      where = "WHERE status = ?";
      params.push(status);
    }

    const total = db
      .prepare(`SELECT COUNT(*) as cnt FROM daily_jobs ${where}`)
      .get(...params).cnt;

    const jobs = db
      .prepare(
        `SELECT * FROM daily_jobs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    // 今日の実行状況
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayJob = db
      .prepare(
        "SELECT * FROM daily_jobs WHERE run_date = ? ORDER BY id DESC LIMIT 1"
      )
      .get(todayStr);

    // 統計
    const stats = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'partial_success' THEN 1 ELSE 0 END) as partial_success,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
        FROM daily_jobs`
      )
      .get();

    // ユーザー統計
    const userStats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as totalUsers,
        (SELECT COUNT(DISTINCT user_key) FROM notifications) as usersWithNotifications,
        (SELECT COUNT(DISTINCT user_id) FROM email_jobs WHERE user_id IS NOT NULL) as usersWithEmailJobs,
        (SELECT COUNT(DISTINCT user_id) FROM email_jobs WHERE user_id IS NOT NULL AND status = 'pending') as usersWithPendingEmails
    `).get();

    return NextResponse.json({
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      todayJob,
      stats,
      userStats,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
