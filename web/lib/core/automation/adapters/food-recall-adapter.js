/**
 * food-recall ドメインアダプター — 同期ランナー用
 */

import { normalize } from "@/lib/importers/food-recall";
import { getFoodRecallBySlug, upsertFoodRecallItem } from "@/lib/repositories/food-recall";

export const foodRecallAdapter = {
  domainId: "food-recall",
  entityType: "food_recall_item",
  trackedFields: [
    "product_name", "manufacturer", "category", "recall_type",
    "reason", "risk_level", "affected_area", "lot_number",
    "recall_date", "status", "consumer_action", "summary",
  ],
  normalize,
  findExisting: (slug) => {
    // Admin用: is_published制限なしで検索
    const { getDb } = require("@/lib/db");
    const db = getDb();
    return db.prepare("SELECT * FROM food_recall_items WHERE slug = ?").get(slug) || null;
  },
  upsert: upsertFoodRecallItem,
};
