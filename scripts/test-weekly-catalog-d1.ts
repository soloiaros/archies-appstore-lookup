import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { jsonChunks } from "../lib/catalog/d1-sync";
import { CATALOG_INDEXES, insertJsonSql } from "../lib/catalog/d1-sync-sql";
import { assertFeedCoverage } from "../lib/scrape/coverage";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync("models/schema.sql", "utf8"));
// The deployed D1 vector table stores base64 text, unlike local SQLite blobs.
db.exec("drop table text_embeddings; create table text_embeddings (track_id integer primary key, tier text, method text, model text, vector text)");
for (const sql of CATALOG_INDEXES) db.exec(sql);

const app = {
  track_id: 123,
  tier: "verified",
  bundle_id: "com.example.notes",
  name: "Sam's Notes",
  description: "Notes for work",
  seller_name: "Sam",
  icon_url: "https://example.com/icon.png",
  screenshot_urls: "[]",
  primary_genre_id: 6007,
  primary_genre: "Productivity",
  genre_ids: "[6007]",
  genres: '["Productivity"]',
  price: 0,
  currency: "USD",
  formatted_price: "Free",
  store_url: "https://apps.apple.com/app/id123",
  version: "1.0",
  release_date: "2026-10-01",
  current_version_release_date: "2026-10-01",
  content_advisory_rating: "4+",
  metadata_fetched_at: "2026-10-29T00:00:00Z",
  delisted: 0,
};

const writeApp = db.prepare(insertJsonSql("apps"));
assert.equal(changes(writeApp.run(JSON.stringify([app]))), 1);
assert.equal(changes(writeApp.run(JSON.stringify([{ ...app, metadata_fetched_at: "2026-10-30T00:00:00Z" }]))), 0);
assert.equal((db.prepare("select metadata_fetched_at from apps").get() as { metadata_fetched_at: string }).metadata_fetched_at, app.metadata_fetched_at);
assert.equal(changes(writeApp.run(JSON.stringify([{ ...app, name: "Sam's New Notes" }]))), 1);
assert.equal((db.prepare("select name from apps").get() as { name: string }).name, "Sam's New Notes");

const chart = {
  track_id: 123, tier: "verified", captured_on: "2026-10-29",
  captured_at: "2026-10-29T00:00:00Z", country: "us",
  chart: "top-free", genre_id: 0, rank: 2,
};
const writeChart = db.prepare(insertJsonSql("chart_snapshots"));
assert.equal(changes(writeChart.run(JSON.stringify([chart]))), 1);
assert.equal(changes(writeChart.run(JSON.stringify([chart]))), 0);
assert.equal(changes(writeChart.run(JSON.stringify([{ ...chart, rank: 1 }]))), 1);
assert.equal((db.prepare("select count(*) as n from chart_snapshots").get() as { n: number }).n, 1);
assert.equal((db.prepare("select rank from chart_snapshots").get() as { rank: number }).rank, 1);

const rating = {
  track_id: 123, tier: "verified", captured_on: "2026-10-29",
  captured_at: "2026-10-29T00:00:00Z", rating_average: 4.5, rating_count: 100,
};
const writeRating = db.prepare(insertJsonSql("rating_snapshots"));
assert.equal(changes(writeRating.run(JSON.stringify([rating]))), 1);
assert.equal(changes(writeRating.run(JSON.stringify([rating]))), 0);
assert.equal(changes(writeRating.run(JSON.stringify([{ ...rating, rating_count: 101 }]))), 1);

const vector = {
  track_id: 123, tier: "estimated", method: "bge", model: "bge", vector: "YWJj",
};
const writeVector = db.prepare(insertJsonSql("text_embeddings"));
assert.equal(changes(writeVector.run(JSON.stringify([vector]))), 1);
assert.equal(changes(writeVector.run(JSON.stringify([vector]))), 0);

assert.deepEqual(jsonChunks([{ x: 1 }, { x: 2 }, { x: 3 }], 2).map((chunk) => chunk.length), [2, 1]);
assert.throws(() => jsonChunks([{ x: "a".repeat(80_001) }]));

const feeds = [
  { chart: "top-free", genreId: null, hits: 100, error: null },
  { chart: "top-paid", genreId: null, hits: 100, error: null },
  { chart: "top-grossing", genreId: null, hits: 100, error: null },
];
assert.doesNotThrow(() => assertFeedCoverage(feeds, 1000));
assert.throws(() => assertFeedCoverage(feeds, 999));
assert.throws(() => assertFeedCoverage(feeds.map((feed) => ({ ...feed, error: "HTTP 500" })), 1000));
assert.throws(() => assertFeedCoverage(feeds.map((feed) =>
  feed.chart === "top-grossing" ? { ...feed, genreId: 6001 } : feed), 1000));
assert.throws(() => assertFeedCoverage([
  ...feeds,
  ...Array.from({ length: 2 }, () => ({
    chart: "top-free", genreId: 6001, hits: 0, error: "HTTP 500",
  })),
], 1000));

db.close();
console.log("weekly catalog D1 checks passed");

function changes(result: unknown): number {
  return Number((result as { changes: number }).changes);
}
