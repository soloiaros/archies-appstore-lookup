import type { ChartHit } from "@/lib/scrape/rss";

export function dedupTrackIds(
  trackIds: number[],
): number[] {
  const seen = new Set<number>();

  const unique: number[] = [];

  for (const trackId of trackIds) {
    if (seen.has(trackId)) {
      continue;
    }

    seen.add(trackId);

    unique.push(trackId);
  }

  return unique;
}

export function dedupChartHits(
  hits: ChartHit[],
): ChartHit[] {
  const seen = new Set<number>();

  const unique: ChartHit[] = [];

  for (const hit of hits) {
    if (seen.has(hit.trackId)) {
      continue;
    }

    seen.add(hit.trackId);

    unique.push(hit);
  }

  return unique;
}
