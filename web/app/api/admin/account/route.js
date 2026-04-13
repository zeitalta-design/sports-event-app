import { NextResponse } from "next/server";
import { changePassword } from "@/lib/auth";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { extractRequestInfo } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/account — 現在の管理者情報取得
 */
export async function GET() {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const admin = guard.user;
    if (!admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt || admin.last_login_at || null,
        passwordChangedAt: admin.passwordChangedAt || admin.password_changed_at || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/account — パスワード変更
 */
export async function PATCH(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const admin = guard.user;
    if (!admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword, newPasswordConfirm } = body;

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return NextResponse.json(
        { error: "すべての項目を入力してください" },
        { status: 400 }
      );
    }

    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json(
        { error: "新しいパスワードが一致しません" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = extractRequestInfo(request);

    const result = await changePassword({
      userId: admin.id,
      currentPassword,
      newPassword,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "パスワードを変更しました",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
