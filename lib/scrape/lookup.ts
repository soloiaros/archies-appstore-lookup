import { readLookupResults } from "@/lib/scrape/map";

import { getJson } from "@/lib/scrape/http";

import { sleep } from "@/lib/scrape/retry";

import { dedupTrackIds } from "@/lib/scrape/dedup";

export const LOOKUP_BATCH_SIZE = 200;

export const LOOKUP_GAP_MS = 500;

export type LookupResult = {
  trackId: number;

  bundleId: string;

  trackName: string;

  description: string;

  sellerName: string;

  artworkUrl: string;

  screenshotUrls: string[];

  primaryGenreId: number;

  primaryGenreName: string;

  genreIds: number[];

  genres: string[];

  price: number;

  currency: string;

  formattedPrice: string;

  trackViewUrl: string;

  version: string;

  releaseDate: string;

  currentVersionReleaseDate: string;

  contentAdvisoryRating: string;

  averageUserRating: number | null;

  userRatingCount: number | null;

  releaseNotes: string;
};

export function chunkTrackIds(
  trackIds: number[],
  size = LOOKUP_BATCH_SIZE,
): number[][] {
  if (size < 1 || size > LOOKUP_BATCH_SIZE) {
    throw new Error(
      "Lookup batches stay at or under 200 ids.",
    );
  }

  const chunks: number[][] = [];

  for (
    let index = 0;
    index < trackIds.length;
    index += size
  ) {
    chunks.push(
      trackIds.slice(
        index,
        index + size,
      ),
    );
  }

  return chunks;
}

export function lookupUrl(
  trackIds: number[],
  country: string,
): string {
  const params = new URLSearchParams({
    id: trackIds.join(","),
    country,
    entity: "software",
  });

  return `https://itunes.apple.com/lookup?${params.toString()}`;
}

export async function lookupBatch(
  trackIds: number[],
  country: string,
): Promise<LookupResult[]> {
  if (trackIds.length === 0) {
    return [];
  }

  if (trackIds.length > LOOKUP_BATCH_SIZE) {
    throw new Error(
      "Lookup batches stay at or under 200 ids.",
    );
  }

  const payload = await getJson(
    lookupUrl(
      trackIds,
      country,
    ),
  );

  return readLookupResults(payload);
}

export async function lookupAll(
  trackIds: number[],
  country: string,
): Promise<LookupResult[]> {
  const chunks = chunkTrackIds(
    dedupTrackIds(trackIds),
  );

  const apps: LookupResult[] = [];

  for (
    let index = 0;
    index < chunks.length;
    index += 1
  ) {
    const batch = await lookupBatch(
      chunks[index],
      country,
    );

    apps.push(...batch);

    if (index < chunks.length - 1) {
      await sleep(LOOKUP_GAP_MS);
    }
  }

  return apps;
}
