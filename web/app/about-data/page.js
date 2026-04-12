import Link from "next/link";

export const metadata = {
  title: "データについて",
  description:
    "Risk Monitorの掲載情報の取り扱い・データ利用に関する禁止事項・修正削除のご連絡について。",
};

export default function AboutDataPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        データについて
      </h1>
      <p className="text-xs text-gray-400 mb-8">最終更新日: 2026年4月13日</p>

      <div className="prose-custom space-y-8">
        <section>
          <p>
            Risk Monitorは、官公庁・地方自治体が公開している行政処分情報、産廃処分情報、入札情報、補助金情報、許認可情報等を整理・可視化し、
            企業リスクを監視するための情報提供プラットフォームです。
          </p>
        </section>

        <section>
          <h2>サービスの位置づけ</h2>
          <p>
            Risk Monitorは公開情報を収集・整理・分析して提供する<strong>第三者サービス</strong>です。
          </p>
          <p>
            官公庁や行政機関の公式発表を代行するものではなく、また行政機関と提携・代理関係にあるものではありません。
          </p>
          <p>
            本サービスに掲載されている情報は参考情報として提供しており、<strong>法的効力や公式性を有するものではありません</strong>。
          </p>
          <p>
            重要な判断（取引、契約、投資、コンプライアンス対応等）を行う際は、
            必ず各行政機関の公式発表・公文書にて最新情報をご確認ください。
          </p>
        </section>

        <section>
          <h2>掲載情報の取り扱い</h2>
          <ul>
            <li>掲載情報は、公開情報源から取得・整理したものです。</li>
            <li>情報取得から反映までに時間差が生じる場合があります。</li>
            <li>行政機関による情報訂正・削除・非公開化により、掲載内容と実際の情報に差異が生じる可能性があります。</li>
            <li>
              特に処分内容、日付、対象企業、金額等の重要事項については、
              <strong>各行政機関の公式サイトや公文書で必ずご確認</strong>ください。
            </li>
          </ul>
          <p className="mt-3 text-sm text-gray-500">
            掲載情報に基づく判断・行動により生じた損害について、Risk Monitor運営者は一切の責任を負いません。
          </p>
        </section>

        <section>
          <h2>データ利用に関する禁止事項（重要）</h2>
          <p>
            Risk Monitorに掲載されているすべての情報（テキスト、データ、表、グラフ、ランキング、評価指標等）
            および本サービスのコンテンツについて、以下の行為を<strong>固く禁止</strong>します。
          </p>
          <ol className="list-decimal pl-5 space-y-3 mt-3">
            <li>
              <strong>スクレイピング・クローリング</strong>
              <br />
              <span className="text-gray-600">
                Bot、クローラー、スクレイピングツール等を用いた自動的なデータ収集行為
              </span>
            </li>
            <li>
              <strong>大量アクセス・巡回行為</strong>
              <br />
              <span className="text-gray-600">
                本サービスに対して過度なアクセスや定期的な巡回を行う行為
              </span>
            </li>
            <li>
              <strong>無断転載・複製・二次利用</strong>
              <br />
              <span className="text-gray-600">
                本サービスのデータを無断で複製、転載、再配布、加工、データベース化する行為
              </span>
            </li>
            <li>
              <strong>競合サービスへの利用</strong>
              <br />
              <span className="text-gray-600">
                本サービスのデータを競合するリスク管理サービス、データ販売サービス、AI学習等に利用する行為
              </span>
            </li>
            <li>
              <strong>商業的利用</strong>
              <br />
              <span className="text-gray-600">
                本サービスのデータを用いた有料サービス・コンテンツの提供、または営利目的での利用（事前許諾がない場合）
              </span>
            </li>
          </ol>
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            上記行為を発見した場合、<strong>利用停止・アカウント削除・法的措置</strong>を取る場合があります。
            また、必要に応じてIPアドレス等の情報に基づき、アクセスを制限することがあります。
          </div>
        </section>

        <section>
          <h2>修正・削除のご依頼</h2>
          <p>
            掲載内容に誤りがある場合、または修正・削除をご希望の場合は、
            <Link
              href="/contact"
              className="text-blue-600 hover:text-blue-800"
            >
              お問い合わせフォーム
            </Link>
            よりご連絡ください。内容を確認のうえ、可能な範囲で対応いたします。
          </p>
          <p className="mt-2 text-sm text-gray-500">
            ただし、官公庁が公開している情報そのものの修正・削除依頼については、
            各行政機関へ直接お問い合わせいただくようお願いいたします。
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
        <Link
          href="/terms"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          利用規約 →
        </Link>
        <Link
          href="/privacy"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          プライバシーポリシー →
        </Link>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
