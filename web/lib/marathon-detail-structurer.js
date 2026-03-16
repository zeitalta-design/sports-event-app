/**
 * 大会詳細情報の構造化サービス
 *
 * 外部サイトの大会情報テキストをLLMで構造化JSONに変換する。
 * marathon_details テーブルに直接保存可能な形式で出力。
 *
 * @module marathon-detail-structurer
 */

import { callLlm } from "@/lib/llm-client";

// ─── 文字列フィールド一覧 ────────────────────

const STRING_FIELDS = [
  "tagline",
  "summary",
  "venue_name",
  "venue_address",
  "access_info",
  "application_start_at",
  "application_end_at",
  "registration_start_time",
  "official_url",
  "entry_url",
  "event_scale_label",
  "sports_category",
  "event_type_label",
  "measurement_method",
  "course_info",
  "notes",
  "parking_info",
  "cancellation_policy",
  "organizer_name",
  "organizer_contact_name",
  "organizer_email",
  "organizer_phone",
  "organizer_description",
  // Phase55: 新フィールド
  "registration_requirements_text",
  "health_management_text",
  "terms_text",
  "pledge_text",
  "refund_policy_text",
  "reception_place",
  "reception_time_text",
  "transit_text",
  "race_method_text",
  "cutoff_text",
  "timetable_text",
];

const URL_FIELDS = ["official_url", "entry_url"];

// JSON配列フィールド → 文字列配列型
const SIMPLE_ARRAY_FIELDS = [
  "features_json",
  "payment_methods_json",
  "level_labels_json",
];

// JSON配列フィールド → オブジェクト配列型
const OBJECT_ARRAY_FIELDS = {
  pricing_json: { required: ["name"], optional: ["fee", "note"] },
  schedule_json: { required: ["time"], optional: ["label"] },
  time_limits_json: { required: ["name"], optional: ["limit"] },
  faq_json: { required: ["question", "answer"], optional: [] },
  series_events_json: { required: ["name"], optional: ["url"] },
  services_json: { required: ["name"], optional: ["available", "note"] },
};

const ALL_JSON_FIELDS = [
  ...SIMPLE_ARRAY_FIELDS,
  ...Object.keys(OBJECT_ARRAY_FIELDS),
];

// ─── システムプロンプト ──────────────────────

const SYSTEM_PROMPT = `あなたはスポーツ大会（マラソン・ランニング大会）の情報構造化エキスパートです。

入力されたテキストから大会の詳細情報を抽出し、以下のJSON形式で返してください。

## 厳守ルール
- JSONのみ返すこと。マークダウン、説明文、コードフェンスは一切禁止。
- 元テキストに書かれていない情報は絶対に創作しない。
- 不明・該当なしの項目は null（文字列）または []（配列）で返す。
- 推測しすぎない。明確に読み取れる情報のみ抽出する。
- summaryは元テキストの要約として整理してよいが、存在しない事実を追加しない。
- taglineは大会の特徴を端的に表す一文（15〜40文字程度）。元テキストから読み取れる場合のみ。
- 特徴(features_json)は重複を除去し、簡潔なラベルにする。
- 日付はYYYY-MM-DD形式、時刻はHH:MM形式で返す。

## 出力JSON形式

{
  "tagline": "string または null — 大会のキャッチコピー（15〜40文字）",
  "summary": "string または null — 大会概要（200〜500文字程度）",
  "venue_name": "string または null — 会場名",
  "venue_address": "string または null — 会場住所",
  "access_info": "string または null — アクセス情報（交通手段等）",
  "application_start_at": "string または null — 申込開始日（YYYY-MM-DD）",
  "application_end_at": "string または null — 申込締切日（YYYY-MM-DD）",
  "registration_start_time": "string または null — 受付開始時刻（HH:MM）",
  "official_url": "string または null — 公式サイトURL",
  "entry_url": "string または null — エントリーページURL",
  "event_scale_label": "string または null — 大会規模（例: 大規模, 中規模, 小規模）",
  "sports_category": "string または null — スポーツカテゴリ（例: マラソン, トレイルラン）",
  "event_type_label": "string または null — 大会種別（例: ロードレース, トレイル, ファンラン）",
  "measurement_method": "string または null — 計測方式（例: チップ計測, 手動計測）",
  "course_info": "string または null — コース情報",
  "notes": "string または null — 注意事項",
  "organizer_name": "string または null — 主催者名",
  "organizer_contact_name": "string または null — 担当者名",
  "organizer_email": "string または null — 連絡先メール",
  "organizer_phone": "string または null — 連絡先電話番号",
  "organizer_description": "string または null — 主催者の説明",
  "features_json": ["string"] — 大会の特徴ラベル配列（例: ["日本陸連公認", "ペーサーあり", "完走メダル"]）,
  "payment_methods_json": ["string"] — 支払方法配列（例: ["クレジットカード", "コンビニ払い"]）,
  "level_labels_json": ["string"] — 対象レベル配列（例: ["初心者向け", "中級者向け"]）,
  "pricing_json": [{"name": "種目名", "fee": "参加費（文字列）", "note": "備考"}],
  "schedule_json": [{"time": "HH:MM", "label": "内容"}],
  "time_limits_json": [{"name": "種目名", "limit": "制限時間（例: 6時間）"}],
  "faq_json": [{"question": "質問", "answer": "回答"}],
  "series_events_json": [{"name": "大会名", "url": "URL（あれば）"}],
  "services_json": [{"name": "サービス名", "available": true, "note": "補足"}]
    — 大会で提供されるサービス・設備（例: 荷物預かり, 更衣室, シャワー, 給水所, 記録証, 完走メダル, 保険, 救護所）,
  "parking_info": "string または null — 駐車場情報（台数、料金、注意事項）",
  "cancellation_policy": "string または null — キャンセル・返金規定",
  "registration_requirements_text": "string または null — エントリー要件・参加資格の詳細",
  "health_management_text": "string または null — 健康管理・健康診断に関する注意",
  "terms_text": "string または null — 大会規約",
  "pledge_text": "string または null — 誓約事項",
  "refund_policy_text": "string または null — 返金ポリシー（キャンセルポリシーとは別に記載がある場合）",
  "reception_place": "string または null — 受付場所",
  "reception_time_text": "string または null — 受付時間の説明",
  "transit_text": "string または null — 電車・バスなど公共交通機関のアクセス情報",
  "race_method_text": "string または null — 競技方法（計測方法、ウェーブスタート等）",
  "cutoff_text": "string または null — 関門情報（場所・制限時間）",
  "timetable_text": "string または null — 当日のタイムテーブル（受付、開会式、スタートなど）"
}`;

// ─── メイン関数 ──────────────────────────

/**
 * 大会情報テキストを構造化JSONに変換
 *
 * @param {object} params
 * @param {string} params.text - 元テキスト
 * @param {string} [params.sourceUrl] - ソースURL
 * @param {string} [params.sourceType] - ソース種別 (moshicom/runnet/official/manual)
 * @param {string} [params.marathonName] - 大会名
 * @returns {Promise<{ data: object, validation: object, usage: object, model: string }>}
 */
export async function structureMarathonDetailText({
  text,
  sourceUrl,
  sourceType,
  marathonName,
}) {
  if (!text || text.trim().length === 0) {
    throw new Error("テキストが空です");
  }

  // ユーザープロンプト生成
  const parts = [];
  if (marathonName) parts.push(`大会名: ${marathonName}`);
  if (sourceUrl) parts.push(`ソースURL: ${sourceUrl}`);
  if (sourceType) parts.push(`ソース種別: ${sourceType}`);
  parts.push("");
  parts.push("--- 元テキスト ---");
  parts.push(text.trim());

  const userPrompt = parts.join("\n");

  // LLM呼び出し
  const result = await callLlm({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  // JSON parse
  let parsed;
  try {
    parsed = JSON.parse(result.text);
  } catch (e) {
    // コードフェンスが混入した場合のフォールバック
    const cleaned = result.text
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `LLMの応答をJSONとして解析できませんでした: ${e.message}\n応答の先頭200文字: ${result.text.slice(0, 200)}`
      );
    }
  }

  // 正常化
  const normalized = normalizeStructuredData(parsed, sourceUrl);

  // バリデーション
  const validation = validateStructuredData(normalized);

  return {
    data: normalized,
    validation,
    usage: result.usage,
    model: result.model,
  };
}

// ─── 正常化 ─────────────────────────────

/**
 * 構造化データを正常化
 * - 空文字 → null
 * - 配列の型補正
 * - URL整理
 * - JSON配列はJSON.stringify()で文字列化
 */
function normalizeStructuredData(raw, sourceUrl) {
  const result = {};

  // 文字列フィールド
  for (const field of STRING_FIELDS) {
    let val = raw[field];
    if (val === undefined || val === null || val === "") {
      result[field] = null;
    } else {
      val = String(val).trim();
      result[field] = val.length > 0 ? val : null;
    }
  }

  // URLフィールドの補正
  for (const field of URL_FIELDS) {
    if (result[field] && !result[field].startsWith("http")) {
      result[field] = "https://" + result[field];
    }
  }

  // source_url
  result.source_url = sourceUrl || raw.source_url || null;

  // 文字列配列フィールド
  for (const field of SIMPLE_ARRAY_FIELDS) {
    let arr = raw[field];
    if (!Array.isArray(arr)) arr = [];
    arr = arr
      .map((v) => (typeof v === "string" ? v.trim() : String(v)))
      .filter((v) => v.length > 0);
    // 重複除去
    arr = [...new Set(arr)];
    result[field] = JSON.stringify(arr);
  }

  // オブジェクト配列フィールド
  for (const [field, schema] of Object.entries(OBJECT_ARRAY_FIELDS)) {
    let arr = raw[field];
    if (!Array.isArray(arr)) arr = [];

    arr = arr
      .filter((item) => {
        if (!item || typeof item !== "object") return false;
        // 必須フィールドが全て空でないか確認
        return schema.required.some((key) => {
          const val = item[key];
          return val !== undefined && val !== null && String(val).trim() !== "";
        });
      })
      .map((item) => {
        const cleaned = {};
        for (const key of [...schema.required, ...schema.optional]) {
          let val = item[key];
          if (val === undefined || val === null) {
            cleaned[key] = "";
          } else {
            cleaned[key] = String(val).trim();
          }
        }
        return cleaned;
      });

    result[field] = JSON.stringify(arr);
  }

  return result;
}

// ─── バリデーション ──────────────────────

/**
 * 構造化データのバリデーション
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateStructuredData(data) {
  const errors = [];
  const warnings = [];

  // JSON配列フィールドのparse確認
  for (const field of ALL_JSON_FIELDS) {
    const val = data[field];
    if (val) {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) {
          errors.push(`${field}: 配列ではありません`);
        }
      } catch {
        errors.push(`${field}: JSONの形式が不正です`);
      }
    }
  }

  // pricing_json の各要素チェック
  if (data.pricing_json) {
    try {
      const pricing = JSON.parse(data.pricing_json);
      for (let i = 0; i < pricing.length; i++) {
        if (!pricing[i].name) {
          warnings.push(`pricing_json[${i}]: 種目名(name)が空です`);
        }
      }
    } catch {
      // already caught above
    }
  }

  // faq_json の各要素チェック
  if (data.faq_json) {
    try {
      const faq = JSON.parse(data.faq_json);
      for (let i = 0; i < faq.length; i++) {
        if (!faq[i].question || !faq[i].answer) {
          warnings.push(
            `faq_json[${i}]: 質問または回答が空です`
          );
        }
      }
    } catch {
      // already caught above
    }
  }

  // URLフィールドの簡易チェック
  for (const field of URL_FIELDS) {
    const val = data[field];
    if (val && !val.startsWith("http")) {
      warnings.push(`${field}: URL形式ではない可能性があります (${val})`);
    }
  }

  // summary の長さチェック
  if (data.summary && data.summary.length > 2000) {
    warnings.push(
      `summary: ${data.summary.length}文字あります。長すぎる可能性があります`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
