import Link from "next/link";

/**
 * Phase152: 大会結果セクション（詳細ページ内導線）
 *
 * 結果ページへのリンクと簡易サマリーを表示。
 */

export default function EventResultsLink({ eventId, eventTitle, resultsPath, resultsSummary }) {
  return (
    <section id="section-results" className="scroll-mt-20">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🏆</span> 大会結果
          </h2>
          <Link
            href={resultsPath}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            結果一覧を見る →
          </Link>
        </div>

        {resultsSummary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{resultsSummary.finisher_count}</p>
              <p className="text-[10px] text-gray-500">完走者</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{resultsSummary.completion_rate}%</p>
              <p className="text-[10px] text-gray-500">完走率</p>
            </div>
            {resultsSummary.fastest_time && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900 tabular-nums">{resultsSummary.fastest_time}</p>
                <p className="text-[10px] text-gray-500">最速タイム</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{resultsSummary.total}</p>
              <p className="text-[10px] text-gray-500">エントリー</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">結果データは現在準備中です。</p>
        )}

        <p className="text-[10px] text-gray-400 mt-3">
          ※ 結果はゼッケン番号で表示されます。個人名は公開されません。
        </p>
      </div>
    </section>
  );
}
