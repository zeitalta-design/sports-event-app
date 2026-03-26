/**
 * 自動化共通基盤 — AI下書きサービス
 *
 * HTML/テキストからLLMで構造化情報を抽出する共通フロー。
 * deterministic parser で取れない項目を補完・要約する。
 *
 * フロー:
 *   1. 対象HTMLを取得（fetchHtml or 既取得HTML）
 *   2. 前処理でHTMLを簡素化
 *   3. ドメイン別プロンプトでLLM呼び出し
 *   4. JSON構造に正規化
 *   5. confidence / missing / review reasons 付与
 *   6. ai_extractions テーブルに保存
 */

import { callLlm, isLlmAvailable } from "@/lib/llm-client";
import { getDb } from "@/lib/db";
import { fetchHtml, stripTags } from "./fetch-helper.js";

// ─── HTML前処理 ─────────────────────

/**
 * HTMLを前処理してLLM入力用テキストに変換
 * 不要なスクリプト・スタイル・ナビを除去し、本文を抽出
 */
export function preprocessHtml(html, maxChars = 8000) {
  let text = html;
  // script / style / nav / header / footer 除去
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  // タグ除去してプレーンテキスト化
  text = stripTags(text);
  // 連続空白・改行を整理
  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  // 文字数制限
  if (text.length > maxChars) text = text.substring(0, maxChars) + "\n[...truncated]";
  return text;
}

// ─── 共通抽出実行 ─────────────────────

/**
 * AI構造化抽出を実行
 * @param {Object} params
 * @param {string} params.domainId - ドメインID
 * @param {string} params.entityType - エンティティタイプ
 * @param {number} params.entityId - エンティティID（既存データへの紐付け）
 * @param {string} params.entitySlug - slug
 * @param {string} params.sourceUrl - 詳細ページURL
 * @param {string} params.htmlOrText - 入力HTML/テキスト（URLから取得済みの場合）
 * @param {string} params.systemPrompt - LLMシステムプロンプト
 * @param {string} params.userPrompt - LLMユーザープロンプト
 * @param {string} params.extractionType - 抽出タイプ（detail_page, summary, review_assist）
 * @returns {{ extraction: Object, saved: boolean, error?: string }}
 */
export async function runAiExtraction({
  domainId,
  entityType,
  entityId = null,
  entitySlug = null,
  sourceUrl = null,
  htmlOrText = null,
  systemPrompt,
  userPrompt,
  extractionType = "detail_page",
}) {
  // 1. LLM利用可能チェック
  if (!isLlmAvailable()) {
    return { extraction: null, saved: false, error: "LLM未設定（LLM_ENABLED / LLM_API_KEY を確認）" };
  }

  // 2. 入力テキストの準備
  let inputText = htmlOrText;
  if (!inputText && sourceUrl) {
    const result = await fetchHtml(sourceUrl);
    if (!result.ok) {
      return { extraction: null, saved: false, error: `ページ取得失敗: ${result.error}` };
    }
    inputText = preprocessHtml(result.html);
  }
  if (!inputText) {
    return { extraction: null, saved: false, error: "入力テキストなし" };
  }

  // 3. LLM呼び出し
  try {
    const llmResult = await callLlm({
      systemPrompt,
      userPrompt: userPrompt.replace("{{CONTENT}}", inputText),
    });

    // 4. JSON抽出
    const extraction = parseExtractionResult(llmResult.text);

    // 5. 保存
    const db = getDb();
    db.prepare(`
      INSERT INTO ai_extractions
        (domain_id, entity_type, entity_id, entity_slug, source_url, extraction_type,
         input_text_length, extracted_json, missing_fields, review_reasons,
         confidence_score, quality_level, summary_text, llm_model, llm_tokens_used, created_at)
      VALUES
        (@domainId, @entityType, @entityId, @entitySlug, @sourceUrl, @extractionType,
         @inputLength, @extractedJson, @missingFields, @reviewReasons,
         @confidence, @quality, @summary, @model, @tokens, datetime('now'))
    `).run({
      domainId,
      entityType,
      entityId,
      entitySlug,
      sourceUrl,
      extractionType,
      inputLength: inputText.length,
      extractedJson: JSON.stringify(extraction.data || {}),
      missingFields: JSON.stringify(extraction.missingFields || []),
      reviewReasons: JSON.stringify(extraction.reviewReasons || []),
      confidence: extraction.confidence || 0.5,
      quality: extraction.quality || "draft",
      summary: extraction.summary || null,
      model: llmResult.model || "unknown",
      tokens: (llmResult.usage?.inputTokens || 0) + (llmResult.usage?.outputTokens || 0),
    });

    return { extraction, saved: true };
  } catch (err) {
    return { extraction: null, saved: false, error: `LLM呼び出し失敗: ${err.message}` };
  }
}

/**
 * LLM出力からJSON構造を抽出
 */
function parseExtractionResult(text) {
  // JSONブロックを探す
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const raw = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(raw);
      return {
        data: parsed.data || parsed,
        missingFields: parsed.missing_fields || parsed.missingFields || [],
        reviewReasons: parsed.review_reasons || parsed.reviewReasons || [],
        confidence: parsed.confidence || parsed.confidence_score || 0.5,
        quality: parsed.quality || parsed.quality_level || "draft",
        summary: parsed.summary || null,
      };
    } catch { /* fallthrough */ }
  }

  // JSONが見つからない場合はテキストとして保存
  return {
    data: { raw_text: text },
    missingFields: ["structured_data"],
    reviewReasons: ["LLM出力のJSON解析に失敗"],
    confidence: 0.3,
    quality: "raw",
    summary: text.substring(0, 200),
  };
}

// ─── AI抽出結果の取得 ─────────────────────

export function listAiExtractions({ domainId = "", entityType = "", limit = 50, page = 1 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (domainId) { where.push("domain_id = @domainId"); params.domainId = domainId; }
  if (entityType) { where.push("entity_type = @entityType"); params.entityType = entityType; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = limit;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const total = db.prepare(`SELECT COUNT(*) as c FROM ai_extractions ${whereClause}`).get(params).c;
  const items = db.prepare(`SELECT * FROM ai_extractions ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages: Math.ceil(total / pageSize) || 1 };
}

export function getAiExtractionById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM ai_extractions WHERE id = ?").get(id) || null;
}

// ─── ドメイン別プロンプト定義 ─────────────────────

export const FOOD_RECALL_SYSTEM_PROMPT = `あなたは食品リコール情報の構造化抽出アシスタントです。
与えられたリコール情報ページのテキストから、以下の項目を正確に抽出してJSON形式で返してください。

出力形式:
\`\`\`json
{
  "data": {
    "product_name": "商品名",
    "manufacturer": "製造者/事業者名",
    "category": "食品カテゴリ(processed/fresh/beverage/dairy/confectionery/frozen/seasoning/supplement/other)",
    "recall_type": "リコール種別(recall/voluntary/alert)",
    "reason": "回収理由(foreign_matter/microbe/allergen/chemical/labeling/quality/other)",
    "risk_level": "リスクレベル(class1/class2/class3/unknown)",
    "affected_area": "対象地域",
    "lot_number": "対象ロット番号/賞味期限等",
    "recall_date": "リコール日(YYYY-MM-DD)",
    "status": "状態(active/completed/investigating)",
    "consumer_action": "消費者への対応",
    "contact_info": "問い合わせ先",
    "health_impact": "健康被害の有無と詳細"
  },
  "summary": "50文字以内の要約",
  "missing_fields": ["取得できなかった項目名の配列"],
  "review_reasons": ["要確認理由の配列"],
  "confidence": 0.8
}
\`\`\``;

export const FOOD_RECALL_USER_PROMPT = `以下のリコール情報ページの内容から、構造化された情報を抽出してください。

ページ内容:
{{CONTENT}}`;

export const SHITEI_SYSTEM_PROMPT = `あなたは自治体の指定管理者公募情報の構造化抽出アシスタントです。
与えられた公募情報ページのテキストから、以下の項目を正確に抽出してJSON形式で返してください。

出力形式:
\`\`\`json
{
  "data": {
    "title": "案件名/公募名称",
    "municipality_name": "自治体名",
    "facility_name": "施設名",
    "facility_category": "施設種別(sports/culture/welfare/park/housing/education/community/tourism/waste/other)",
    "application_start_date": "公募開始日(YYYY-MM-DD)",
    "application_deadline": "応募期限(YYYY-MM-DD)",
    "opening_date": "説明会日(YYYY-MM-DD)",
    "contract_start_date": "契約開始日(YYYY-MM-DD)",
    "contract_end_date": "契約終了日(YYYY-MM-DD)",
    "eligibility": "応募資格",
    "application_method": "応募方法/提出方法",
    "contact_info": "問い合わせ先"
  },
  "summary": "50文字以内の要約",
  "missing_fields": ["取得できなかった項目名の配列"],
  "review_reasons": ["要確認理由の配列"],
  "confidence": 0.8
}
\`\`\``;

export const SHITEI_USER_PROMPT = `以下の自治体公募情報ページの内容から、構造化された情報を抽出してください。

ページ内容:
{{CONTENT}}`;
