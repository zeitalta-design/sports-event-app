import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* マラソン SEO導線 */}
          <div>
            <h3 className="text-white font-bold text-sm mb-3">🏃 マラソン大会</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
              <div>
                <h4 className="text-gray-300 font-medium mb-2">距離で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/marathon/distance/full" className="hover:text-white transition-colors">フルマラソン</Link></li>
                  <li><Link href="/marathon/distance/half" className="hover:text-white transition-colors">ハーフマラソン</Link></li>
                  <li><Link href="/marathon/distance/10km" className="hover:text-white transition-colors">10km</Link></li>
                  <li><Link href="/marathon/distance/5km" className="hover:text-white transition-colors">5km以下</Link></li>
                  <li><Link href="/marathon/distance/ultra" className="hover:text-white transition-colors">ウルトラ</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-300 font-medium mb-2">地方で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/marathon/region/kanto" className="hover:text-white transition-colors">関東</Link></li>
                  <li><Link href="/marathon/region/kinki" className="hover:text-white transition-colors">近畿</Link></li>
                  <li><Link href="/marathon/region/chubu" className="hover:text-white transition-colors">中部</Link></li>
                  <li><Link href="/marathon/region/kyushu" className="hover:text-white transition-colors">九州・沖縄</Link></li>
                  <li><Link href="/marathon/region" className="hover:text-white transition-colors">地方別一覧 →</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-300 font-medium mb-2">目的で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/marathon/theme/beginner" className="hover:text-white transition-colors">初心者向け</Link></li>
                  <li><Link href="/marathon/theme/open" className="hover:text-white transition-colors">募集中</Link></li>
                  <li><Link href="/marathon/theme/deadline" className="hover:text-white transition-colors">締切間近</Link></li>
                  <li><Link href="/marathon/theme/popular" className="hover:text-white transition-colors">人気の大会</Link></li>
                  <li><Link href="/marathon/theme" className="hover:text-white transition-colors">テーマ別一覧 →</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-300 font-medium mb-2">季節で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/marathon/season/spring" className="hover:text-white transition-colors">春（3〜5月）</Link></li>
                  <li><Link href="/marathon/season/summer" className="hover:text-white transition-colors">夏（6〜8月）</Link></li>
                  <li><Link href="/marathon/season/autumn" className="hover:text-white transition-colors">秋（9〜11月）</Link></li>
                  <li><Link href="/marathon/season/winter" className="hover:text-white transition-colors">冬（12〜2月）</Link></li>
                  <li><Link href="/marathon/month" className="hover:text-white transition-colors">月別一覧 →</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phase121: トレイルラン SEO導線 */}
          <div>
            <h3 className="text-white font-bold text-sm mb-3">⛰️ トレイルラン大会</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
              <div>
                <h4 className="text-gray-300 font-medium mb-2">距離で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/trail/distance/short" className="hover:text-white transition-colors">ショート（〜20km）</Link></li>
                  <li><Link href="/trail/distance/middle" className="hover:text-white transition-colors">ミドル（20〜50km）</Link></li>
                  <li><Link href="/trail/distance/long" className="hover:text-white transition-colors">ロング（50km〜）</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-300 font-medium mb-2">地方で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/trail/region/kanto" className="hover:text-white transition-colors">関東</Link></li>
                  <li><Link href="/trail/region/chubu" className="hover:text-white transition-colors">中部</Link></li>
                  <li><Link href="/trail/region/kinki" className="hover:text-white transition-colors">近畿</Link></li>
                  <li><Link href="/trail/region" className="hover:text-white transition-colors">地方別一覧 →</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-300 font-medium mb-2">テーマで探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/trail/theme/beginner" className="hover:text-white transition-colors">初心者向け</Link></li>
                  <li><Link href="/trail/theme/open" className="hover:text-white transition-colors">募集中</Link></li>
                  <li><Link href="/trail/theme/scenic" className="hover:text-white transition-colors">絶景コース</Link></li>
                  <li><Link href="/trail/theme" className="hover:text-white transition-colors">テーマ別一覧 →</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-gray-300 font-medium mb-2">季節で探す</h4>
                <ul className="space-y-1">
                  <li><Link href="/trail/season/spring" className="hover:text-white transition-colors">春（3〜5月）</Link></li>
                  <li><Link href="/trail/season/autumn" className="hover:text-white transition-colors">秋（9〜11月）</Link></li>
                  <li><Link href="/trail/ranking" className="hover:text-white transition-colors">人気ランキング</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phase223: 便利な機能リンク */}
          <div>
            <h3 className="text-white font-bold text-sm mb-3">便利な機能</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <Link href="/popular" className="hover:text-white transition-colors">人気ランキング</Link>
              <Link href="/calendar" className="hover:text-white transition-colors">大会カレンダー</Link>
              <Link href="/entry-deadlines" className="hover:text-white transition-colors">締切カレンダー</Link>
              <Link href="/next-race" className="hover:text-white transition-colors">次の大会を探す</Link>
              <Link href="/runner" className="hover:text-white transition-colors">マイページ</Link>
              <Link href="/benefits" className="hover:text-white transition-colors">会員特典</Link>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src={siteConfig.logoImage}
                alt={siteConfig.siteName}
                width={100}
                height={30}
                className="h-7 w-auto brightness-0 invert"
              />
              <span className="text-sm text-gray-300">スポーツ大会検索・通知サービス</span>
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
              <Link href="/organizers" className="hover:text-white transition-colors">
                運営者の方へ
              </Link>
            </nav>
          </div>
          <p className="text-xs text-gray-400">&copy; 2026 スポ活 (SpoKatsu). All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
