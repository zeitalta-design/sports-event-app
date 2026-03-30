import Link from "next/link";

const DOMAINS = [
  { key: "yutai", name: "株主優待ナビ", path: "/admin/yutai", icon: "🎁" },
  { key: "hojokin", name: "補助金ナビ", path: "/admin/hojokin", icon: "💰" },
  { key: "nyusatsu", name: "入札ナビ", path: "/admin/nyusatsu", icon: "📋" },
  { key: "minpaku", name: "民泊ナビ", path: "/admin/minpaku", icon: "🏠" },
];

export default function AdminTopPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">管理画面</h1>
      <p className="text-sm text-gray-500 mb-8">ドメイン別のデータ管理</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DOMAINS.map((d) => (
          <Link key={d.key} href={d.path} className="card p-6 hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-3">{d.icon}</div>
            <h2 className="font-bold text-gray-900">{d.name}</h2>
            <p className="text-xs text-gray-500 mt-1">データ管理</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t flex flex-col gap-2">
        <Link href="/admin/watchlist" className="text-sm text-gray-500 hover:text-blue-600 hover:underline">
          👁 ウォッチリスト →
        </Link>
        <Link href="/admin/audit-logs" className="text-sm text-gray-500 hover:text-blue-600 hover:underline">
          📜 監査ログを見る →
        </Link>
      </div>
    </div>
  );
}
