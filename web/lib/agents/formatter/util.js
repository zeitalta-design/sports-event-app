/**
 * Formatter 共通ユーティリティ
 * 複数 formatter で使う最低限のヘルパーのみ。
 */

/**
 * "2026-04-14T00:00:00+09:00" → "2026-04-14"
 * "2026(令和8)年4月14日"       → "2026-04-14"
 * "令和8年4月14日"             → "2026-04-14"
 * "平成30年4月14日"            → "2018-04-14"
 * "2026/4/14" or "2026-4-14"   → "2026-04-14"
 * 判定不能なら null
 */
export function toIsoDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // ISO8601（タイムゾーン付き含む） — 先頭の YYYY-MM-DD だけ取る
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 令和括弧付き: "2026(令和8)年4月14日"
  const seirekiInParen = s.match(/^(\d{4})\s*\([^)]+\)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
  if (seirekiInParen) {
    const [, y, m, d] = seirekiInParen;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 令和X年Y月Z日 → 2018 + X
  const reiwa = s.match(/令和\s*(\d+|元)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
  if (reiwa) {
    const y = 2018 + (reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10));
    return `${y}-${reiwa[2].padStart(2, "0")}-${reiwa[3].padStart(2, "0")}`;
  }

  // 平成X年Y月Z日 → 1988 + X
  const heisei = s.match(/平成\s*(\d+|元)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
  if (heisei) {
    const y = 1988 + (heisei[1] === "元" ? 1 : parseInt(heisei[1], 10));
    return `${y}-${heisei[2].padStart(2, "0")}-${heisei[3].padStart(2, "0")}`;
  }

  // YYYY年MM月DD日 / YYYY/MM/DD / YYYY-MM-DD (区切り緩め)
  const seireki = s.match(/^(\d{4})\s*[年／/.\-]\s*(\d{1,2})\s*[月／/.\-]\s*(\d{1,2})/);
  if (seireki) {
    const [, y, m, d] = seireki;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/**
 * プロジェクト名末尾の "(146.6KB)" 等のファイルサイズ表記を除去
 */
export function stripFileSizeSuffix(title) {
  if (!title) return null;
  return String(title).replace(/\s*[\(（]\d+(\.\d+)?\s*[KMGkmg][Bb]\s*[\)）]\s*$/, "").trim();
}
