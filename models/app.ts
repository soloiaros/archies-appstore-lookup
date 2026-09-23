export type AppMetadata = {
  tier: "verified";

  origin: "lookup";

  trackId: number;

  bundleId: string;

  name: string;

  description: string;

  sellerName: string;

  iconUrl: string;

  screenshotUrls: string[];

  primaryGenreId: number;

  primaryGenre: string;

  genreIds: number[];

  genres: string[];

  price: number;

  currency: string;

  formattedPrice: string;

  storeUrl: string;

  version: string;

  releaseDate: string;

  currentVersionReleaseDate: string;

  contentAdvisoryRating: string;

  metadataFetchedAt: string;

  delisted: boolean;
};
