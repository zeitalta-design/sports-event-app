/**
 * Phase205: 大会タグバッジ表示
 */

export default function EventTagBadges({ tags = [], compact = false }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1" data-track="event_tags_view">
      {tags.map((tag) => (
        <span
          key={tag.value}
          className={`inline-flex items-center gap-0.5 border rounded-full ${tag.color || "bg-gray-50 text-gray-600 border-gray-200"} ${
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
          }`}
        >
          {!compact && <span>{tag.icon}</span>}
          {tag.label}
        </span>
      ))}
    </div>
  );
}
