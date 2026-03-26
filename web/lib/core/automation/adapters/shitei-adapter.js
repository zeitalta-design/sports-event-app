/**
 * shitei ドメインアダプター — 同期ランナー用
 */

import { normalize } from "@/lib/importers/shitei";
import { upsertShiteiItem } from "@/lib/repositories/shitei";

export const shiteiAdapter = {
  domainId: "shitei",
  entityType: "shitei_item",
  trackedFields: [
    "title", "municipality_name", "prefecture", "facility_category",
    "facility_name", "recruitment_status",
    "application_start_date", "application_deadline",
    "opening_date", "contract_start_date", "contract_end_date",
    "summary", "eligibility", "application_method",
  ],
  normalize,
  findExisting: (slug) => {
    const { getDb } = require("@/lib/db");
    const db = getDb();
    return db.prepare("SELECT * FROM shitei_items WHERE slug = ?").get(slug) || null;
  },
  upsert: upsertShiteiItem,
};
