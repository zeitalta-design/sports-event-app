import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserResults,
  getUserPBs,
  getUserGrowth,
  findResultByBib,
  linkUserResult,
  unlinkUserResult,
} from "@/lib/results-service";

/**
 * Phase148: ユーザー個人結果API（認証必須）
 *
 * GET  /api/my-results — 自分の結果一覧・PB
 * POST /api/my-results — 結果紐付け（ゼッケン番号で照合）
 * DELETE /api/my-results — 紐付け解除
 */

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view"); // "pbs" | "growth"
    const category = searchParams.get("category");

    if (view === "pbs") {
      const pbs = getUserPBs(user.id);
      return NextResponse.json({ pbs });
    }

    if (view === "growth") {
      const growth = getUserGrowth(user.id, category || undefined);
      return NextResponse.json({ growth, category });
    }

    // デフォルト: 全結果
    const results = getUserResults(user.id);
    const pbs = getUserPBs(user.id);
    return NextResponse.json({ results, pbs, total: results.length });
  } catch (err) {
    console.error("My Results GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, bib_number, year } = body;

    if (!event_id || !bib_number) {
      return NextResponse.json(
        { error: "event_id and bib_number are required" },
        { status: 400 }
      );
    }

    // ゼッケン番号で結果を検索
    const result = findResultByBib(Number(event_id), String(bib_number), year ? Number(year) : undefined);
    if (!result) {
      return NextResponse.json(
        { error: "result_not_found", message: "該当する結果が見つかりません。ゼッケン番号と年度を確認してください。" },
        { status: 404 }
      );
    }

    // 紐付け
    const linkResult = linkUserResult(user.id, result.id, Number(event_id));
    if (!linkResult.success) {
      const messages = {
        already_linked: "この結果は既に紐付け済みです。",
        same_event_year_linked: "同じ大会・年度の結果が既に紐付けされています。",
        result_not_found: "結果が見つかりません。",
      };
      return NextResponse.json(
        { error: linkResult.error, message: messages[linkResult.error] || "紐付けに失敗しました。" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("My Results POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { result_id } = body;

    if (!result_id) {
      return NextResponse.json({ error: "result_id is required" }, { status: 400 });
    }

    const res = unlinkUserResult(user.id, Number(result_id));
    return NextResponse.json(res);
  } catch (err) {
    console.error("My Results DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
