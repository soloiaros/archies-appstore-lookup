import type { SiteSql } from "@/lib/site/types";

const DAY = 86_400_000;

const CLEAR = `
update slots
set
  status = 'open',
  name = null,
  url = null,
  blurb = null,
  logo_url = null,
  color = null,
  hold_until = null,
  paid_until = null,
  checkout_id = null
`;

export async function releaseExpired(
  sql: SiteSql,
  now = Date.now(),
) {
  await sql.run(
    `${CLEAR}
     where kind = 'sale'
       and status = 'held'
       and hold_until is not null
       and hold_until < ?`,
    [now],
  );

  await sql.run(
    `${CLEAR}
     where kind = 'sale'
       and status = 'taken'
       and paid_until is not null
       and paid_until < ?`,
    [now],
  );

  await sql.run(
    "delete from pageviews where ts < ?",
    [now - 90 * DAY],
  );

  await sql.run(
    "delete from rate_limits where window_start < ?",
    [now - 2 * DAY],
  );
}
