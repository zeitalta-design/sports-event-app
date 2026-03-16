import Link from "next/link";

export const metadata = {
  title: "お問い合わせ",
  robots: { index: false, follow: false },
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">大会ナビへのお問い合わせ</h1>
      <p className="text-sm text-gray-500 mb-8">
        大会ナビに関するご質問・ご要望・掲載情報の修正依頼は、以下までご連絡ください。
      </p>

      <div className="card p-8 text-center">
        <p className="text-sm text-gray-600 mb-4">メールでのお問い合わせ</p>
        <a
          href="mailto:contact@example.com"
          className="text-lg text-blue-600 hover:text-blue-800 font-medium"
        >
          contact@example.com
        </a>
        <p className="text-xs text-gray-400 mt-4">
          通常2〜3営業日以内にご返信いたします。
        </p>
      </div>

      <div className="mt-8 space-y-3 text-sm text-gray-500">
        <p>以下のようなお問い合わせにお応えしています:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>掲載情報の誤り・修正のご依頼</li>
          <li>掲載情報の削除のご依頼</li>
          <li>サービスに関するご質問</li>
          <li>アカウントの削除のご依頼</li>
          <li>その他ご要望・ご意見</li>
        </ul>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
