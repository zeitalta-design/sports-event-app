/**
 * Phase102: アラート既読/ピン管理
 *
 * localStorageベースでアラートの既読・ピン留め状態を管理。
 */

const STORAGE_KEY = "taikai_alerts_state";

function _getState() {
  if (typeof window === "undefined") return { read: [], pinned: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { read: [], pinned: [] };
    const parsed = JSON.parse(raw);
    return {
      read: Array.isArray(parsed.read) ? parsed.read : [],
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
    };
  } catch {
    return { read: [], pinned: [] };
  }
}

function _save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function _dispatch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("alerts-state-change"));
}

// ─── 既読 ────────────────────────────────────

export function markAlertRead(eventId) {
  const state = _getState();
  if (!state.read.includes(eventId)) {
    state.read.push(eventId);
    _save(state);
    _dispatch();
  }
}

export function isAlertRead(eventId) {
  return _getState().read.includes(eventId);
}

export function getReadCount() {
  return _getState().read.length;
}

// ─── ピン留め ────────────────────────────────

export function toggleAlertPin(eventId) {
  const state = _getState();
  const idx = state.pinned.indexOf(eventId);
  if (idx >= 0) {
    state.pinned.splice(idx, 1);
    _save(state);
    _dispatch();
    return false;
  } else {
    state.pinned.push(eventId);
    _save(state);
    _dispatch();
    return true;
  }
}

export function isAlertPinned(eventId) {
  return _getState().pinned.includes(eventId);
}

export function getPinnedIds() {
  return _getState().pinned;
}

export function getPinnedCount() {
  return _getState().pinned.length;
}
