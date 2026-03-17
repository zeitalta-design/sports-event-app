/**
 * FAQ / 注意事項セクション
 *
 * faq_json 形式:
 * [{ question: "ゼッケンの受取方法は？", answer: "当日会場で受け取れます。" }, ...]
 *
 * Phase 26: 質問テキスト拡大・アコーディオン改善
 */
export default function MarathonDetailFaq({ faq }) {
  if (!faq || faq.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Q&A・注意事項
      </h2>
      <div className="space-y-1">
        {faq.map((item, i) => (
          <details
            key={i}
            className="group border-b border-gray-100 last:border-b-0"
          >
            <summary className="flex items-start gap-3 cursor-pointer text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors py-3">
              <span className="text-blue-500 shrink-0 mt-0.5 text-sm font-bold">
                Q
              </span>
              <span className="leading-relaxed">{item.question}</span>
            </summary>
            <div className="ml-7 mb-4 text-sm text-gray-700 leading-[1.8] whitespace-pre-wrap">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
