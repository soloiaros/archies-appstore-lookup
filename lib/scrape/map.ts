import type { AppMetadata } from "@/models/app";

import type {
  RatingSnapshot,
  VersionRelease,
} from "@/models/series";

import {
  asNumber,
  asString,
  asStringList,
  isRecord,
} from "@/lib/scrape/json";

import type { LookupResult } from "@/lib/scrape/lookup";

function genreIdsOf(
  value: unknown,
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: number[] = [];

  for (const item of value) {
    const id = asNumber(item);

    if (
      id !== null
      && Number.isSafeInteger(id)
    ) {
      ids.push(id);
    }
  }

  return ids;
}

export function readLookupResults(
  payload: unknown,
): LookupResult[] {
  if (
    !isRecord(payload)
    || !Array.isArray(payload.results)
  ) {
    return [];
  }

  const apps: LookupResult[] = [];

  for (const item of payload.results) {
    const app = readLookupResult(item);

    if (app) {
      apps.push(app);
    }
  }

  return apps;
}

function readLookupResult(
  value: unknown,
): LookupResult | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.wrapperType !== "software"
    && value.kind !== "software"
  ) {
    return null;
  }

  const trackId = asNumber(value.trackId);

  const bundleId = asString(value.bundleId);

  const trackName = asString(value.trackName);

  const primaryGenreId = asNumber(
    value.primaryGenreId,
  );

  const primaryGenreName = asString(
    value.primaryGenreName,
  );

  if (
    trackId === null
    || !Number.isSafeInteger(trackId)
    || bundleId === null
    || trackName === null
    || primaryGenreId === null
    || primaryGenreName === null
  ) {
    return null;
  }

  const artwork =
    asString(value.artworkUrl512)
    ?? asString(value.artworkUrl100)
    ?? "";

  const ratingAverage = asNumber(
    value.averageUserRating,
  );

  const ratingCount = asNumber(
    value.userRatingCount,
  );

  return {
    trackId,
    bundleId,
    trackName,
    description: asString(value.description) ?? "",
    sellerName: asString(value.sellerName) ?? "",
    artworkUrl: artwork,
    screenshotUrls: asStringList(
      value.screenshotUrls,
    ),
    primaryGenreId,
    primaryGenreName,
    genreIds: genreIdsOf(value.genreIds),
    genres: asStringList(value.genres),
    price: asNumber(value.price) ?? 0,
    currency: asString(value.currency) ?? "",
    formattedPrice:
      asString(value.formattedPrice) ?? "",
    trackViewUrl: asString(value.trackViewUrl) ?? "",
    version: asString(value.version) ?? "",
    releaseDate: asString(value.releaseDate) ?? "",
    currentVersionReleaseDate:
      asString(value.currentVersionReleaseDate)
      ?? "",
    contentAdvisoryRating:
      asString(value.contentAdvisoryRating) ?? "",
    averageUserRating: ratingAverage,
    userRatingCount:
      ratingCount === null
        ? null
        : Math.trunc(ratingCount),
    releaseNotes: asString(value.releaseNotes) ?? "",
  };
}

export function toAppMetadata(
  result: LookupResult,
  metadataFetchedAt: string,
): AppMetadata {
  return {
    tier: "verified",
    origin: "lookup",
    trackId: result.trackId,
    bundleId: result.bundleId,
    name: result.trackName,
    description: result.description,
    sellerName: result.sellerName,
    iconUrl: result.artworkUrl,
    screenshotUrls: result.screenshotUrls,
    primaryGenreId: result.primaryGenreId,
    primaryGenre: result.primaryGenreName,
    genreIds: result.genreIds,
    genres: result.genres,
    price: result.price,
    currency: result.currency,
    formattedPrice: result.formattedPrice,
    storeUrl: result.trackViewUrl,
    version: result.version,
    releaseDate: result.releaseDate,
    currentVersionReleaseDate:
      result.currentVersionReleaseDate,
    contentAdvisoryRating:
      result.contentAdvisoryRating,
    metadataFetchedAt,
    delisted: false,
  };
}

export function toRatingSnapshot(
  result: LookupResult,
  capturedAt: string,
): RatingSnapshot | null {
  if (
    result.averageUserRating === null
    || result.userRatingCount === null
  ) {
    return null;
  }

  return {
    tier: "verified",
    origin: "lookup",
    trackId: result.trackId,
    capturedAt,
    ratingAverage: result.averageUserRating,
    ratingCount: result.userRatingCount,
  };
}

export function toVersionRelease(
  result: LookupResult,
): VersionRelease | null {
  if (
    result.version === ""
    || result.currentVersionReleaseDate === ""
  ) {
    return null;
  }

  return {
    tier: "verified",
    origin: "lookup",
    trackId: result.trackId,
    version: result.version,
    releasedAt: result.currentVersionReleaseDate,
    notes: result.releaseNotes,
  };
}
