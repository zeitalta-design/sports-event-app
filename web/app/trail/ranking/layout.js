import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "人気のトレイルラン大会ランキング",
  description: "直近30日で注目されている全国のトレイルランニング大会をランキング形式で掲載。閲覧数・お気に入り・エントリークリック数から算出した人気指数で順位を決定しています。",
  openGraph: {
    title: `人気のトレイルラン大会ランキング | ${siteConfig.siteName}`,
    description: "注目のトレイルラン大会を人気順にランキング。初めてのトレイル探しにもおすすめです。",
    type: "website",
  },
};

export default function TrailRankingLayout({ children }) {
  return children;
}
