"use client";

/**
 * ドメイン横断の共通 検索結果カード。
 *
 * 入札/補助金/産廃/許認可/指定管理/行政処分 の一覧ページで共通利用する。
 * 各ドメインで違うのは:
 *   - 先頭アイコン（category → emoji 等）
 *   - 詳細ページへのリンク（basePath + slug）
 *   - 2行目の補足テキスト（organization 相当）
 *   - バッジ行（badges slot で各ドメインが描く）
 *   - お気に入り / 比較ボタン（domain 指定で組み立て）
 *
 * この部分は domain ごとに差分が出るが、
 * 全体の枠（アイコン＋タイトル＋サブ＋要約＋バッジ＋右上ボタン）は共通。
 * カード描画が複数ドメインでコピペされていたのをここに集約する。
 */

import Link from "next/link";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import ProLockedOverlay from "@/components/ProLockedOverlay";
import { useIsPro } from "@/lib/useIsPro";

/**
 * @param {Object} props
 * @param {{ id: number|string, slug: string, title: string, summary?: string|null }} props.item
 * @param {string} props.domainId             - "nyusatsu" | "hojokin" など
 * @param {Object} [props.domain]             - getDomain() の戻り値（お気に入りボタン用）
 * @param {string} props.basePath             - 詳細ページ先頭 e.g. "/hojokin"
 * @param {string|React.ReactNode} [props.icon] - 左のアイコン（未指定なら空枠）
 * @param {string} [props.secondaryText]      - 2行目（発注機関 / 実施機関）
 * @param {(ctx: {item:any}) => React.ReactNode} [props.renderBadges]
 *   バッジ行の描画。カテゴリ/ステータス/金額/締切など domain 固有要素をここで描く。
 * @param {string} [props.hrefQuery]
 *   詳細リンクに追加する query string（? は不要）。Phase J-5: entityId 等の文脈維持用。
 * @param {boolean} [props.lockSummary]
 *   Phase M-Post: true のとき、非 Pro ユーザーに対して summary を ProLockedOverlay (inline)
 *   でボカシ表示する。sanpai 一覧など「概要をリスク要約として見せる」ドメインで使う。
 */
export default function DomainResultCard({
  item,
  domainId,
  domain,
  basePath,
  icon,
  secondaryText,
  renderBadges,
  hrefQuery,
  lockSummary = false,
}) {
  const { isPro } = useIsPro();
  const href = hrefQuery
    ? `${basePath}/${item.slug}?${hrefQuery}`
    : `${basePath}/${item.slug}`;
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link
        href={href}
        className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0"
      >
        {icon ?? null}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">
              {item.title}
            </h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {domain && <DomainFavoriteButton itemId={item.id} domain={domain} />}
            <DomainCompareButton domainId={domainId} itemId={item.id} variant="compact" />
          </div>
        </div>
        {secondaryText && (
          <p className="text-xs text-gray-500 mt-0.5">{secondaryText}</p>
        )}
        {item.summary && (
          lockSummary ? (
            <div className="mt-1">
              <ProLockedOverlay isPro={isPro} variant="inline">
                <p className="text-xs text-gray-600 line-clamp-2">{item.summary}</p>
              </ProLockedOverlay>
            </div>
          ) : (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
          )
        )}
        {renderBadges && renderBadges({ item })}
      </div>
    </div>
  );
}
