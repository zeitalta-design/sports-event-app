import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    const db = getDb();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
    const status = url.searchParams.get("status");
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (status) {
      where.push("ej.status = ?");
      params.push(status);
    }
    const userId = url.searchParams.get("user_id");
    if (userId) {
      where.push("ej.user_id = ?");
      params.push(Number(userId));
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const total = db
      .prepare(`SELECT COUNT(*) as c FROM email_jobs ej ${whereClause}`)
      .get(...params).c;

    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        COUNT(*) as total,
        COUNT(DISTINCT user_id) as userCount
      FROM email_jobs
    `).get();

    const emails = db
      .prepare(
        `SELECT ej.*, u.email as user_email, u.name as user_name
         FROM email_jobs ej
         LEFT JOIN users u ON ej.user_id = u.id
         ${whereClause} ORDER BY ej.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
