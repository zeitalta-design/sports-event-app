/**
 * Admin API 認証ガード
 *
 * admin API route で使う共通ヘルパー。
 * 既存の requireAdmin() を使い、未認証 → 401、未権限 → 403 を返す。
 *
 * Usage:
 *   import { requireAdminApi } from "@/lib/admin-api-guard";
 *
 *   export async function GET(request) {
 *     const guard = await requireAdminApi();
 *     if (guard.error) return guard.error;
 *     // guard.user で admin ユーザーを参照可能
 *     ...
 *   }
 */

import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

/**
 * admin API 用の認証チェック
 * @returns {{ user: object, error: null } | { user: null, error: NextResponse }}
 */
export async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = await requireAdmin();
  if (!admin) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user: admin, error: null };
}
