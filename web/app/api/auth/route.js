import { NextResponse } from "next/server";
import {
  getCurrentUser,
  signupUser,
  loginUser,
  logoutUser,
} from "@/lib/auth";

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

    if (action === "signup") {
      const { email, password, name } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "メールアドレスとパスワードは必須です" },
          { status: 400 }
        );
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: "パスワードは6文字以上必要です" },
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
      const result = await loginUser({ email, password });
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
