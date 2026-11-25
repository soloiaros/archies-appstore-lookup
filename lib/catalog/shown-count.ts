import { readStoredIndexCount } from "@/lib/catalog/index-count";

import { siteReader } from "@/lib/site/db";

export async function shownIndexedCount(
  fallback: number,
): Promise<number> {
  try {
    const sql = await siteReader();

    if (sql) {
      const stored = await readStoredIndexCount(sql);
      if (stored > 0) {
        return stored;
      }
    }

    // Try reading actual count directly from the catalog
    try {
      const { openCatalog } = await import("@/lib/scrape/store");
      const db = openCatalog();
      try {
        const row = db.prepare("select count(*) as n from apps where delisted = 0").get() as { n: number } | undefined;
        if (row && typeof row.n === "number" && row.n > 0) {
          if (sql) {
            await sql.run(
              `insert into meta (key, value, updated_at) values (?, ?, ?)
               on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
              ["indexed_apps", row.n, Date.now()],
            ).catch(() => {});
          }
          return row.n;
        }
      } finally {
        db.close();
      }
    } catch {}

    return fallback;
  } catch {
    return fallback;
  }
}
