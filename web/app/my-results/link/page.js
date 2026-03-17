import { siteConfig } from "@/lib/site-config";
import LinkResultPage from "@/components/LinkResultForm";

/**
 * Phase150: 結果紐付けページ
 * /my-results/link?event_id=X&event_title=Y
 */

export const metadata = {
  title: `結果を紐付ける | ${siteConfig.siteName}`,
  description: "ゼッケン番号を使って、大会結果と自分のアカウントを紐付けます。",
  robots: { index: false, follow: false },
};

export default function LinkResultPageWrapper() {
  return <LinkResultPage />;
}
