export const METADATA_MAX_AGE_MS =
  7 * 24 * 60 * 60 * 1000;

export const RATING_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

export function isStale(
  fetchedAt: string,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  const then = Date.parse(fetchedAt);

  if (Number.isNaN(then)) {
    return true;
  }

  return now - then > maxAgeMs;
}
