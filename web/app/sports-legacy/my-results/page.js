import { siteConfig } from "@/lib/site-config";
import MyResultsPage from "@/components/MyResultsPage";

/**
 * Phase151: My Results ページ
 * /my-results
 *
 * ログインユーザーの個人結果履歴・PB表示。
 * robots: noindex — 個人ページのため検索エンジンに非公開。
 */

export const metadata = {
  title: `My Results — 自分の大会記録 | ${siteConfig.siteName}`,
  description: "紐付けた大会結果の一覧、自己ベスト、成長推移を確認できます。",
  robots: { index: false, follow: false },
};

export default function MyResultsPageWrapper() {
  return <MyResultsPage />;
}
