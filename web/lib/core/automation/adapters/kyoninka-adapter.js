/**
 * kyoninka ドメインアダプター — 同期ランナー用
 */

import { normalize } from "@/lib/importers/kyoninka";
import { upsertKyoninkaEntity } from "@/lib/repositories/kyoninka";

export const kyoninkaAdapter = {
  domainId: "kyoninka",
  entityType: "kyoninka_entity",
  trackedFields: [
    "entity_name", "normalized_name", "corporate_number",
    "prefecture", "city", "address", "entity_status",
    "primary_license_family", "registration_count",
  ],
  normalize,
  findExisting: (slug) => {
    const { getDb } = require("@/lib/db");
    const db = getDb();
    return db.prepare("SELECT * FROM kyoninka_entities WHERE slug = ?").get(slug) || null;
  },
  upsert: upsertKyoninkaEntity,
};
