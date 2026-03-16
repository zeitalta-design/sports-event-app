import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        ページが見つかりません
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          トップページへ
        </Link>
        <Link href="/marathon" className="btn-secondary">
          マラソン大会を探す
        </Link>
      </div>
    </div>
  );
}
