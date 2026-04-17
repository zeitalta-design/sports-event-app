/**
 * Resolver 層 — 企業名正規化（純関数）
 *
 * 目的: 「株式会社アサオ」「㈱アサオ」「(株)アサオ」「ＡＳＡＯ株式会社」等の
 *       表記ゆれを共通キーに寄せて、exact-match で同一判定できるようにする。
 *
 * 出力は「正規化キー」と「canonical 表記」の2種類。
 *   - normalized_key:  DB 照合用。会社形態語や全角/半角を徹底的に揃えた小文字文字列
 *   - canonical_name:  表示用。会社形態語は (株) などに寄せる
 */

/** 会社形態の表記バリエーション → canonical（表示用）の置換表 */
const FORM_CANONICAL = [
  // 株式会社系
  { re: /株式会社/g,              to: "(株)" },
  { re: /[\uFF5F-\uFF60]?（株）/g, to: "(株)" },
  { re: /\(株\)/g,                 to: "(株)" },
  { re: /㈱/g,                     to: "(株)" },
  // 有限会社系
  { re: /有限会社/g, to: "(有)" },
  { re: /（有）/g,   to: "(有)" },
  { re: /\(有\)/g,   to: "(有)" },
  { re: /㈲/g,       to: "(有)" },
  // 合同会社
  { re: /合同会社/g, to: "(合)" },
  { re: /（合）/g,   to: "(合)" },
  { re: /\(合\)/g,   to: "(合)" },
  // 合資会社
  { re: /合資会社/g, to: "(資)" },
  // 合名会社
  { re: /合名会社/g, to: "(名)" },
  // 一般社団・財団
  { re: /一般社団法人/g, to: "(一社)" },
  { re: /一般財団法人/g, to: "(一財)" },
  { re: /公益社団法人/g, to: "(公社)" },
  { re: /公益財団法人/g, to: "(公財)" },
  // 協同組合 / 農協 等はそのまま
];

/** 正規化キー作成時に除去する会社形態マーカー */
const FORM_STRIP = [
  /株式会社/g, /（株）/g, /\(株\)/g, /㈱/g,
  /有限会社/g, /（有）/g, /\(有\)/g, /㈲/g,
  /合同会社/g, /（合）/g, /\(合\)/g,
  /合資会社/g, /合名会社/g,
  /一般社団法人/g, /一般財団法人/g, /公益社団法人/g, /公益財団法人/g,
];

/**
 * 表示用の canonical 名称を返す
 * - 会社形態語を (株)/(有) 等に寄せる
 * - NFKC（全半角統一）、前後空白除去
 *
 * @param {string|null|undefined} name
 * @returns {string|null}
 */
export function canonicalizeCompanyName(name) {
  if (!name) return null;
  let s = String(name);
  try { s = s.normalize("NFKC"); } catch { /* ignore */ }
  for (const { re, to } of FORM_CANONICAL) s = s.replace(re, to);
  s = s.replace(/\s+/g, " ").trim();
  return s || null;
}

/**
 * 照合用の normalized_key を返す
 * - NFKC + 会社形態語の完全除去 + 英字小文字化 + 全空白除去 + 記号除去
 * - 同一判定の粒度はかなり荒め（「(株)A工業」と「A工業株式会社」が同一キーになる）
 *
 * @param {string|null|undefined} name
 * @returns {string|null}
 */
export function normalizeCompanyKey(name) {
  if (!name) return null;
  let s = String(name);
  try { s = s.normalize("NFKC"); } catch { /* ignore */ }

  // 会社形態マーカーを全削除
  for (const re of FORM_STRIP) s = s.replace(re, "");

  // 英字は lowercase
  s = s.toLowerCase();

  // 記号・空白・装飾を削除
  // 区切り系: ・ ｜ ｜ - ー  など
  s = s.replace(/[\s　・\-ー－~〜'"‘’“”()（）\[\]【】<>＜＞,、.。|｜\/\\&＆]/g, "");

  return s || null;
}

/**
 * Levenshtein 距離（編集距離）
 * 両方文字列長 N,M の時 O(N*M) メモリ。日本語社名なら数文字〜数十文字で無害
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  // 1次元 DP で省メモリ
  let prev = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  const curr = new Array(m + 1);
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr[0]] = [curr.slice(), curr[0]];
    // swap: prev ← curr の内容
    for (let j = 0; j <= m; j++) prev[j] = curr[j];
  }
  return prev[m];
}

/**
 * 2つの normalized_key の類似度（0.0〜1.0）
 * 長い方の長さを分母に 1 - (distance / maxLen) で算出
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const d = levenshtein(a, b);
  return Math.max(0, 1 - d / maxLen);
}
