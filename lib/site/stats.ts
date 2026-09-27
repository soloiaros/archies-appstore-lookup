import { siteDb } from "@/lib/site/db";

import { regionFlag, regionName } from "@/lib/site/region";

const DAY = 86_400_000;

export type DayPoint = {
  ts: number;

  visitors: number;
};

export type CountRow = {
  label: string;

  n: number;
};

export type StatsReport = {
  days: number;

  visitors: number;

  pageviews: number;

  sessions: number;

  bounceRate: number | null;

  avgSessionMs: number | null;

  series: DayPoint[];

  peak: number;

  pages: CountRow[];

  referrers: CountRow[];

  countries: Array<CountRow & { code: string; flag: string }>;
};

function windowStart(days: number, now: number) {
  return now - days * DAY;
}

export async function visitorTotal(): Promise<number> {
  const sql = await siteDb();

  const row = await sql.get<{ visitors: number }>(
    "select count(distinct vid) as visitors from pageviews",
  );

  return row?.visitors ?? 0;
}

export async function recordView(input: {
  path: string;

  country: string | null;

  referrerHost: string | null;

  vid: string;

  sid: string;
}) {
  const sql = await siteDb();

  await sql.run(
    `
    insert into pageviews (
      ts,
      path,
      country,
      referrer_host,
      vid,
      sid
    ) values (?, ?, ?, ?, ?, ?)
    `,
    [
      Date.now(),
      input.path,
      input.country,
      input.referrerHost,
      input.vid,
      input.sid,
    ],
  );
}

export async function loadStats(
  days: number,
  now = Date.now(),
): Promise<StatsReport> {
  const sql = await siteDb();

  const start = windowStart(days, now);

  const totals = await sql.get<{
    visitors: number;

    pageviews: number;

    sessions: number;
  }>(
    `
    select
      count(distinct vid) as visitors,
      count(*) as pageviews,
      count(distinct sid) as sessions
    from pageviews
    where ts >= ?
    `,
    [start],
  );

  const span = await sql.get<{
    bounces: number | null;

    avgSpan: number | null;
  }>(
    `
    select
      sum(case when hits = 1 then 1 else 0 end) as bounces,
      avg(case when hits > 1 then span end) as avgSpan
    from (
      select
        count(*) as hits,
        max(ts) - min(ts) as span
      from pageviews
      where ts >= ?
      group by sid
    )
    `,
    [start],
  );

  const daily = await sql.all<{ day: number; visitors: number }>(
    `
    select
      cast(ts / ${DAY} as integer) as day,
      count(distinct vid) as visitors
    from pageviews
    where ts >= ?
    group by day
    `,
    [start],
  );

  const pages = await sql.all<{ label: string; n: number }>(
    `
    select path as label, count(*) as n
    from pageviews
    where ts >= ?
    group by path
    order by n desc
    limit 8
    `,
    [start],
  );

  const referrers = await sql.all<{ label: string; n: number }>(
    `
    select
      case
        when referrer_host is null or referrer_host = '' then 'Direct'
        else referrer_host
      end as label,
      count(*) as n
    from pageviews
    where ts >= ?
    group by label
    order by n desc
    limit 8
    `,
    [start],
  );

  const countries = await sql.all<{ code: string; n: number }>(
    `
    select
      coalesce(country, '') as code,
      count(distinct vid) as n
    from pageviews
    where ts >= ?
    group by code
    order by n desc
    limit 10
    `,
    [start],
  );

  const byDay = new Map(
    daily.map((row) => [row.day, row.visitors]),
  );

  const firstDay = Math.floor(start / DAY);

  const lastDay = Math.floor(now / DAY);

  const series: DayPoint[] = [];

  for (let day = firstDay; day <= lastDay; day += 1) {
    series.push({
      ts: day * DAY,
      visitors: byDay.get(day) ?? 0,
    });
  }

  const sessions = totals?.sessions ?? 0;

  const bounces = span?.bounces ?? 0;

  const peak = series.reduce(
    (max, point) => Math.max(max, point.visitors),
    0,
  );

  return {
    days,
    visitors: totals?.visitors ?? 0,
    pageviews: totals?.pageviews ?? 0,
    sessions,
    bounceRate: sessions > 0 ? bounces / sessions : null,
    avgSessionMs: span?.avgSpan ?? null,
    series,
    peak,
    pages,
    referrers,
    countries: countries.map((row) => ({
      code: row.code,
      label: regionName(row.code),
      n: row.n,
      flag: regionFlag(row.code),
    })),
  };
}
