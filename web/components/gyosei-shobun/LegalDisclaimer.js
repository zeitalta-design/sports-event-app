/**
 * 法的免責文言コンポーネント
 *
 * 行政処分DB関連ページの末尾に表示する。
 * mode:
 *   "full"    — 詳細ページ・一覧ページ用（3行）
 *   "compact" — 比較・お気に入り等の軽量版（2行）
 */

export default function LegalDisclaimer({ mode = "full" }) {
  if (mode === "compact") {
    return (
      <div className="mt-8 text-[11px] text-gray-400 leading-relaxed">
        <p>
          ※ 本ページの情報は官公庁の公開情報を基に整理しています。
          最新・正確な情報は各行政機関の公式発表をご確認ください。
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 bg-gray-50 border border-gray-200 rounded-xl p-4 text-[11px] text-gray-400 leading-relaxed space-y-1.5">
      <p>
        <span className="font-medium text-gray-500">情報源について：</span>
        本サイトは国土交通省および各都道府県が公開している行政処分情報を基に整理・提供しています。
      </p>
      <p>
        <span className="font-medium text-gray-500">正確性について：</span>
        データの正確性・完全性を保証するものではありません。最新かつ正確な情報は各行政機関の公式発表を必ずご確認ください。
      </p>
      <p>
        <span className="font-medium text-gray-500">免責事項：</span>
        掲載情報の利用により生じた損害について、当サイトは一切の責任を負いません。
        掲載内容は事実の記載であり、特定の企業・個人を誹謗中傷する意図はありません。
      </p>
    </div>
  );
}
