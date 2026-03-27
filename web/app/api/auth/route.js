import { NextResponse } from "next/server";
import {
  getCurrentUser,
  signupUser,
  loginUser,
  logoutUser,
} from "@/lib/auth";
import { extractRequestInfo } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth — 現在のユーザー取得
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ user: null, error: error.message });
  }
}

/**
 * POST /api/auth — signup / login / logout
 * body: { action: "signup" | "login" | "logout", email, password, name }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const { ipAddress, userAgent } = extractRequestInfo(request);

    if (action === "signup") {
      // ALLOW_SIGNUP が明示的に "true" でなければ登録を拒否
      if (process.env.ALLOW_SIGNUP !== "true") {
        return NextResponse.json(
          { error: "現在、新規ユーザー登録は停止中です" },
          { status: 403 }
        );
      }
      const { email, password, name } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "メールアドレスとパスワードは必須です" },
          { status: 400 }
        );
      }
      const result = await signupUser({ email, password, name });
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, user: result.user });
    }

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "メールアドレスとパスワードは必須です" },
          { status: 400 }
        );
      }
      const result = await loginUser({ email, password, ipAddress, userAgent });
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      return NextResponse.json({ success: true, user: result.user });
    }

    if (action === "logout") {
      await logoutUser();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
