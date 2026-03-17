/**
 * サービス・設備情報セクション
 *
 * services_json 形式:
 * [{ name: "荷物預かり", available: true, note: "無料" }, ...]
 *
 * parking_info: 駐車場情報テキスト
 */

const SERVICE_ICONS = {
  "荷物預かり": "🎒",
  "更衣室": "👔",
  "シャワー": "🚿",
  "駐車場": "🅿️",
  "給水所": "💧",
  "給食": "🍌",
  "記録証": "📄",
  "完走証": "🏅",
  "完走メダル": "🏅",
  "保険": "🛡️",
  "救護所": "🏥",
  "トイレ": "🚻",
  "手荷物預かり": "🎒",
  "参加賞": "🎁",
  "ペーサー": "🏃",
  "計測チップ": "⏱️",
  "チップ計測": "⏱️",
};

function getIcon(name) {
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (name.includes(key)) return icon;
  }
  return "✅";
}

export default function MarathonDetailServices({ services, parkingInfo }) {
  const hasServices = services && services.length > 0;
  const hasParking = parkingInfo && parkingInfo.trim().length > 0;

  if (!hasServices && !hasParking) return null;

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        サービス・設備
      </h2>

      {hasServices && (
        <div className="flex flex-wrap gap-2 mb-4">
          {services.map((s, i) => {
            const isAvailable = s.available !== false;
            const icon = getIcon(s.name);

            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border ${
                  isAvailable
                    ? "bg-green-50 text-green-800 border-green-200"
                    : "bg-gray-50 text-gray-400 border-gray-200 line-through"
                }`}
                title={s.note || undefined}
              >
                <span>{icon}</span>
                <span>{s.name}</span>
                {s.note && isAvailable && (
                  <span className="text-xs text-green-600">({s.note})</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {hasParking && (
        <div className="text-sm">
          <dt className="text-gray-700 text-sm mb-1 font-bold">🅿️ 駐車場</dt>
          <dd className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {parkingInfo}
          </dd>
        </div>
      )}
    </div>
  );
}
