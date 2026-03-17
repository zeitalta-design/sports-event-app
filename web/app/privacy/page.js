import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー",
  description: "スポ活（スポーツ大会検索・通知サービス）のプライバシーポリシーです。",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
      <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年3月15日</p>

      <div className="prose-custom space-y-8">
        <section>
          <h2>1. 取得する情報</h2>
          <p>本サービスでは、以下の情報を取得・保存します。</p>
          <ul>
            <li><strong>アカウント情報</strong>: メールアドレス、ユーザー名、パスワード（暗号化して保存）</li>
            <li><strong>お気に入り情報</strong>: お気に入り登録した大会の情報</li>
            <li><strong>保存検索条件</strong>: 保存した検索条件（種目、地域、距離等）</li>
            <li><strong>通知設定</strong>: 通知の受信設定（締切通知の有効/無効等）</li>
            <li><strong>セッション情報</strong>: ログイン状態を維持するためのセッションデータ</li>
          </ul>
        </section>

        <section>
          <h2>2. 利用目的</h2>
          <p>取得した情報は、以下の目的で利用します。</p>
          <ul>
            <li>ユーザー認証およびログイン状態の管理</li>
            <li>大会締切通知・保存検索一致通知の送信</li>
            <li>お気に入り機能・保存検索機能の提供</li>
            <li>サービスの改善・品質向上</li>
          </ul>
        </section>

        <section>
          <h2>3. 情報の外部送信</h2>
          <p>
            通知メールの送信にあたり、メール送信サービスを利用する場合があります。
            この場合、送信先メールアドレスおよびメール本文がメール送信サービスに提供されます。
          </p>
          <p>
            上記以外の目的で、ユーザーの個人情報を第三者に提供することはありません。
            ただし、法令に基づく場合を除きます。
          </p>
        </section>

        <section>
          <h2>4. Cookie・セッションの利用</h2>
          <p>
            本サービスでは、ログイン状態の維持のためにCookie（セッションCookie）を使用しています。
            Cookieを無効にした場合、ログイン機能など一部の機能がご利用いただけなくなります。
          </p>
          <p>
            アクセス解析やトラッキング目的のCookieは、現時点では使用していません。
            将来導入する場合は、本ポリシーを更新してお知らせします。
          </p>
        </section>

        <section>
          <h2>5. 情報の管理・安全対策</h2>
          <p>
            取得した個人情報は、不正アクセス・漏洩・紛失等を防止するため、
            適切な安全管理措置を講じます。
            パスワードは暗号化して保存し、平文での保存は行いません。
          </p>
        </section>

        <section>
          <h2>6. 情報の削除</h2>
          <p>
            アカウントの削除をご希望の場合は、お問い合わせ先までご連絡ください。
            アカウントに関連するすべてのデータを削除いたします。
          </p>
        </section>

        <section>
          <h2>7. ポリシーの変更</h2>
          <p>
            本ポリシーは、必要に応じて変更される場合があります。
            重要な変更がある場合は、本サービス上でお知らせします。
          </p>
        </section>

        <section>
          <h2>8. お問い合わせ</h2>
          <p>
            本ポリシーに関するお問い合わせは、以下までご連絡ください。
          </p>
          <p className="text-gray-600">
            メール: <a href="mailto:contact@example.com" className="text-blue-600 hover:text-blue-800">contact@example.com</a>
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
