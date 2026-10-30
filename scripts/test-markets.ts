import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { cloudCatalog, loadCloudDetail } from "../lib/catalog/cloud";
import { CATALOG_INDEXES, insertJsonSql } from "../lib/catalog/d1-sync-sql";
import { emptyPacked, nominateIds, packVectors, prepareCatalogApps } from "../lib/catalog/rank";
import { CatalogRank } from "../lib/catalog/rank-do";
import { deepenCandidates } from "../lib/catalog/vectors";
import { TEXT_MODEL, encodeVector } from "../lib/catalog/rank";
import { parseMarket } from "../lib/markets";
import type { SiteSql } from "../lib/site/types";
import type { D1Database, D1Prepared } from "../lib/site/d1";
import type { SqlValue } from "../lib/site/types";
import { POST as queryPost } from "../app/api/query/route";
import { GET as appGet } from "../app/api/app/[trackId]/route";

async function main() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("models/schema.sql", "utf8"));
  for (const statement of CATALOG_INDEXES) db.exec(statement);
  const sql: SiteSql = {
    async exec(statement) { db.exec(statement); },
    async all<T>(statement: string, params = []) { return db.prepare(statement).all(...params) as T[]; },
    async get<T>(statement: string, params = []) { return db.prepare(statement).get(...params) as T | undefined; },
    async run(statement, params = []) {
      return Number((db.prepare(statement).run(...params) as { changes: number }).changes);
    },
  };
  const largeId = 6_812_962_842;
  const app = (track_id: number, name: string) => ({
    track_id, name, tier: "verified", bundle_id: `app.${track_id}`,
    description: "Notes for work", seller_name: "Example", icon_url: "https://example.com/icon.png",
    screenshot_urls: "[]", primary_genre_id: 6007, primary_genre: "Productivity",
    genre_ids: "[6007]", genres: '["Productivity"]', price: 0, currency: "USD",
    formatted_price: "Free", store_url: `https://apps.apple.com/us/app/id${track_id}`,
    version: "1", release_date: "2026-01-01", current_version_release_date: "2026-10-01",
    content_advisory_rating: "4+", metadata_fetched_at: "2026-10-30T00:00:00Z", delisted: 0,
  });
  db.prepare(insertJsonSql("apps")).run(JSON.stringify([app(1, "US Only Notes"), app(largeId, "Japan Notes")]));
  db.prepare(insertJsonSql("market_apps")).run(JSON.stringify([
    { country: "us", track_id: 1, first_seen_on: "2026-10-30", last_seen_on: "2026-10-30" },
    { country: "jp", track_id: largeId, first_seen_on: "2026-10-30", last_seen_on: "2026-10-30" },
  ]));
  db.prepare(insertJsonSql("market_metadata")).run(JSON.stringify([{
    country: "jp", track_id: largeId, name: "ノート", description: "日本のメモアプリ",
    icon_url: "https://example.com/jp.png", store_url: `https://apps.apple.com/jp/app/id${largeId}`,
    formatted_price: "無料", currency: "JPY", rating_average: 4.8, rating_count: 42,
    metadata_fetched_at: "2026-10-30T00:00:00Z",
  }]));
  db.prepare(insertJsonSql("chart_snapshots")).run(JSON.stringify(["us", "jp"].map((country) => ({
    track_id: largeId, country, tier: "verified", captured_on: "2026-10-30",
    captured_at: "2026-10-30T00:00:00Z", chart: "top-free", genre_id: 0, rank: 1,
  }))));
  db.prepare(insertJsonSql("rating_snapshots")).run(JSON.stringify([{
    track_id: largeId, tier: "verified", captured_on: "2026-10-30",
    captured_at: "2026-10-30T00:00:00Z", rating_average: 3, rating_count: 999,
  }]));
  db.prepare("insert into revenue_estimates (track_id,captured_on,country,basis,rank,chart,genre_id,low_usd,mid_usd,high_usd,tier,method) values (?, '2026-10-30', 'us', 'overall-grossing', 1, 'top-grossing', 0, 100, 200, 300, 'estimated', 'test')").run(largeId);
  for (const id of [1, largeId]) {
    db.prepare("insert into app_tags (track_id,tag_id,tier,method) values (?, 'notes', 'estimated', 'test')").run(id);
  }

  const us = cloudCatalog(sql, "us");
  const jp = cloudCatalog(sql, "jp");
  assert.equal((await us.findByName("US Only Notes"))?.trackId, 1);
  assert.equal(await jp.findByName("US Only Notes"), null);
  assert.equal((await jp.findByName("ノート"))?.trackId, largeId);
  assert.deepEqual((await jp.charts(largeId)).map((row) => row.country), ["jp"]);
  assert.equal((await jp.ratings(largeId))[0]?.ratingCount, 42);
  assert.equal((await jp.ranked())[0]?.app.name, "ノート");
  assert.deepEqual((await jp.finalists("メモ")).map((row) => row.trackId), [largeId]);
  assert.deepEqual((await deepenCandidates(sql, [], ["notes"], "jp")).map((row) => row.trackId), [largeId]);
  const detail = await loadCloudDetail(sql, largeId, null, "jp");
  assert.equal(detail?.name, "ノート");
  assert.equal(detail?.currency, "JPY");
  assert.equal(detail?.rating.count, 42);
  assert.match(detail?.storeUrl ?? "", /\/jp\//);
  assert.equal(detail?.revenue.tier, "unavailable");
  assert.equal(await loadCloudDetail(sql, largeId, null, "us"), null);

  const apps = prepareCatalogApps([
    { trackId: 1, name: "US Notes", blurb: "notes", letters: "notes", tags: [] },
    { trackId: largeId, name: "ノート", blurb: "notes", letters: "notes", tags: [] },
  ]);
  const packed = packVectors(apps.map((row) => ({ trackId: row.trackId, vector: new Float32Array([1, 0]) })), 2);
  assert.equal(packed.ids[1], largeId);
  assert.deepEqual(nominateIds("notes", apps, new Float32Array([1, 0]), packed, null, emptyPacked(768), new Set([largeId])), [largeId]);
  assert.deepEqual(nominateIds("ノート", apps, new Float32Array(384), emptyPacked(384), null, emptyPacked(768), new Set([largeId])), [largeId]);
  assert.equal(parseMarket("JP"), "jp");
  assert.equal(parseMarket("xx"), null);
  assert.equal((await queryPost(new Request("https://app/api/query", {
    method: "POST", body: JSON.stringify({ query: "notes", market: "xx" }),
  }))).status, 400);
  assert.equal((await appGet(new Request("https://app/api/app/1?market=xx"), {
    params: Promise.resolve({ trackId: "1" }),
  })).status, 400);
  await checkRankerCache(db, largeId);
  db.close();
  console.log("market isolation checks passed");
}

async function checkRankerCache(db: DatabaseSync, largeId: number) {
  const vector = new Float32Array(384);
  vector[0] = 1;
  for (const id of [1, largeId]) {
    db.prepare("insert into text_embeddings (track_id,tier,method,model,source_hash,dims,vector,embedded_at) values (?, 'estimated', ?, ?, 'test', 384, ?, '2026-10-30')")
      .run(id, TEXT_MODEL, TEXT_MODEL, encodeVector(vector));
  }
  const d1: D1Database = {
    async exec(statement) { db.exec(statement); },
    prepare(statement) {
      let params: SqlValue[] = [];
      const prepared: D1Prepared = {
        bind(...values) { params = values; return prepared; },
        async all<T>() { return { results: db.prepare(statement).all(...params) as T[] }; },
        async first<T>() { return db.prepare(statement).get(...params) as T ?? null; },
        async run() { return { meta: { changes: Number((db.prepare(statement).run(...params) as { changes: number }).changes) } }; },
      };
      return prepared;
    },
  };
  const storage = new DatabaseSync(":memory:");
  let initial = Promise.resolve();
  const state = {
    storage: {
      sql: { exec(statement: string, ...bindings: unknown[]) {
        const params = bindings.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value);
        const prepared = storage.prepare(statement) as unknown as {
          all(...values: unknown[]): Record<string, unknown>[];
        };
        return prepared.all(...params);
      } },
      transactionSync(work: () => void) {
        storage.exec("begin");
        try { work(); storage.exec("commit"); } catch (error) { storage.exec("rollback"); throw error; }
      },
    },
    blockConcurrencyWhile(work: () => Promise<void>) { initial = work(); return initial; },
    waitUntil(_work: Promise<unknown>) {},
  };
  for (let load = 0; load < 2; load += 1) {
    const ranker = new CatalogRank(state, { CATALOG_DB: d1 });
    await initial;
    const response = await ranker.fetch(new Request("https://catalog/nominate", {
      method: "POST", body: JSON.stringify({ query: "ノート", text: encodeVector(vector), market: "jp" }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { ids: number[] }).ids, [largeId]);
  }
  storage.close();
}

void main();
