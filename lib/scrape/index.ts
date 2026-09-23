export {
  dedupChartHits,
  dedupTrackIds,
} from "@/lib/scrape/dedup";

export {
  flagDelisted,
  isDelisted,
} from "@/lib/scrape/delist";

export {
  aggregateCharts,
  chartFeedJobs,
  CHART_GAP_MS,
} from "@/lib/scrape/aggregate";

export type {
  ChartAppearance,
  ChartCollection,
  FeedReport,
} from "@/lib/scrape/aggregate";

export {
  chunkTrackIds,
  LOOKUP_BATCH_SIZE,
  LOOKUP_GAP_MS,
  lookupAll,
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

export {
  sleep,
  withHttpRetry,
} from "@/lib/scrape/retry";

export {
  categoryFeedUrl,
  CHART_LIMIT,
  fetchChart,
  marketingFeedUrl,
  trackIdsFromLegacy,
  trackIdsFromMarketing,
} from "@/lib/scrape/rss";

export type {
  ChartHit,
  ChartSource,
} from "@/lib/scrape/rss";

export {
  catalogCounts,
  listTrackIds,
  openCatalog,
  upsertObserved,
} from "@/lib/scrape/store";

export type { CatalogCounts } from "@/lib/scrape/store";
