import { readFileSync } from "node:fs";

import { join } from "node:path";

import { DatabaseSync } from "node:sqlite";

import {
  bandFromMid,
  estimateRevenue,
  genreSpendFromDuals,
  loadRevenueCurve,
  logInterpolateSpend,
  spendAtRank,
} from "../lib/pipeline/revenue";

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(message);
  }
}

function near(
  left: number,
  right: number,
  eps = 1e-6,
): boolean {
  return Math.abs(left - right) <= eps * Math.max(
    1,
    Math.abs(right),
  );
}

const curve = loadRevenueCurve();

assert(
  curve !== null,
  "curve must load",
);

assert(
  curve!.method === "us-grossing-power-v1",
  "method string",
);

assert(
  curve!.citations.length > 0,
  "citations required",
);

assert(
  curve!.anchors.length > 0,
  "anchors required",
);

const rankOne = spendAtRank(curve!, 1);

assert(
  near(rankOne, curve!.A),
  "power law at rank 1",
);

const rankTen = spendAtRank(curve!, 10);

assert(
  near(
    rankTen,
    curve!.A * 10 ** (-curve!.alpha),
  ),
  "power law at rank 10",
);

const overallBand = bandFromMid(
  rankTen,
  curve!.bandOverall,
);

assert(
  near(overallBand.low, rankTen / 2),
  "overall band low",
);

assert(
  near(overallBand.high, rankTen * 2),
  "overall band high",
);

const dualSpend = logInterpolateSpend(
  20,
  {
    genreRank: 10,
    spend: 1000,
  },
  {
    genreRank: 30,
    spend: 100,
  },
);

assert(
  dualSpend < 1000 && dualSpend > 100,
  "dual log interpolate between",
);

assert(
  near(
    genreSpendFromDuals(
      20,
      [
        {
          genreRank: 10,
          spend: 1000,
        },
        {
          genreRank: 30,
          spend: 100,
        },
      ],
    ),
    dualSpend,
  ),
  "genreSpendFromDuals matches",
);

const db = new DatabaseSync(":memory:");

db.exec("pragma foreign_keys = on");

db.exec(
  readFileSync(
    join(
      process.cwd(),
      "models",
      "schema.sql",
    ),
    "utf8",
  ),
);

seedFixture(db);

const first = estimateRevenue(db, curve);

assert(
  first.skipped === null,
  "first run should write",
);

assert(
  first.rows > 0,
  "rows written",
);

const overall = readEstimate(db, 1);

assert(
  overall?.basis === "overall-grossing",
  "overall basis",
);

assert(
  overall?.midUsd !== null
  && near(
    overall!.midUsd!,
    spendAtRank(curve!, 5),
  ),
  "overall midpoint",
);

assert(
  overall?.lowUsd !== null
  && near(
    overall!.lowUsd!,
    overall!.midUsd! / 2,
  ),
  "overall low",
);

const genre = readEstimate(db, 3);

assert(
  genre?.basis === "genre-grossing",
  "genre basis",
);

assert(
  genre?.midUsd !== null,
  "genre mid",
);

const ceiling = readEstimate(db, 4);

assert(
  ceiling?.basis === "genre-ceiling",
  "ceiling basis",
);

assert(
  ceiling?.midUsd === null,
  "ceiling has no mid",
);

assert(
  ceiling?.highUsd !== null
  && near(
    ceiling!.highUsd!,
    spendAtRank(curve!, 100),
  ),
  "ceiling high",
);

const below = readEstimate(db, 5);

assert(
  below?.basis === "below-grossing",
  "below basis",
);

assert(
  below?.midUsd === null,
  "below has no mid",
);

assert(
  below?.highUsd !== null
  && near(
    below!.highUsd!,
    spendAtRank(curve!, 100),
  ),
  "below high",
);

const snapshot = JSON.stringify(
  listEstimates(db),
);

const second = estimateRevenue(db, curve);

assert(
  second.skipped === null,
  "second run ok",
);

assert(
  JSON.stringify(listEstimates(db)) === snapshot,
  "second run unchanged",
);

console.log(
  JSON.stringify({
    ok: true,
    rows: first.rows,
    method: curve!.method,
  }),
);

function seedFixture(
  database: DatabaseSync,
): void {
  const insertApp = database.prepare(`
    insert into apps (
      track_id,
      tier,
      bundle_id,
      name,
      description,
      seller_name,
      icon_url,
      screenshot_urls,
      primary_genre_id,
      primary_genre,
      genre_ids,
      genres,
      price,
      currency,
      formatted_price,
      store_url,
      version,
      release_date,
      current_version_release_date,
      content_advisory_rating,
      metadata_fetched_at,
      delisted
    ) values (
      ?, 'verified', ?, ?, '', '', '', '[]', 6000, 'Business',
      '[]', '[]', 0, 'USD', 'Free', '', '1.0',
      '2020-01-01', '2020-01-01', '4+', '2026-09-23T00:00:00.000Z', 0
    )
  `);

  for (const id of [1, 2, 3, 4, 5]) {
    insertApp.run(
      id,
      `bundle.${id}`,
      `App ${id}`,
    );
  }

  const insertChart = database.prepare(`
    insert into chart_snapshots (
      track_id,
      tier,
      captured_on,
      captured_at,
      country,
      chart,
      genre_id,
      rank
    ) values (
      ?, 'verified', '2026-09-23', '2026-09-23T12:00:00.000Z',
      'us', 'top-grossing', ?, ?
    )
  `);

  // overall: 1 at #5, 2 at #20
  insertChart.run(1, 0, 5);
  insertChart.run(2, 0, 20);

  // genre 6000 with duals (1, 2) and category-only 3
  insertChart.run(1, 6000, 2);
  insertChart.run(2, 6000, 40);
  insertChart.run(3, 6000, 20);

  // genre 6001 with no overall overlap → ceiling for 4
  insertChart.run(4, 6001, 7);
}

function readEstimate(
  database: DatabaseSync,
  trackId: number,
) {
  return database.prepare(`
    select
      basis,
      low_usd as lowUsd,
      mid_usd as midUsd,
      high_usd as highUsd,
      method
    from revenue_estimates
    where track_id = ?
      and captured_on = '2026-09-23'
      and country = 'us'
  `).get(trackId) as
    | {
        basis: string;

        lowUsd: number | null;

        midUsd: number | null;

        highUsd: number | null;

        method: string;
      }
    | undefined;
}

function listEstimates(
  database: DatabaseSync,
) {
  return database.prepare(`
    select
      track_id as trackId,
      captured_on as capturedOn,
      country,
      basis,
      rank,
      chart,
      genre_id as genreId,
      low_usd as lowUsd,
      mid_usd as midUsd,
      high_usd as highUsd,
      method
    from revenue_estimates
    order by track_id
  `).all();
}
