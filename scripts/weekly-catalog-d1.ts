import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { aggregateCharts } from "../lib/scrape/aggregate";
import { assertFeedCoverage, assertMarketCoverage } from "../lib/scrape/coverage";
import { dedupTrackIds } from "../lib/scrape/dedup";
import { lookupAll } from "../lib/scrape/lookup";
import { toAppMetadata, toRatingSnapshot } from "../lib/scrape/map";
import { BGE_DIMS, BGE_MODEL, embedDescriptions, encodeVector } from "../lib/pipeline/embed";
import { D1Sync, type D1Row } from "../lib/catalog/d1-sync";
import { CATALOG_INDEXES, insertJsonSql } from "../lib/catalog/d1-sync-sql";
import { DEFAULT_MARKET, MARKETS } from "../lib/markets";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const DATABASE_ID = process.env.CATALOG_D1_ID ?? "";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
const TEXT_BATCH = 8;

type ExistingApp = D1Row & {
  track_id: number;
  metadata_fetched_at: string;
};

type VectorId = D1Row & {
  track_id: number;
};

type CacheApp = D1Row & {
  track_id: number;
  description: string;
  metadata_fetched_at: string;
};

async function main(): Promise<void> {
  if (!TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is required; no D1 writes were attempted");
  }

  const d1 = new D1Sync(ACCOUNT_ID, DATABASE_ID, TOKEN);

  await d1.query("select 1 as ok");
  d1.assertBudget();

  for (const statement of CATALOG_INDEXES) {
    await d1.query(statement);
  }

  let changedRanking = false;

  if (process.argv.includes("--backfill-cache")) {
    changedRanking = await backfillCache(d1);
  }

  await seedUsMembership(d1);
  changedRanking = await syncCurrentCharts(d1) || changedRanking;
  changedRanking = await syncOtherMarkets(d1) || changedRanking;

  // Also repair a previous run that wrote rows but failed before publishing
  // its revision. Four weekly cache reloads are negligible compared with a
  // stale search index.
  await d1.query(
    "insert into catalog_meta (key, value) values ('rank_revision', ?) on conflict (key) do update set value = excluded.value",
    [randomUUID()],
  );

  console.log(JSON.stringify({ d1: d1.usage, rankingChanged: changedRanking }));
}

async function syncCurrentCharts(d1: D1Sync): Promise<boolean> {
  const country = DEFAULT_MARKET;
  const genreIds = readGenreIds();
  const collected = await aggregateCharts(country, genreIds);
  const chartIds = dedupTrackIds(collected.appearances.map((item) => item.trackId));
  assertFeedCoverage(collected.feeds, chartIds.length);

  const existingRows = await d1.all<ExistingApp>(
    "select track_id, metadata_fetched_at from apps where track_id > ? order by track_id limit ?",
  );
  const existing = new Set(existingRows.map((row) => Number(row.track_id)));
  const missing = chartIds.filter((id) => !existing.has(id));

  // All charted apps get a weekly rating snapshot. Historical, uncharted apps
  // are not looked up, so the job's work stays bounded by the current feeds.
  const found = await lookupAll(chartIds, country);
  const returned = new Set(found.map((app) => app.trackId));
  const unavailable = missing.filter((id) => !returned.has(id));

  if (missing.length > 0 && unavailable.length > Math.max(20, missing.length * 0.15)) {
    throw new Error(`Apple Lookup omitted ${unavailable.length}/${missing.length} new chart apps`);
  }

  const at = new Date().toISOString();
  const on = at.slice(0, 10);
  const metadata = found.map((app) => toAppMetadata(app, at));
  const appRows = metadata.map(toAppRow);
  const allowed = new Set([...existing, ...returned]);
  const chartRows = collected.appearances
    .filter((item) => allowed.has(item.trackId))
    .map((item) => ({
      track_id: item.trackId,
      tier: "verified",
      captured_on: on,
      captured_at: at,
      country: item.country,
      chart: item.chart,
      genre_id: item.genreId ?? 0,
      rank: item.rank,
    }));
  const ratingRows = found.flatMap((app) => {
    const rating = toRatingSnapshot(app, at);
    return rating ? [{
      track_id: rating.trackId,
      tier: "verified",
      captured_on: on,
      captured_at: at,
      rating_average: rating.ratingAverage,
      rating_count: rating.ratingCount,
    }] : [];
  });

  // Query only the descriptions that might need a replacement embedding.
  const oldDescriptions = await descriptionsFor(d1, found.map((app) => app.trackId));
  const vectorRows = await d1.all<VectorId>(
    "select track_id from text_embeddings where track_id > ? order by track_id limit ?",
  );
  const vectorIds = new Set(vectorRows.map((row) => Number(row.track_id)));
  const toEmbed = metadata.filter((app) =>
    !existing.has(app.trackId)
    || !vectorIds.has(app.trackId)
    || oldDescriptions.get(app.trackId) !== app.description);
  const vectors = await embedRows(toEmbed.map((app) => ({
    track_id: app.trackId,
    description: app.description,
  })));

  const appWrites = await d1.writeRows(insertJsonSql("apps"), appRows);
  const vectorWrites = await d1.writeRows(insertJsonSql("text_embeddings"), vectors);
  await d1.writeRows(insertJsonSql("market_apps"), found.map((app) => ({
    country,
    track_id: app.trackId,
    first_seen_on: on,
    last_seen_on: on,
  })));
  await d1.writeRows(insertJsonSql("rating_snapshots"), ratingRows);
  await d1.writeRows(insertJsonSql("chart_snapshots"), chartRows);

  const check = await d1.query<{ apps: number; chart_rows: number; newest: string }>(
    "select (select count(*) from apps) as apps, (select count(*) from chart_snapshots where captured_on = ?) as chart_rows, (select max(captured_on) from chart_snapshots) as newest",
    [on],
  );

  if (Number(check[0]?.apps) < existing.size + missing.length - unavailable.length
    || Number(check[0]?.chart_rows) < chartRows.length * 0.95
    || check[0]?.newest !== on) {
    throw new Error(`Production D1 verification failed: ${JSON.stringify(check[0])}`);
  }

  console.log(JSON.stringify({
    date: on,
    feeds: collected.feeds.length,
    failedFeeds: collected.feeds.filter((feed) => feed.error).length,
    chartIds: chartIds.length,
    newApps: missing.length - unavailable.length,
    appRows: appRows.length,
    appWrites,
    textVectors: vectors.length,
    ratings: ratingRows.length,
    charts: chartRows.length,
    verified: check[0],
  }));

  return appWrites > 0 || vectorWrites > 0;
}

async function seedUsMembership(d1: D1Sync): Promise<void> {
  const marker = await d1.query<{ value: string }>(
    "select value from catalog_meta where key = 'us_membership_seeded'",
  );
  if (marker[0]?.value === "1") return;

  const rows = await d1.all<ExistingApp>(
    "select track_id, metadata_fetched_at from apps where track_id > ? order by track_id limit ?",
  );
  const on = new Date().toISOString().slice(0, 10);
  await d1.writeRows(insertJsonSql("market_apps"), rows.map((row) => ({
    country: DEFAULT_MARKET,
    track_id: Number(row.track_id),
    first_seen_on: on,
    last_seen_on: on,
  })));
  await d1.query(
    "insert into catalog_meta (key, value) values ('us_membership_seeded', '1') on conflict (key) do update set value = '1'",
  );
  console.log(JSON.stringify({ seededUsMembership: rows.length }));
}

async function syncOtherMarkets(d1: D1Sync): Promise<boolean> {
  const existing = new Set((await d1.all<ExistingApp>(
    "select track_id, metadata_fetched_at from apps where track_id > ? order by track_id limit ?",
  )).map((row) => Number(row.track_id)));
  const vectorIds = new Set((await d1.all<VectorId>(
    "select track_id from text_embeddings where track_id > ? order by track_id limit ?",
  )).map((row) => Number(row.track_id)));
  let changed = false;

  for (const { code: country } of MARKETS) {
    if (country === DEFAULT_MARKET) continue;

    const collected = await aggregateCharts(country, []);
    const chartIds = dedupTrackIds(collected.appearances.map((item) => item.trackId));
    assertMarketCoverage(collected.feeds, chartIds.length);

    const found = await lookupAll(chartIds, country);
    const returned = new Set(found.map((app) => app.trackId));
    const unavailable = chartIds.filter((id) => !returned.has(id));
    if (unavailable.length > Math.max(10, chartIds.length * 0.15)) {
      throw new Error(`Apple Lookup omitted ${unavailable.length}/${chartIds.length} ${country} chart apps`);
    }

    const at = new Date().toISOString();
    const on = at.slice(0, 10);
    const newApps = found.filter((app) => !existing.has(app.trackId));
    const toEmbed = found.filter((app) => !vectorIds.has(app.trackId));
    const vectors = await embedRows(toEmbed.map((app) => ({
      track_id: app.trackId,
      description: app.description,
    })));
    const appWrites = await d1.writeRows(insertJsonSql("apps"),
      newApps.map((app) => toAppRow(toAppMetadata(app, at))));
    const vectorWrites = await d1.writeRows(insertJsonSql("text_embeddings"), vectors);
    const metadataWrites = await d1.writeRows(insertJsonSql("market_metadata"),
      found.map((app) => ({
        country,
        track_id: app.trackId,
        name: app.trackName,
        description: app.description,
        icon_url: app.artworkUrl,
        store_url: app.trackViewUrl,
        formatted_price: app.formattedPrice,
        currency: app.currency,
        rating_average: app.averageUserRating,
        rating_count: app.userRatingCount,
        metadata_fetched_at: at,
      })));
    const membershipWrites = await d1.writeRows(insertJsonSql("market_apps"),
      found.map((app) => ({
        country,
        track_id: app.trackId,
        first_seen_on: on,
        last_seen_on: on,
      })));
    const charts = collected.appearances
      .filter((item) => returned.has(item.trackId))
      .map((item) => ({
        track_id: item.trackId,
        tier: "verified",
        captured_on: on,
        captured_at: at,
        country,
        chart: item.chart,
        genre_id: 0,
        rank: item.rank,
      }));
    await d1.writeRows(insertJsonSql("chart_snapshots"), charts);

    for (const app of newApps) existing.add(app.trackId);
    for (const app of toEmbed) vectorIds.add(app.trackId);

    const check = await d1.query<{ members: number; chart_rows: number }>(
      "select (select count(*) from market_apps where country = ?) as members, (select count(*) from chart_snapshots where country = ? and captured_on = ?) as chart_rows",
      [country, country, on],
    );
    if (Number(check[0]?.members) < returned.size
      || Number(check[0]?.chart_rows) < charts.length * 0.95) {
      throw new Error(`${country} D1 verification failed: ${JSON.stringify(check[0])}`);
    }

    changed ||= appWrites > 0 || vectorWrites > 0
      || metadataWrites > 0 || membershipWrites > 0;
    console.log(JSON.stringify({
      market: country,
      chartIds: chartIds.length,
      newApps: newApps.length,
      textVectors: vectors.length,
      charts: charts.length,
      verified: check[0],
    }));
  }

  return changed;
}

async function backfillCache(d1: D1Sync): Promise<boolean> {
  const path = "data/catalog.sqlite";
  if (!existsSync(path)) throw new Error("Backfill cache was not restored");
  const cache = new DatabaseSync(path);

  try {
    const existingRows = await d1.all<ExistingApp>(
      "select track_id, metadata_fetched_at from apps where track_id > ? order by track_id limit ?",
    );
    const existing = new Map(existingRows.map((row) => [
      Number(row.track_id), String(row.metadata_fetched_at ?? ""),
    ]));
    const apps = cache.prepare("select * from apps order by track_id").all() as CacheApp[];
    const pending = apps.filter((app) =>
      !existing.has(Number(app.track_id))
      || app.metadata_fetched_at > (existing.get(Number(app.track_id)) ?? ""));

    const remoteVectors = new Set((await d1.all<VectorId>(
      "select track_id from text_embeddings where track_id > ? order by track_id limit ?",
    )).map((row) => Number(row.track_id)));
    const cachedVectors = cache.prepare(
      "select track_id, tier, method, model, vector from text_embeddings where model = ?",
    ).all(BGE_MODEL) as Array<D1Row & { track_id: number; vector: Uint8Array }>;
    const vectorRows = cachedVectors
      .filter((row) => !remoteVectors.has(Number(row.track_id)))
      .map((row) => ({
        track_id: row.track_id,
        tier: row.tier,
        method: row.method,
        model: row.model,
        vector: Buffer.from(row.vector).toString("base64"),
      }));
    const cachedVectorIds = new Set(cachedVectors.map((row) => Number(row.track_id)));
    const toEmbed = apps.filter((app) =>
      !remoteVectors.has(Number(app.track_id))
      && !cachedVectorIds.has(Number(app.track_id)));

    const appWrites = await d1.writeRows(insertJsonSql("apps"), pending);
    let vectorWrites = await d1.writeRows(insertJsonSql("text_embeddings"), vectorRows);

    for (let index = 0; index < toEmbed.length; index += 80) {
      const batch = await embedRows(toEmbed.slice(index, index + 80));
      vectorWrites += await d1.writeRows(insertJsonSql("text_embeddings"), batch);
      console.log(`backfill text ${Math.min(index + 80, toEmbed.length)}/${toEmbed.length}`);
    }

    const dates = cache.prepare(
      "select max(captured_on) as captured_on from chart_snapshots group by strftime('%Y-%W', captured_on) order by captured_on",
    ).all() as Array<{ captured_on: string }>;
    let chartRows = 0;
    let ratingRows = 0;

    for (const { captured_on: on } of dates) {
      const charts = cache.prepare(
        "select track_id, tier, captured_on, captured_at, country, chart, genre_id, rank from chart_snapshots where captured_on = ?",
      ).all(on) as D1Row[];
      const ratings = cache.prepare(
        "select track_id, tier, captured_on, captured_at, rating_average, rating_count from rating_snapshots where captured_on = ?",
      ).all(on) as D1Row[];
      await d1.writeRows(insertJsonSql("chart_snapshots"), charts);
      await d1.writeRows(insertJsonSql("rating_snapshots"), ratings);
      chartRows += charts.length;
      ratingRows += ratings.length;
    }

    console.log(JSON.stringify({
      backfillApps: pending.length,
      backfillAppWrites: appWrites,
      backfillCachedVectors: vectorRows.length,
      backfillNewVectors: toEmbed.length,
      backfillChartRows: chartRows,
      backfillRatingRows: ratingRows,
    }));

    return appWrites > 0 || vectorWrites > 0;
  } finally {
    cache.close();
  }
}

async function descriptionsFor(d1: D1Sync, ids: number[]): Promise<Map<number, string>> {
  const descriptions = new Map<number, string>();
  for (let index = 0; index < ids.length; index += 80) {
    const chunk = ids.slice(index, index + 80);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await d1.query<D1Row & { track_id: number; description: string }>(
      `select track_id, description from apps where track_id in (${placeholders})`,
      chunk.map(String),
    );
    for (const row of rows) descriptions.set(Number(row.track_id), String(row.description ?? ""));
  }
  return descriptions;
}

async function embedRows(apps: Array<{ track_id: number; description: string }>): Promise<D1Row[]> {
  const rows: D1Row[] = [];
  for (let index = 0; index < apps.length; index += TEXT_BATCH) {
    const chunk = apps.slice(index, index + TEXT_BATCH);
    const vectors = await embedDescriptions(chunk.map((app) => app.description));
    for (let offset = 0; offset < chunk.length; offset += 1) {
      const vector = vectors[offset];
      if (!vector || vector.length !== BGE_DIMS) throw new Error("Text embedding dimensions changed");
      rows.push({
        track_id: chunk[offset].track_id,
        tier: "estimated",
        method: BGE_MODEL,
        model: BGE_MODEL,
        vector: Buffer.from(encodeVector(vector)).toString("base64"),
      });
    }
  }
  return rows;
}

function toAppRow(app: ReturnType<typeof toAppMetadata>): D1Row {
  return {
    track_id: app.trackId,
    tier: app.tier,
    bundle_id: app.bundleId,
    name: app.name,
    description: app.description,
    seller_name: app.sellerName,
    icon_url: app.iconUrl,
    screenshot_urls: JSON.stringify(app.screenshotUrls),
    primary_genre_id: app.primaryGenreId,
    primary_genre: app.primaryGenre,
    genre_ids: JSON.stringify(app.genreIds),
    genres: JSON.stringify(app.genres),
    price: app.price,
    currency: app.currency,
    formatted_price: app.formattedPrice,
    store_url: app.storeUrl,
    version: app.version,
    release_date: app.releaseDate,
    current_version_release_date: app.currentVersionReleaseDate,
    content_advisory_rating: app.contentAdvisoryRating,
    metadata_fetched_at: app.metadataFetchedAt,
    delisted: app.delisted ? 1 : 0,
  };
}

function readGenreIds(): number[] {
  const taxonomy = JSON.parse(readFileSync("data/categories/taxonomy.json", "utf8")) as {
    genres?: Array<{ id?: number }>;
  };
  const ids = taxonomy.genres?.map((genre) => genre.id)
    .filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0) ?? [];
  if (ids.length < 20) throw new Error("Category taxonomy is incomplete");
  return ids;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "weekly catalog sync failed");
  process.exitCode = 1;
});
