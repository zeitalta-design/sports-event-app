/**
 * Phase62: Runner Dashboard ヒーローセクション
 *
 * ランナーへの挨拶 + 検討状況の概要を表示
 */

import Link from "next/link";

export default function RunnerHero({ savedCount, compareCount, alertHighCount }) {
  const hasActivity = savedCount > 0 || compareCount > 0;

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">
            🏃 Runner Dashboard
          </h1>
          <p className="text-blue-100 text-sm sm:text-base">
            {hasActivity
              ? "あなたの大会選びをサポートします"
              : "次の大会を見つけましょう"}
          </p>
        </div>
        {alertHighCount > 0 && (
          <Link
            href="/alerts"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            要確認 {alertHighCount}件
          </Link>
        )}
      </div>

      {/* サマリーカード */}
      {hasActivity && (
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Link href="/saved" className="bg-white/15 hover:bg-white/20 backdrop-blur-sm rounded-xl p-3 transition-colors text-center">
            <div className="text-2xl font-bold">{savedCount}</div>
            <div className="text-xs text-blue-100 mt-0.5">保存中</div>
          </Link>
          <Link href="/compare" className="bg-white/15 hover:bg-white/20 backdrop-blur-sm rounded-xl p-3 transition-colors text-center">
            <div className="text-2xl font-bold">{compareCount}</div>
            <div className="text-xs text-blue-100 mt-0.5">比較中</div>
          </Link>
          <Link href="/alerts" className="bg-white/15 hover:bg-white/20 backdrop-blur-sm rounded-xl p-3 transition-colors text-center">
            <div className="text-2xl font-bold">{alertHighCount}</div>
            <div className="text-xs text-blue-100 mt-0.5">要確認</div>
          </Link>
        </div>
      )}
    </div>
  );
}
