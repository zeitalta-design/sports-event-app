/**
 * 相互検証の矛盾バッジ（一覧カード / 詳細ページ用）
 *
 * conflict_level に応じて表示を切り替える。
 * level 3: 情報に差異あり
 * level 2: 要確認
 * level 1: 詳細ページのみ表示
 */

import { getConflictDisplayLabel } from "@/lib/verification-conflict";

/**
 * 一覧カード用の簡潔バッジ
 */
export function ConflictBadge({ level }) {
  const label = getConflictDisplayLabel(level);
  if (!label || !label.showInList) return null;

  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${label.className}`}>
      {label.text}
    </span>
  );
}

/**
 * 詳細ページ用の注意バナー
 */
export function ConflictDetailBanner({ level, summary }) {
  const label = getConflictDisplayLabel(level);
  if (!label) return null;

  return (
    <div className={`rounded-lg border p-4 ${label.className}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg" aria-hidden="true">&#9888;</span>
        <div>
          <p className="font-medium text-sm">{label.text}</p>
          <p className="text-xs mt-1">{label.detail}</p>
          {summary && (
            <p className="text-xs mt-1 opacity-80">{summary}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConflictBadge;
