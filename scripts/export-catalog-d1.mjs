import { writeFileSync } from "node:fs";

import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/catalog.sqlite", {
  readOnly: true,
});

function sqlValue(value) {
  if (value == null) {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table, columns, rows, batchSize = 20) {
  const lines = [
    `create table if not exists ${table} (${columns.map((column) => `${column.name} ${column.type}`).join(", ")});`,
  ];

  const names = columns.map((column) => column.name);

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);

    const values = batch.map((row) => (
      `(${names.map((name) => sqlValue(row[name])).join(", ")})`
    ));

    lines.push(
      `insert or replace into ${table} (${names.join(", ")}) values ${values.join(", ")};`,
    );
  }

  return lines;
}

if (process.argv.includes("icons")) {
  const icons = db.prepare(`
    select track_id, tier, method, model, vector
    from icon_embeddings
  `).all();

  const encoded = icons.map((row) => ({
    track_id: row.track_id,
    tier: row.tier,
    method: row.method,
    model: row.model,
    vector: Buffer.from(row.vector).toString("base64"),
  }));

  const sql = insert("icon_embeddings", [
    { name: "track_id", type: "integer primary key" },
    { name: "tier", type: "text" },
    { name: "method", type: "text" },
    { name: "model", type: "text" },
    { name: "vector", type: "text" },
  ], encoded, 10).join("\n");

  writeFileSync("/tmp/catalog-icons.sql", sql);

  console.log("icons", encoded.length, "bytes", sql.length);

  process.exit(0);
}

const vectorsOnly = process.argv.includes("vectors");

if (vectorsOnly) {
  const texts = db.prepare(`
    select track_id, tier, method, model, vector
    from text_embeddings
  `).all();

  const tags = db.prepare(`
    select track_id, tag_id, tier, method
    from app_tags
  `).all();

  const signals = db.prepare(`
    select track_id, tier, method, color_text, colors, letters
    from icon_signals
  `).all();

  const revenue = db.prepare(`
    select
      track_id,
      captured_on,
      country,
      basis,
      rank,
      chart,
      genre_id,
      low_usd,
      mid_usd,
      high_usd,
      tier,
      method
    from revenue_estimates
  `).all();

  const encoded = texts.map((row) => ({
    track_id: row.track_id,
    tier: row.tier,
    method: row.method,
    model: row.model,
    vector: Buffer.from(row.vector).toString("base64"),
  }));

  const sql = [
    ...insert("text_embeddings", [
      { name: "track_id", type: "integer primary key" },
      { name: "tier", type: "text" },
      { name: "method", type: "text" },
      { name: "model", type: "text" },
      { name: "vector", type: "text" },
    ], encoded),
    "create table if not exists app_tags (track_id integer, tag_id text, tier text, method text, primary key (track_id, tag_id));",
    ...insert("app_tags", [
      { name: "track_id", type: "integer" },
      { name: "tag_id", type: "text" },
      { name: "tier", type: "text" },
      { name: "method", type: "text" },
    ], tags).slice(1),
    ...insert("icon_signals", [
      { name: "track_id", type: "integer primary key" },
      { name: "tier", type: "text" },
      { name: "method", type: "text" },
      { name: "color_text", type: "text" },
      { name: "colors", type: "text" },
      { name: "letters", type: "text" },
    ], signals),
    "create table if not exists revenue_estimates (track_id integer, captured_on text, country text, basis text, rank integer, chart text, genre_id integer, low_usd real, mid_usd real, high_usd real, tier text, method text, primary key (track_id, captured_on, country, chart, genre_id));",
    ...insert("revenue_estimates", [
      { name: "track_id", type: "integer" },
      { name: "captured_on", type: "text" },
      { name: "country", type: "text" },
      { name: "basis", type: "text" },
      { name: "rank", type: "integer" },
      { name: "chart", type: "text" },
      { name: "genre_id", type: "integer" },
      { name: "low_usd", type: "real" },
      { name: "mid_usd", type: "real" },
      { name: "high_usd", type: "real" },
      { name: "tier", type: "text" },
      { name: "method", type: "text" },
    ], revenue).slice(1),
  ].join("\n");

  writeFileSync("/tmp/catalog-vectors.sql", sql);

  console.log(
    "vectors",
    encoded.length,
    "tags",
    tags.length,
    "signals",
    signals.length,
    "revenue",
    revenue.length,
    "bytes",
    sql.length,
  );

  process.exit(0);
}

const apps = db.prepare("select * from apps").all();

const ratings = db.prepare("select * from rating_snapshots").all();

const charts = db.prepare("select * from chart_snapshots").all();

const sql = [
  ...insert("apps", [
    { name: "track_id", type: "integer primary key" },
    { name: "tier", type: "text" },
    { name: "bundle_id", type: "text" },
    { name: "name", type: "text" },
    { name: "description", type: "text" },
    { name: "seller_name", type: "text" },
    { name: "icon_url", type: "text" },
    { name: "screenshot_urls", type: "text" },
    { name: "primary_genre_id", type: "integer" },
    { name: "primary_genre", type: "text" },
    { name: "genre_ids", type: "text" },
    { name: "genres", type: "text" },
    { name: "price", type: "real" },
    { name: "currency", type: "text" },
    { name: "formatted_price", type: "text" },
    { name: "store_url", type: "text" },
    { name: "version", type: "text" },
    { name: "release_date", type: "text" },
    { name: "current_version_release_date", type: "text" },
    { name: "content_advisory_rating", type: "text" },
    { name: "metadata_fetched_at", type: "text" },
    { name: "delisted", type: "integer" },
  ], apps),
  ...insert("rating_snapshots", [
    { name: "track_id", type: "integer" },
    { name: "tier", type: "text" },
    { name: "captured_on", type: "text" },
    { name: "captured_at", type: "text" },
    { name: "rating_average", type: "real" },
    { name: "rating_count", type: "integer" },
  ], ratings),
  "create index if not exists rating_snapshots_track on rating_snapshots (track_id, captured_at);",
  ...insert("chart_snapshots", [
    { name: "track_id", type: "integer" },
    { name: "tier", type: "text" },
    { name: "captured_on", type: "text" },
    { name: "captured_at", type: "text" },
    { name: "country", type: "text" },
    { name: "chart", type: "text" },
    { name: "genre_id", type: "integer" },
    { name: "rank", type: "integer" },
  ], charts),
  "create index if not exists chart_snapshots_track on chart_snapshots (track_id, captured_at);",
].join("\n");

writeFileSync("/tmp/catalog-d1.sql", sql);

console.log("apps", apps.length, "ratings", ratings.length, "charts", charts.length, "bytes", sql.length);
