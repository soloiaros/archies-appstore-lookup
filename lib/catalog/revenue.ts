import type { DatabaseSync } from "node:sqlite";

import { estimated } from "@/lib/provenance/assign";

import { unavailable } from "@/lib/provenance/assign";

import type { Reading } from "@/models/provenance";

import type {
  RevenueBand,
  RevenueBasis,
} from "@/models/series";

type RevenueRow = {
  capturedOn: string;

  country: string;

  basis: RevenueBasis;

  lowUsd: number | null;

  midUsd: number | null;

  highUsd: number | null;

  method: string;
};

export function readLatestRevenue(
  db: DatabaseSync,
  trackId: number,
): Reading<RevenueBand> {
  const row = db.prepare(`
    select
      captured_on as capturedOn,
      country,
      basis,
      low_usd as lowUsd,
      mid_usd as midUsd,
      high_usd as highUsd,
      method
    from revenue_estimates
    where track_id = ?
    order by captured_on desc
    limit 1
  `).get(trackId) as RevenueRow | undefined;

  if (!row || row.method.trim().length === 0) {
    return unavailable();
  }

  return estimated(
    {
      low:
        row.lowUsd === null
          ? null
          : Number(row.lowUsd),
      mid:
        row.midUsd === null
          ? null
          : Number(row.midUsd),
      high:
        row.highUsd === null
          ? null
          : Number(row.highUsd),
      basis: row.basis,
      country: String(row.country),
      day: String(row.capturedOn),
    },
    String(row.method),
  );
}

export function formatRevenueBand(
  band: RevenueBand,
): string {
  if (band.mid !== null && band.low !== null) {
    return `${money(band.low)} – ${money(band.high ?? band.mid)}`;
  }

  if (band.high !== null) {
    return `≤ ${money(band.high)}`;
  }

  return "—";
}

export function rollupMrr(
  daily: Reading<RevenueBand>,
): Reading<string> {
  return rollupRunRate(daily, 30, "× 30");
}

export function rollupArr(
  daily: Reading<RevenueBand>,
): Reading<string> {
  return rollupRunRate(daily, 30 * 12, "× 30 × 12");
}

export function formatRunRate(
  band: RevenueBand,
): string {
  if (band.mid !== null && band.low !== null) {
    return `${compactUsd(band.low)} – ${compactUsd(band.high ?? band.mid)}`;
  }

  if (band.high !== null) {
    return `<${compactUsd(band.high)}`;
  }

  return "—";
}

function rollupRunRate(
  daily: Reading<RevenueBand>,
  factor: number,
  scaleNote: string,
): Reading<string> {
  if (daily.tier !== "estimated") {
    return unavailable();
  }

  const band = daily.value;

  const scaled: RevenueBand = {
    low:
      band.low === null
        ? null
        : band.low * factor,
    mid:
      band.mid === null
        ? null
        : band.mid * factor,
    high:
      band.high === null
        ? null
        : band.high * factor,
    basis: band.basis,
    country: band.country,
    day: band.day,
  };

  return estimated(
    formatRunRate(scaled),
    `US store-spend run rate from daily grossing curve (${daily.method} ${scaleNote})`,
  );
}

function money(
  value: number,
): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }

  return `$${Math.round(value)}`;
}

function compactUsd(
  value: number,
): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    const k = value / 1_000;

    if (Math.abs(k - Math.round(k)) < 1e-9) {
      return `$${Math.round(k)}k`;
    }

    return `$${k.toFixed(1)}k`;
  }

  return `$${Math.round(value)}`;
}
