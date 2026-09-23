export {
  dedupChartHits,
  dedupTrackIds,
} from "@/lib/scrape/dedup";

export {
  flagDelisted,
  isDelisted,
} from "@/lib/scrape/delist";

export {
  chunkTrackIds,
  LOOKUP_BATCH_SIZE,
  lookupBatch,
  lookupUrl,
} from "@/lib/scrape/lookup";

export type { LookupResult } from "@/lib/scrape/lookup";

export {
  readLookupResults,
  toAppMetadata,
  toRatingSnapshot,
  toVersionRelease,
} from "@/lib/scrape/map";

export { withLookupRetry } from "@/lib/scrape/retry";

export {
  categoryFeedUrl,
  CHART_LIMIT,
  fetchChart,
  marketingFeedUrl,
  trackIdsFromLegacy,
  trackIdsFromMarketing,
} from "@/lib/scrape/rss";

export type { ChartHit } from "@/lib/scrape/rss";

export {
  insertCharts,
  insertRatings,
  insertVersions,
  upsertApps,
} from "@/lib/scrape/upsert";
