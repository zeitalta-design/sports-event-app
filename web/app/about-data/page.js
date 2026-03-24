import Link from "next/link";

export const metadata = {
  title: "データについて",
  description: "スポログで掲載しているデータの出典・更新方針について。",
};

export default function AboutDataPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">スポログのデータについて</h1>
      <p className="text-xs text-gray-400 mb-8">掲載データの出典・更新方針</p>

      <div className="prose-custom space-y-8">
        <section>
          <h2>掲載データの出典</h2>
          <p>
            本サービスに掲載されている大会情報は、以下の外部サイトで公開されている情報をもとに
            整理・構成しています。
          </p>
          <ul>
            <li>
              <strong>RUNNET</strong>（ランネット） — 大会基本情報、種目、参加費、定員、スケジュール等
            </li>
            <li>
              <strong>moshicom</strong>（モシコム） — 一部大会の補完情報（種目詳細等）
            </li>
          </ul>
          <p>
            各大会の詳細ページには、データの出典元を明記しています。
          </p>
        </section>

        <section>
          <h2>スポログの役割</h2>
          <p>
            スポログは外部公開情報をもとに大会を整理し、<strong>検索・比較・通知</strong>を支援するサービスです。
            大会の主催者ではなく、エントリー（申込）の受付も行っていません。
          </p>
          <p>
            大会への参加をご検討の際は、必ず掲載元サイトまたは大会公式サイトにて
            最新の申込条件・参加費・締切日等をご確認ください。
          </p>
        </section>

        <section>
          <h2>データの更新について</h2>
          <p>
            掲載データは定期的に更新していますが、リアルタイムでの更新を保証するものではありません。
            以下の点にご注意ください。
          </p>
          <ul>
            <li>大会の中止・延期・内容変更が反映されるまで時間がかかる場合があります</li>
            <li>参加費や定員の変更がリアルタイムに反映されない場合があります</li>
            <li>エントリー状況（受付中/締切等）は目安であり、正確な状況は掲載元でご確認ください</li>
          </ul>
        </section>

        <section>
          <h2>情報の修正・削除のご依頼</h2>
          <p>
            掲載情報に誤りがある場合、または情報の削除をご希望の場合は、
            お問い合わせ先までご連絡ください。確認の上、速やかに対応いたします。
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
