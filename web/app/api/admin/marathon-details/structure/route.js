import { NextResponse } from "next/server";
import { isLlmAvailable } from "@/lib/llm-client";
import { structureMarathonDetailText } from "@/lib/marathon-detail-structurer";

/**
 * POST /api/admin/marathon-details/structure
 *
 * 大会情報テキストをLLMで構造化JSONに変換する。
 *
 * Body:
 *   text         - 元テキスト（必須）
 *   sourceUrl    - ソースURL
 *   sourceType   - ソース種別 (moshicom/runnet/official/manual)
 *   marathonName - 大会名
 */
export async function POST(request) {
  try {
    // LLM有効チェック
    if (!isLlmAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "LLMが設定されていません。環境変数 LLM_ENABLED, LLM_API_KEY を確認してください。",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { text, sourceUrl, sourceType, marathonName } = body;

    // バリデーション
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "テキストが入力されていません。" },
        { status: 400 }
      );
    }

    if (text.length > 50000) {
      return NextResponse.json(
        {
          success: false,
          error: `テキストが長すぎます（${text.length}文字）。50,000文字以内にしてください。`,
        },
        { status: 400 }
      );
    }

    // 構造化実行
    const result = await structureMarathonDetailText({
      text,
      sourceUrl: sourceUrl || null,
      sourceType: sourceType || "manual",
      marathonName: marathonName || null,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      validation: result.validation,
      usage: result.usage,
      model: result.model,
    });
  } catch (err) {
    console.error("Structure API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "構造化処理でエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}
