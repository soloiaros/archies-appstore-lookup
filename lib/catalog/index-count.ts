import type { SiteSql } from "../site/types";

const KEY = "indexed_apps";

const FRESH_MS = 60 * 60 * 1000;

export async function readStoredIndexCount(
  sql: SiteSql,
): Promise<number> {
  const row = await sql.get<{ value: number }>(
    `
    select value
    from meta
    where key = ?
    `,
    [KEY],
  );

  const n = Number(row?.value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

export async function refreshIndexCount(
  site: SiteSql,
  catalog: SiteSql,
  now = Date.now(),
): Promise<void> {
  const row = await site.get<{ updatedAt: number }>(
    `
    select updated_at as updatedAt
    from meta
    where key = ?
    `,
    [KEY],
  );

  if (
    row
    && now - Number(row.updatedAt) < FRESH_MS
  ) {
    return;
  }

  const counted = await catalog.get<{ n: number }>(
    "select count(*) as n from apps where delisted = 0",
  );

  const n = Number(counted?.n ?? 0);

  if (!Number.isFinite(n) || n <= 0) {
    return;
  }

  await site.run(
    `
    insert into meta (key, value, updated_at)
    values (?, ?, ?)
    on conflict (key) do update set
      value = excluded.value,
      updated_at = excluded.updated_at
    `,
    [KEY, n, now],
  );
}
