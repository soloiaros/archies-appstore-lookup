import { NextResponse } from "next/server";

import { openCatalog } from "@/lib/scrape/store";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 40;

const MAX_LIMIT = 48;

/**
 * Popular overall-chart apps only (few dozen).
 * Client loads icons via /api/vending-icons/[trackId].
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      8,
      Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
    ),
  );

  const db = openCatalog();

  try {
    const rows = db
      .prepare(
        `
        select
          a.track_id as trackId,
          a.name as name
        from chart_snapshots c
        join apps a on a.track_id = c.track_id
        where c.genre_id = 0
          and c.chart in ('top-free', 'top-grossing', 'top-paid')
          and a.delisted = 0
          and a.icon_url != ''
        group by a.track_id
        order by min(c.rank) asc, a.track_id asc
        limit ?
      `,
      )
      .all(limit) as Array<{
      trackId: number;
      name: string;
    }>;

    const icons = rows.map((row) => ({
      trackId: Number(row.trackId),
      name: String(row.name),
      src: `/api/vending-icons/${row.trackId}`,
    }));

    return NextResponse.json({
      count: icons.length,
      icons,
    });
  } finally {
    db.close();
  }
}
