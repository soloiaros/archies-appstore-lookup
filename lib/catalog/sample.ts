import type { SiteSql } from "@/lib/site/types";

const PAGE = 1000;

const POOL_MS = 6 * 60 * 60 * 1000;

const RETRY_MS = 30_000;

let pool: {
  urls: string[];

  at: number;
} | null = null;

let loading: Promise<string[]> | null = null;

let failedAt = 0;

export async function sampleIconUrls(
  sql: SiteSql,
  sample: number,
): Promise<string[]> {
  const urls = await iconPool(sql);

  return pick(urls, sample);
}

async function iconPool(sql: SiteSql): Promise<string[]> {
  const now = Date.now();

  if (pool && now - pool.at < POOL_MS) {
    return pool.urls;
  }

  if (!pool && now - failedAt < RETRY_MS) {
    return [];
  }

  if (!loading) {
    loading = readPool(sql)
      .then((urls) => {
        loading = null;

        if (urls.length > 0) {
          pool = { urls, at: Date.now() };

          failedAt = 0;
        }

        return pool?.urls ?? urls;
      })
      .catch((error: unknown) => {
        loading = null;

        failedAt = Date.now();

        if (pool) {
          return pool.urls;
        }

        throw error;
      });
  }

  return loading;
}

async function readPool(sql: SiteSql): Promise<string[]> {
  const seen = new Set<string>();

  let after = 0;

  for (;;) {
    const rows = await sql.all<{
      id: number;

      src: string;
    }>(
      `
      select
        track_id as id,
        icon_url as src
      from apps
      where delisted = 0
        and icon_url != ''
        and track_id > ?
      order by track_id
      limit ${PAGE}
      `,
      [after],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const src = String(row.src ?? "");

      if (src.length > 0) {
        seen.add(src);
      }

      after = Number(row.id);
    }

    if (rows.length < PAGE) {
      break;
    }
  }

  return [...seen];
}

function pick(urls: string[], sample: number): string[] {
  if (urls.length === 0 || sample <= 0) {
    return [];
  }

  if (urls.length <= sample) {
    return shuffle([...urls]);
  }

  const chosen = new Set<number>();

  const out: string[] = [];

  while (out.length < sample) {
    const index = Math.floor(Math.random() * urls.length);

    if (chosen.has(index)) {
      continue;
    }

    chosen.add(index);

    out.push(urls[index]!);
  }

  return out;
}

function shuffle(list: string[]) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));

    const held = list[index];

    list[index] = list[swap]!;

    list[swap] = held!;
  }

  return list;
}
