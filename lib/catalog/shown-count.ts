import { readStoredIndexCount } from "@/lib/catalog/index-count";

import { siteReader } from "@/lib/site/db";

export async function shownIndexedCount(
  fallback: number,
): Promise<number> {
  try {
    const sql = await siteReader();

    if (!sql) {
      return fallback;
    }

    const stored = await readStoredIndexCount(sql);

    return stored > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}
