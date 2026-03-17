/**
 * Phase219: 汎用エラー状態コンポーネント
 *
 * API失敗・ネットワークエラー・認証切れ等で
 * ユーザーに分かりやすいエラー表示 + 再試行導線を提供。
 */

export default function ErrorState({
  title = "データの読み込みに失敗しました",
  description = "通信状態を確認して、もう一度お試しください。",
  onRetry,
  retryLabel = "再読み込み",
  compact = false,
}) {
  return (
    <div className={`text-center ${compact ? "py-6" : "py-12"}`}>
      <div className={`mx-auto ${compact ? "w-10 h-10" : "w-14 h-14"} bg-red-50 rounded-full flex items-center justify-center mb-3`}>
        <svg
          className={`${compact ? "w-5 h-5" : "w-7 h-7"} text-red-400`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h3 className={`${compact ? "text-sm" : "text-base"} font-bold text-gray-800 mb-1`}>
        {title}
      </h3>
      <p className={`${compact ? "text-xs" : "text-sm"} text-gray-600 mb-4`}>
        {description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
