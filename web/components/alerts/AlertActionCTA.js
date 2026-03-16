"use client";

import Link from "next/link";

/**
 * Phase102: アラート種別別アクションCTA
 */

const ACTION_MAP = {
  deadline_imminent:  { label: "今すぐ確認",     useEntryUrl: true, fallbackHref: null },
  deadline_soon:      { label: "確認する",       useEntryUrl: true, fallbackHref: null },
  deadline_passed:    { label: "他の大会を探す",  useEntryUrl: false, fallbackHref: "/marathon" },
  entry_closed:       { label: "他の大会を探す",  useEntryUrl: false, fallbackHref: "/marathon" },
  cancelled:          { label: "他の大会を探す",  useEntryUrl: false, fallbackHref: "/marathon" },
  capacity_limited:   { label: "比較して決める",  useEntryUrl: false, fallbackHref: "/compare" },
  stale_data:         { label: "公式で確認",     useSourceUrl: true, fallbackHref: null },
  event_imminent:     { label: "準備を確認",     useEntryUrl: false, fallbackHref: "/my-events" },
  event_soon:         { label: "準備を確認",     useEntryUrl: false, fallbackHref: "/my-events" },
  event_finished:     { label: "結果を確認",     useEntryUrl: false, fallbackHref: null },
};

export default function AlertActionCTA({ alertType, entryUrl, sourceUrl }) {
  const action = ACTION_MAP[alertType];
  if (!action) return null;

  let href = action.fallbackHref;
  if (action.useEntryUrl && entryUrl) {
    href = entryUrl;
  }
  if (action.useSourceUrl && sourceUrl) {
    href = sourceUrl;
  }
  if (!href) return null;

  const isExternal = href.startsWith("http");

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {action.label}
      {isExternal && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      )}
    </Link>
  );
}
