import OpsSidebar from "@/components/admin/OpsSidebar";

export const metadata = {
  title: "運営管理",
  robots: { index: false, follow: false },
};

/**
 * Phase228: 運営管理画面レイアウト
 * サイドバー + メインコンテンツの2カラム構成
 * 既存AdminGuardの配下で動作（app/admin/layout.jsで認証済み）
 */
export default function OpsLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50 -mt-[1px]">
      <OpsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
