import type { SiteSql } from "@/lib/site/types";

const DAY = 86_400_000;

export async function sweepSite(
  sql: SiteSql,
  now = Date.now(),
) {
  await sql.run(
    "delete from pageviews where ts < ?",
    [now - 90 * DAY],
  );

  await sql.run(
    "delete from rate_limits where window_start < ?",
    [now - 2 * DAY],
  );
}
