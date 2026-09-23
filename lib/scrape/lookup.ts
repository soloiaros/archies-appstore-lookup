export const LOOKUP_BATCH_SIZE = 200;

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
  // TODO(phase-1)

  void trackIds;

  void country;

  return [];
}
