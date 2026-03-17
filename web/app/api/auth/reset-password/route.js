import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth";
import { extractRequestInfo } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password
 * パスワードリセット実行
 * body: { token, newPassword, newPasswordConfirm }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, newPassword, newPasswordConfirm } = body;

    if (!token) {
      return NextResponse.json(
        { error: "リセットトークンが必要です" },
        { status: 400 }
      );
    }

    if (!newPassword || !newPasswordConfirm) {
      return NextResponse.json(
        { error: "新しいパスワードを入力してください" },
        { status: 400 }
      );
    }

    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json(
        { error: "パスワードが一致しません" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = extractRequestInfo(request);

    const result = await resetPasswordWithToken({
      token,
      newPassword,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "パスワードを再設定しました。新しいパスワードでログインしてください。",
    });
  } catch (error) {
    console.error("[reset-password] error:", error.message);
    return NextResponse.json(
      { error: "リクエストの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
