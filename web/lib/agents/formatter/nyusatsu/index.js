/**
 * 入札ドメイン Formatter 登録簿。
 *
 * Collector id ごとに対応する formatter を引ける形にしておく。
 */
import kkjFormat from "./kkj.js";
import cmFormat from "./central-ministries.js";
import ppFormat from "./p-portal-results.js";

/** @type {Record<string, (raw: any) => any>} */
export const NYUSATSU_FORMATTERS = {
  "nyusatsu.kkj": kkjFormat,
  "nyusatsu.central-ministries": cmFormat,
  "nyusatsu.p-portal-results": ppFormat,
};

/**
 * Collector id からこのドメインの formatter を取得
 * @param {string} collectorId
 * @returns {((raw: any) => any) | null}
 */
export function getFormatter(collectorId) {
  return NYUSATSU_FORMATTERS[collectorId] ?? null;
}

export default NYUSATSU_FORMATTERS;
