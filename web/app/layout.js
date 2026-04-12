import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import CompareBar from "@/components/CompareBar";
import DataTrackInit from "@/components/DataTrackInit";
import { siteConfig } from "@/lib/site-config";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: `${siteConfig.siteName} | ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.siteName}`,
  },
  description: siteConfig.siteDescription,
  openGraph: {
    siteName: siteConfig.siteName,
    locale: "ja_JP",
    type: "website",
    title: `${siteConfig.siteName} | ${siteConfig.tagline}`,
    description: siteConfig.siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.siteName} | ${siteConfig.tagline}`,
    description: siteConfig.siteDescription,
  },
  alternates: {
    canonical: siteConfig.siteUrl,
  },
};

// 構造化データ（JSON-LD）
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteConfig.siteUrl}/#website`,
      name: siteConfig.siteName,
      alternateName: siteConfig.siteNameEn,
      url: siteConfig.siteUrl,
      description: siteConfig.siteDescription,
      inLanguage: "ja",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteConfig.siteUrl}/gyosei-shobun?keyword={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${siteConfig.siteUrl}/#organization`,
      name: siteConfig.siteName,
      alternateName: siteConfig.siteNameEn,
      url: siteConfig.siteUrl,
      description: "企業リスク監視プラットフォーム。行政処分・入札情報・補助金・許認可などのビジネスデータを横断検索できるサービス。",
      foundingDate: "2024",
      sameAs: [],
      knowsAbout: [
        "行政処分", "企業リスク管理", "取引先審査", "入札情報", "補助金", "許認可",
        "建設業", "不動産業", "廃棄物処理業", "コンプライアンス",
      ],
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} antialiased min-h-screen flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Analytics />
        <DataTrackInit />
        <Header />
        <main className="flex-1 pb-14">{children}</main>
        <Footer />
        <CompareBar />
      </body>
    </html>
  );
}
