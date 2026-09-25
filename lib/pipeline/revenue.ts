import { readFileSync } from "node:fs";

import { join } from "node:path";

import type { DatabaseSync } from "node:sqlite";

import {
  listTrackIds,
  openCatalog,
  upsertRevenueEstimates,
} from "@/lib/scrape/store";

import type {
  RevenueBasis,
  RevenueEstimateRow,
} from "@/models/series";

export const REVENUE_METHOD =
  "us-grossing-power-v1";

export const CURVE_PATH = join(
  process.cwd(),
  "data",
  "revenue-curves",
  "us-grossing-v1.json",
);

export type RevenueCurve = {
  id: string;

  method: string;

  country: string;

  alpha: number;

  A: number;

  bandOverall: number;

  bandGenre: number;

  citations: Array<{
    title: string;

    url: string;

    notedAt: string;
  }>;

  anchors: Array<{
    rank: number;

    spendUsdPerDay: number;

    note?: string;
  }>;
};

type GrossingHit = {
  trackId: number;

  genreId: number;

  rank: number;
};

type DayKey = {
  capturedOn: string;

  country: string;
};

type DualPoint = {
  genreRank: number;

  spend: number;
};

export type EstimateResult = {
  days: number;

  rows: number;

  skipped: string | null;
};

export function loadRevenueCurve(
  path: string = CURVE_PATH,
): RevenueCurve | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(
      readFileSync(path, "utf8"),
    ) as unknown;
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object"
    || parsed === null
  ) {
    return null;
  }

  const row = parsed as Record<
    string,
    unknown
  >;

  if (
    typeof row.method !== "string"
    || row.method.trim().length === 0
    || typeof row.alpha !== "number"
    || typeof row.A !== "number"
    || typeof row.bandOverall !== "number"
    || typeof row.bandGenre !== "number"
    || !Array.isArray(row.citations)
    || row.citations.length === 0
    || !Array.isArray(row.anchors)
    || row.anchors.length === 0
  ) {
    return null;
  }

  for (const citation of row.citations) {
    if (
      typeof citation !== "object"
      || citation === null
      || typeof (citation as { title?: unknown }).title !== "string"
      || typeof (citation as { url?: unknown }).url !== "string"
      || typeof (citation as { notedAt?: unknown }).notedAt !== "string"
      || (citation as { title: string }).title.trim().length === 0
      || (citation as { url: string }).url.trim().length === 0
    ) {
      return null;
    }
  }

  return {
    id: String(row.id ?? "us-grossing-v1"),
    method: row.method.trim(),
    country: String(row.country ?? "us"),
    alpha: row.alpha,
    A: row.A,
    bandOverall: row.bandOverall,
    bandGenre: row.bandGenre,
    citations: row.citations as RevenueCurve["citations"],
    anchors: row.anchors as RevenueCurve["anchors"],
  };
}

export function spendAtRank(
  curve: RevenueCurve,
  rank: number,
): number {
  return curve.A * rank ** (-curve.alpha);
}

export function bandFromMid(
  mid: number,
  factor: number,
): {
  low: number;

  mid: number;

  high: number;
} {
  return {
    low: mid / factor,
    mid,
    high: mid * factor,
  };
}

export function logInterpolateSpend(
  rank: number,
  lower: DualPoint,
  upper: DualPoint,
): number {
  if (lower.genreRank === upper.genreRank) {
    return lower.spend;
  }

  const t =
    (rank - lower.genreRank)
    / (upper.genreRank - lower.genreRank);

  const logSpend =
    Math.log(lower.spend)
    + t * (
      Math.log(upper.spend)
      - Math.log(lower.spend)
    );

  return Math.exp(logSpend);
}

export function estimateRevenue(
  db: DatabaseSync,
  curve: RevenueCurve | null = loadRevenueCurve(),
): EstimateResult {
  if (!curve) {
    return {
      days: 0,
      rows: 0,
      skipped: "missing curve citation or anchors",
    };
  }

  const days = listGrossingDays(db);

  if (days.length === 0) {
    return {
      days: 0,
      rows: 0,
      skipped: "no overall grossing snapshots",
    };
  }

  const trackIds = listTrackIds(db);

  const rows: RevenueEstimateRow[] = [];

  for (const day of days) {
    const hits = loadGrossingHits(
      db,
      day.capturedOn,
      day.country,
    );

    const overall = new Map<number, number>();

    const byGenre = new Map<
      number,
      Map<number, number>
    >();

    for (const hit of hits) {
      if (hit.genreId === 0) {
        overall.set(hit.trackId, hit.rank);

        continue;
      }

      let genre = byGenre.get(hit.genreId);

      if (!genre) {
        genre = new Map();

        byGenre.set(hit.genreId, genre);
      }

      genre.set(hit.trackId, hit.rank);
    }

    if (overall.size === 0) {
      continue;
    }

    const dualsByGenre = new Map<
      number,
      DualPoint[]
    >();

    for (const [genreId, ranks] of byGenre) {
      const duals: DualPoint[] = [];

      for (const [trackId, genreRank] of ranks) {
        const overallRank = overall.get(trackId);

        if (overallRank === undefined) {
          continue;
        }

        duals.push({
          genreRank,
          spend: spendAtRank(curve, overallRank),
        });
      }

      duals.sort(
        (left, right) =>
          left.genreRank - right.genreRank,
      );

      dualsByGenre.set(genreId, duals);
    }

    const ceiling = spendAtRank(curve, 100);

    const written = new Set<number>();

    for (const [trackId, rank] of overall) {
      const band = bandFromMid(
        spendAtRank(curve, rank),
        curve.bandOverall,
      );

      rows.push(
        rowOf({
          trackId,
          capturedOn: day.capturedOn,
          country: day.country,
          basis: "overall-grossing",
          rank,
          chart: "top-grossing",
          genreId: 0,
          lowUsd: band.low,
          midUsd: band.mid,
          highUsd: band.high,
          method: curve.method,
        }),
      );

      written.add(trackId);
    }

    const categoryOnly = new Map<
      number,
      Array<{
        genreId: number;

        rank: number;
      }>
    >();

    for (const [genreId, ranks] of byGenre) {
      for (const [trackId, rank] of ranks) {
        if (written.has(trackId)) {
          continue;
        }

        const list =
          categoryOnly.get(trackId) ?? [];

        list.push({
          genreId,
          rank,
        });

        categoryOnly.set(trackId, list);
      }
    }

    for (const [trackId, appearances] of categoryOnly) {
      const pick = pickGenreAppearance(
        appearances,
        dualsByGenre,
      );

      const duals =
        dualsByGenre.get(pick.genreId) ?? [];

      if (duals.length === 0) {
        rows.push(
          rowOf({
            trackId,
            capturedOn: day.capturedOn,
            country: day.country,
            basis: "genre-ceiling",
            rank: pick.rank,
            chart: "top-grossing",
            genreId: pick.genreId,
            lowUsd: null,
            midUsd: null,
            highUsd: ceiling,
            method: curve.method,
          }),
        );

        written.add(trackId);

        continue;
      }

      const mid = genreSpendFromDuals(
        pick.rank,
        duals,
      );

      const band = bandFromMid(
        mid,
        curve.bandGenre,
      );

      rows.push(
        rowOf({
          trackId,
          capturedOn: day.capturedOn,
          country: day.country,
          basis: "genre-grossing",
          rank: pick.rank,
          chart: "top-grossing",
          genreId: pick.genreId,
          lowUsd: band.low,
          midUsd: band.mid,
          highUsd: band.high,
          method: curve.method,
        }),
      );

      written.add(trackId);
    }

    for (const trackId of trackIds) {
      if (written.has(trackId)) {
        continue;
      }

      rows.push(
        rowOf({
          trackId,
          capturedOn: day.capturedOn,
          country: day.country,
          basis: "below-grossing",
          rank: null,
          chart: null,
          genreId: null,
          lowUsd: null,
          midUsd: null,
          highUsd: ceiling,
          method: curve.method,
        }),
      );
    }
  }

  upsertRevenueEstimates(db, rows);

  return {
    days: days.length,
    rows: rows.length,
    skipped: null,
  };
}

export function runRevenueEstimates(): EstimateResult {
  const db = openCatalog();

  try {
    return estimateRevenue(db);
  } finally {
    db.close();
  }
}

export function genreSpendFromDuals(
  rank: number,
  duals: DualPoint[],
): number {
  if (duals.length === 0) {
    throw new Error("duals required");
  }

  if (duals.length === 1) {
    return duals[0].spend;
  }

  let lower = duals[0];

  let upper = duals[duals.length - 1];

  for (let i = 0; i < duals.length; i += 1) {
    const point = duals[i];

    if (point.genreRank <= rank) {
      lower = point;
    }

    if (point.genreRank >= rank) {
      upper = point;

      break;
    }
  }

  if (rank <= duals[0].genreRank) {
    return logInterpolateSpend(
      rank,
      duals[0],
      duals[1],
    );
  }

  if (rank >= duals[duals.length - 1].genreRank) {
    return logInterpolateSpend(
      rank,
      duals[duals.length - 2],
      duals[duals.length - 1],
    );
  }

  return logInterpolateSpend(
    rank,
    lower,
    upper,
  );
}

function pickGenreAppearance(
  appearances: Array<{
    genreId: number;

    rank: number;
  }>,
  dualsByGenre: Map<number, DualPoint[]>,
): {
  genreId: number;

  rank: number;
} {
  const withDuals = appearances.filter(
    (item) =>
      (dualsByGenre.get(item.genreId)?.length ?? 0)
      > 0,
  );

  const pool =
    withDuals.length > 0
      ? withDuals
      : appearances;

  return [...pool].sort(
    (left, right) => left.rank - right.rank,
  )[0];
}

function listGrossingDays(
  db: DatabaseSync,
): DayKey[] {
  return db.prepare(`
    select distinct
      captured_on as capturedOn,
      country
    from chart_snapshots
    where chart = 'top-grossing'
      and genre_id = 0
    order by captured_on, country
  `).all() as DayKey[];
}

function loadGrossingHits(
  db: DatabaseSync,
  capturedOn: string,
  country: string,
): GrossingHit[] {
  return db.prepare(`
    select
      track_id as trackId,
      genre_id as genreId,
      rank
    from chart_snapshots
    where chart = 'top-grossing'
      and captured_on = ?
      and country = ?
  `).all(
    capturedOn,
    country,
  ) as GrossingHit[];
}

function rowOf(
  input: {
    trackId: number;

    capturedOn: string;

    country: string;

    basis: RevenueBasis;

    rank: number | null;

    chart: "top-grossing" | null;

    genreId: number | null;

    lowUsd: number | null;

    midUsd: number | null;

    highUsd: number | null;

    method: string;
  },
): RevenueEstimateRow {
  return {
    trackId: input.trackId,
    capturedOn: input.capturedOn,
    country: input.country,
    basis: input.basis,
    rank: input.rank,
    chart: input.chart,
    genreId: input.genreId,
    lowUsd: input.lowUsd,
    midUsd: input.midUsd,
    highUsd: input.highUsd,
    method: input.method,
  };
}
