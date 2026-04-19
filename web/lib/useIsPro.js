"use client";

/**
 * useIsPro — 現在ユーザーの is_pro 状態を取得する client hook（Phase M-Post）
 *
 * 行政処分スコアのボカシ制御など「Pro 限定の UI ゲート」を
 * call site ごとに fetch しないよう、module-level cache を共有する。
 *
 * 戻り値:
 *   { isPro: boolean | null, loading: boolean }
 *   - null = 判定前 (fetch 中)。UI 側は「とりあえず locked 見せる」戦略を推奨
 *
 * 実装メモ:
 *   - /api/auth を 1 度だけ叩き、tab 内で共有
 *   - subscribe/unsubscribe で複数 component が同時 mount しても fetch は 1 回
 *   - login/logout 等で DOM reload が走れば cache も自然に捨てられる
 */
import { useEffect, useState } from "react";

let _cache = null; // { isPro, loading }
let _inflight = null;
const _subscribers = new Set();

function notify() {
  for (const fn of _subscribers) fn(_cache);
}

function fetchOnce() {
  if (_inflight) return _inflight;
  _inflight = fetch("/api/auth")
    .then((r) => (r.ok ? r.json() : { user: null }))
    .then((d) => {
      _cache = { isPro: !!d?.user?.isPro, loading: false };
      notify();
    })
    .catch(() => {
      _cache = { isPro: false, loading: false };
      notify();
    });
  return _inflight;
}

export function useIsPro() {
  const [state, setState] = useState(
    _cache || { isPro: null, loading: true },
  );

  useEffect(() => {
    if (_cache) {
      setState(_cache);
    } else {
      _subscribers.add(setState);
      fetchOnce();
    }
    return () => _subscribers.delete(setState);
  }, []);

  return state;
}
