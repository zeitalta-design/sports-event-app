import Link from "next/link";
import { getSportCategoryCards } from "@/lib/sport-config";

/**
 * Phase49: SPORT_CONFIGSベースのカテゴリリンク
 *
 * sport-config.js の定義から自動生成。
 * スポーツ追加時はsport-config.jsに1行追加するだけでここにも反映される。
 */
export default function TopCategoryLinks() {
  const categories = getSportCategoryCards();

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-lg font-bold mb-6" style={{ color: "#323433" }}>ジャンルから探す</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const content = (
            <div
              className={`bg-white rounded-xl border border-gray-100 p-5 text-center transition-all
                ${cat.enabled ? "hover:shadow-md hover:border-blue-200 cursor-pointer" : "opacity-50"}`}
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <h3 className="font-bold text-sm" style={{ color: "#323433" }}>{cat.label}</h3>
              <p className="text-[11px] font-medium mt-1" style={{ color: "#323433" }}>{cat.description}</p>
              {!cat.enabled && (
                <span className="inline-block mt-2 text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                  準備中
                </span>
              )}
            </div>
          );

          return cat.enabled ? (
            <Link key={cat.key} href={cat.href}>{content}</Link>
          ) : (
            <div key={cat.key}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}
