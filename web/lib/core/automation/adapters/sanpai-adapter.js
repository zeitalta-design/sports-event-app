/**
 * sanpai ドメインアダプター — 同期ランナー用
 */

import { normalize } from "@/lib/importers/sanpai";
import { upsertSanpaiItem } from "@/lib/repositories/sanpai";

export const sanpaiAdapter = {
  domainId: "sanpai",
  entityType: "sanpai_item",
  trackedFields: [
    "company_name", "corporate_number", "prefecture", "city",
    "license_type", "waste_category", "business_area",
    "status", "risk_level", "penalty_count", "latest_penalty_date",
  ],
  normalize,
  findExisting: (slug) => {
    const { getDb } = require("@/lib/db");
    const db = getDb();
    return db.prepare("SELECT * FROM sanpai_items WHERE slug = ?").get(slug) || null;
  },
  upsert: upsertSanpaiItem,
};
