import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-white font-bold">大会ナビ</span>
              <span className="ml-2 text-sm">スポーツ大会検索・通知サービス</span>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <Link href="/terms" className="hover:text-white transition-colors">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                プライバシーポリシー
              </Link>
              <Link href="/about-data" className="hover:text-white transition-colors">
                データについて
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                お問い合わせ
              </Link>
            </nav>
          </div>
          <p className="text-xs text-gray-500">&copy; 2026 大会ナビ (TaikaiNavi). All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
