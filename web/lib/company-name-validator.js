/**
 * 企業名（事業者名）として妥当か判定するバリデータ。
 *
 * 行政処分・産廃・許認可など、HTML/PDF パースで企業名を抽出する際に、
 * テーブルヘッダー・申請書類の見出し・役所名・日付などが誤抽出される
 * ことがあるため、明らかに事業者名でないものを共通ロジックで除外する。
 */

/**
 * 企業名として明らかに不適切なデータを検出。
 * @param {string} name
 * @returns {string|null} スキップ理由（不適切時）または null（OK）
 */
export function shouldSkipAsCompanyName(name) {
  if (!name || typeof name !== "string") return "empty";
  const s = name.trim();
  if (s.length < 2) return "too-short";
  if (s.length > 100) return "too-long-extreme";

  // 短くてあいまいな単語（処分理由の見出し語等の誤抽出）
  const ambiguousShort = new Set([
    "公告", "公示", "事案", "概要", "詳細", "本文", "別紙", "添付", "様式",
    "備考", "頁", "項", "号", "目次", "前項", "後項", "本項", "条文",
    "適用", "留意", "解説", "趣旨", "目的", "上記", "下記", "以上", "以下",
  ]);
  if (s.length <= 4 && ambiguousShort.has(s)) return `ambiguous-short(${s})`;

  // 年月日のみのパターン
  if (/^令和\d+年\d+月?\d*日?$/.test(s)) return "date-only";
  if (/^平成\d+年\d+月?\d*日?$/.test(s)) return "date-only";
  if (/^\d{4}年\d+月\d*日?$/.test(s)) return "date-only";
  if (/^\d+年\d+月$/.test(s)) return "date-only";

  // 明らかに非企業名のキーワード
  const nonCompanyKeywords = [
    // 文書見出し系
    "基準", "処分内容", "商号又は名称", "主たる事務所", "主たる営業所",
    "処分年月日", "処分情報", "処分の理由", "処分の内容",
    "監督処分簿", "監督処分の概要", "行政処分一覧", "行政処分情報",
    "違反行為に対する", "不正行為等",
    // 申請書類系（沖縄県・長野県等で誤抽出多発）
    "登録申請書", "誓約書", "身分証明書", "登記されていないことの証明",
    "住民票", "個人番号カード", "合格証書", "登録資格を証する書面",
    "証する書面", "の写し",
    // 役所名（事業者ではない）
    "土木事務所", "建設事務所", "県土マネジメント部", "建築指導課",
    "都市整備局", "整備局", "総合事務所",
    // ナビゲーション・操作系
    "間の日数", "提出期限", "事業所名", "営業所の所在",
    "〇（", "□（",
    // 年度・期間系
    "年度", "期間", "次回", "前回", "今回",
  ];
  for (const kw of nonCompanyKeywords) {
    if (s.includes(kw)) return `non-company-keyword(${kw})`;
  }

  // 長文の典型: 「令和X年Y月Z日, ...」で始まる文章
  if (/令和\d+年\d+月\d+日/.test(s) && s.length > 30) return "description-text";

  // 地域名のみの行（福島県・北海道の支庁一覧が誤抽出されるケース）
  // 「白河市、西白河郡 東白川郡」のような区域列挙は法人格を含まない場合 skip。
  // 「植村建設」のような企業名を誤マッチしないよう、各トークンが
  // 「行政区分で終わる完全な単語」であることを確認（split でチェック）。
  const hasLegalForm = /(株式会社|有限会社|合同会社|合資会社|合名会社|一般財団法人|公益財団法人|社団法人|協同組合|協会|事務所|法人)/.test(s);
  if (!hasLegalForm) {
    const tokens = s.split(/[、,\s・\u3000／\/]+/).filter(Boolean);
    if (tokens.length >= 1 && tokens.every((t) => /^[一-龥]{1,8}(?:市|区|町|村|郡|振興局|支庁|総合振興局)$/.test(t))) {
      return "region-only";
    }
    // 北海道の振興局名単体
    const hokkaidoRegions = ["空知", "石狩", "後志", "胆振", "日高", "渡島", "檜山", "上川", "留萌", "宗谷", "オホーツク", "網走", "十勝", "釧路", "根室"];
    if (hokkaidoRegions.includes(s)) return "hokkaido-region";
  }

  // 法人格や企業名らしい語尾
  const looksLikeCompany = /(株式会社|有限会社|合同会社|合資会社|合名会社|一般財団法人|公益財団法人|社団法人|協同組合|協会|事務所|[(（][株有合]{1}[)）])/.test(s)
    || /(建設|工業|商事|商会|興業|運輸|開発|不動産|設備|電気|住宅|ホーム|宅建|リース|サービス|プランニング|コーポレーション|ホールディングス|グループ|工務店|建築|産業|物産|総業|商店)$/.test(s);

  if (!looksLikeCompany && s.length > 30) return "not-company-like";

  // 個人名らしい短い氏名（姓 名）は許容（産廃などで個人事業主が含まれる）
  // ただし役所っぽい部署名も短いことがあるので、上の keyword check に頼る

  return null;
}

/**
 * 企業名らしさをチェックして、不適切な場合はログに残してフィルタリング。
 * @param {Array} items - { company_name または name フィールドを持つアイテム }
 * @param {function} [logger] 警告ログ関数
 * @param {string} [nameField="company_name"] 名前フィールド名
 * @returns {Array} フィルタ後のアイテム
 */
export function filterValidCompanyItems(items, logger, nameField = "company_name") {
  if (!Array.isArray(items)) return items;
  const filtered = [];
  let skipped = 0;
  for (const item of items) {
    const name = item?.[nameField];
    const reason = shouldSkipAsCompanyName(name);
    if (reason) {
      skipped++;
      if (logger) logger(`  ⊘ skip (${reason}): ${String(name).slice(0, 50)}`);
    } else {
      filtered.push(item);
    }
  }
  if (skipped > 0 && logger) {
    logger(`  → filtered out ${skipped} non-company items`);
  }
  return filtered;
}
