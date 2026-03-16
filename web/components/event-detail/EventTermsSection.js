/**
 * Phase55: 規約・注意事項セクション
 *
 * 複数の長文フィールドをアコーディオンで整理して表示。
 * 全フィールドが null/空なら非表示。
 */
export default function EventTermsSection({
  cancellationPolicy,
  notes,
  termsText,
  pledgeText,
  refundPolicyText,
  registrationRequirementsText,
  healthManagementText,
}) {
  const sections = [
    { label: "注意事項", content: notes, icon: "⚠️" },
    { label: "エントリー要件", content: registrationRequirementsText, icon: "📋" },
    { label: "健康管理", content: healthManagementText, icon: "🏥" },
    { label: "規約", content: termsText, icon: "📄" },
    { label: "誓約事項", content: pledgeText, icon: "✍️" },
    { label: "キャンセルポリシー", content: cancellationPolicy, icon: "🔄" },
    { label: "返金ポリシー", content: refundPolicyText, icon: "💰" },
  ].filter((s) => s.content);

  if (sections.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">規約・注意事項</h2>
      <div className="space-y-1">
        {sections.map((section, i) => (
          <details
            key={i}
            className="group border-b border-gray-100 last:border-b-0"
            open={i === 0}
          >
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors py-3">
              <span className="shrink-0">{section.icon}</span>
              <span className="leading-relaxed">{section.label}</span>
              <span className="ml-auto text-gray-300 group-open:rotate-90 transition-transform text-xs">
                ▶
              </span>
            </summary>
            <div className="ml-7 mb-4 text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {section.content}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
