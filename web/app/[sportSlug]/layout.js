import { notFound } from "next/navigation";
import { getSportBySlug, buildSportMetadata } from "@/lib/sport-config";

/**
 * Phase49: 動的スポーツルートのレイアウト
 *
 * /[sportSlug] にマッチするが、/marathon は既存静的ルートが優先される。
 * enabled=false のスポーツは 404。
 * 既知だが無効なスポーツは「準備中」ではなく 404 扱い（方式A）。
 */

export async function generateMetadata({ params }) {
  const { sportSlug } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport || !sport.enabled) return {};
  return buildSportMetadata(sportSlug);
}

export default async function SportLayout({ children, params }) {
  const { sportSlug } = await params;
  const sport = getSportBySlug(sportSlug);

  // 存在しない or enabled=false → 404
  if (!sport || !sport.enabled) {
    notFound();
  }

  return children;
}
