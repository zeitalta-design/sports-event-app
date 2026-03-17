import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "お問い合わせ",
  robots: { index: false, follow: false },
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">スポ活へのお問い合わせ</h1>
      <p className="text-sm text-gray-500 mb-8">
        スポ活に関するご質問・ご要望・掲載情報の修正依頼など、お気軽にお問い合わせください。
        通常2〜3営業日以内にご返信いたします。
      </p>

      <ContactForm />

      <div className="mt-12 pt-6 border-t border-gray-200">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          ← トップページに戻る
        </Link>
      </div>
    </div>
  );
}
