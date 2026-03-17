/**
 * Phase59: 検討時のポイント（判断シグナル）生成ロジック
 *
 * 大会データから「この大会を申し込むかどうか判断する際に
 * 気にすべきポイント」をルールベースで生成する。
 *
 * LLMコスト不要。getMarathonDetailPageData() の戻り値を入力とする。
 *
 * 公開関数:
 *   - buildDecisionSignals(data)  → 個別シグナル配列
 *   - buildDecisionSummary(data)  → まとめ文
 *
 * @module event-decision-signals
 */

import {
  getDaysUntilEvent,
  getDaysUntilDeadline,
} from "./event-detail-highlights";

// ════════════════════════════════════════════════════
//  A. buildDecisionSignals — 個別シグナル生成
// ════════════════════════════════════════════════════

/**
 * 大会データから判断シグナルを生成
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @returns {{ signals: Array<{ key: string, type: "urgent"|"caution"|"info"|"positive", label: string, detail: string }> }}
 */
export function buildDecisionSignals(data) {
  const signals = [];

  // --- 締切系 ---
  const daysDeadline = getDaysUntilDeadline(data);
  if (daysDeadline !== null && data.entry_status === "open") {
    if (daysDeadline <= 3 && daysDeadline >= 0) {
      signals.push({
        key: "deadline_imminent",
        type: "urgent",
        label: "締切間近",
        detail:
          daysDeadline === 0
            ? "本日が申込期限です"
            : `あと${daysDeadline}日で申込が締め切られます`,
      });
    } else if (daysDeadline <= 7) {
      signals.push({
        key: "deadline_soon",
        type: "caution",
        label: "締切まもなく",
        detail: `あと${daysDeadline}日で申込が締め切られます`,
      });
    } else if (daysDeadline <= 14) {
      signals.push({
        key: "deadline_2weeks",
        type: "info",
        label: "締切2週間以内",
        detail: `申込期限まであと${daysDeadline}日です`,
      });
    }
  }

  // 受付終了
  if (data.entry_status === "closed") {
    signals.push({
      key: "entry_closed",
      type: "caution",
      label: "受付終了",
      detail: "この大会のエントリー受付は終了しています",
    });
  }

  // --- 開催日系 ---
  const daysEvent = getDaysUntilEvent(data.event_date);
  if (daysEvent !== null) {
    if (daysEvent < 0) {
      signals.push({
        key: "event_finished",
        type: "caution",
        label: "開催済み",
        detail: "この大会はすでに終了しています",
      });
    } else if (daysEvent <= 7) {
      signals.push({
        key: "event_imminent",
        type: "info",
        label: "開催直前",
        detail:
          daysEvent === 0
            ? "本日開催です"
            : `開催まであと${daysEvent}日です`,
      });
    } else if (daysEvent <= 30) {
      signals.push({
        key: "event_near",
        type: "info",
        label: "開催1ヶ月以内",
        detail: `開催まであと${daysEvent}日です`,
      });
    }
  }

  // --- 中止 ---
  if (data.entry_status === "cancelled") {
    signals.push({
      key: "cancelled",
      type: "urgent",
      label: "中止",
      detail: "この大会は中止が発表されています",
    });
  }

  // --- 定員系 ---
  if (data.capacity_info && /定員|先着/.test(data.capacity_info)) {
    signals.push({
      key: "capacity_limited",
      type: "info",
      label: "定員あり",
      detail: "定員制のため早めの申込がおすすめです",
    });
  }

  // --- 情報鮮度 ---
  if (data.freshness && data.freshness.cautionText) {
    signals.push({
      key: "stale_data",
      type: "caution",
      label: "情報が古い可能性",
      detail: "掲載元で最新情報をご確認ください",
    });
  }

  // --- ポジティブ系 ---
  if (data.entry_status === "open") {
    signals.push({
      key: "entry_open",
      type: "positive",
      label: "エントリー受付中",
      detail: "現在、申込を受け付けています",
    });
  }

  // --- Phase143: 口コミ由来シグナル ---
  if (data.reviewSummary && data.reviewSummary.total >= 3) {
    const rs = data.reviewSummary;
    if (rs.avg_beginner && rs.avg_beginner >= 4.0) {
      signals.push({
        key: "beginner_friendly",
        type: "positive",
        label: "初心者に好評",
        detail: "参加者から初心者向けの高評価を得ています",
      });
    }
    if (rs.avg_overall && rs.avg_overall >= 4.5) {
      signals.push({
        key: "highly_rated",
        type: "positive",
        label: "高評価",
        detail: `総合評価 ${rs.avg_overall}（${rs.total}件）`,
      });
    }
    if (rs.avg_access && rs.avg_access < 3.0) {
      signals.push({
        key: "access_note",
        type: "info",
        label: "アクセス注意",
        detail: "移動時間に余裕を持つことをおすすめします",
      });
    }
  }

  // 優先度ソート: urgent > caution > info > positive
  const TYPE_ORDER = { urgent: 0, caution: 1, info: 2, positive: 3 };
  signals.sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)
  );

  return { signals: signals.slice(0, 5) };
}

// ════════════════════════════════════════════════════
//  B. buildDecisionSummary — まとめ文生成
// ════════════════════════════════════════════════════

/**
 * 判断シグナルから1行のまとめ文を生成
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @returns {string|null} まとめ文（シグナルがない場合null）
 */
export function buildDecisionSummary(data) {
  const { signals } = buildDecisionSignals(data);
  if (signals.length === 0) return null;

  // 最も優先度の高いシグナルから要約
  const top = signals[0];

  if (top.key === "cancelled") {
    return "この大会は中止が発表されています。代わりの大会を探すことをおすすめします。";
  }
  if (top.key === "event_finished") {
    return "この大会はすでに終了しています。次回大会や類似大会をご検討ください。";
  }
  if (top.key === "entry_closed") {
    return "エントリー受付は終了しています。類似大会をチェックしてみてください。";
  }
  if (top.key === "deadline_imminent") {
    const daysDeadline = getDaysUntilDeadline(data);
    return daysDeadline === 0
      ? "本日が申込期限です。参加を検討中なら今すぐご確認ください。"
      : `申込締切まであと${daysDeadline}日です。お早めにご検討ください。`;
  }
  if (top.key === "deadline_soon") {
    const daysDeadline = getDaysUntilDeadline(data);
    return `申込締切まであと${daysDeadline}日です。参加予定の方はお早めに。`;
  }

  // entry_open がトップの場合（ポジティブ）
  if (top.key === "entry_open") {
    return "現在エントリー受付中です。";
  }

  return null;
}
