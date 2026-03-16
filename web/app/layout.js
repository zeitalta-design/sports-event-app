import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import CompareBar from "@/components/CompareBar";
import { siteConfig } from "@/lib/site-config";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: `${siteConfig.siteName} | 全国のスポーツ大会を探す`,
    template: `%s | ${siteConfig.siteName}`,
  },
  description: "大会ナビは、全国のスポーツ大会を検索・比較・通知できるサービスです。まずはマラソン大会検索に対応。",
  openGraph: {
    siteName: siteConfig.siteName,
    locale: "ja_JP",
    type: "website",
    title: `${siteConfig.siteName} | 全国のスポーツ大会を探す`,
    description: "全国のマラソン大会を検索・比較・通知。締切間近の大会もすぐ見つかる。",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.siteName} | 全国のスポーツ大会を探す`,
    description: "全国のマラソン大会を検索・比較・通知。締切間近の大会もすぐ見つかる。",
  },
  alternates: {
    canonical: siteConfig.siteUrl,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <Analytics />
        <Header />
        <main className="flex-1 pb-14">{children}</main>
        <Footer />
        <CompareBar />
      </body>
    </html>
  );
}
