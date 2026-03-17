import Link from "next/link";

/**
 * Phase129: 運営向け情報修正リクエスト導線
 *
 * 大会詳細ページ下部に控えめに表示。
 * 運営者が情報修正フォームにアクセスするための導線。
 */
export default function OrganizerUpdateLink({ eventId, eventTitle }) {
  const params = new URLSearchParams();
  if (eventId) params.set("event_id", String(eventId));
  if (eventTitle) params.set("event_title", eventTitle);
  const href = `/organizers/request-update?${params.toString()}`;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-400 leading-relaxed">
        この大会の運営者・主催者の方へ ―{" "}
        <Link
          href={href}
          className="text-gray-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
        >
          掲載情報の修正・更新はこちら
        </Link>
      </p>
    </div>
  );
}
