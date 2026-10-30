import type { D1Database } from "../site/d1";
import { DEFAULT_MARKET, MARKETS, parseMarket, type MarketCode } from "../markets";

import {
  ICON_DIMS,
  ICON_MODEL,
  TEXT_DIMS,
  TEXT_MODEL,
  decodeVector,
  emptyPacked,
  floatsFromBytes,
  nominateIds,
  packVectors,
  prepareCatalogApps,
  type CatalogApp,
  type PackedVectors,
} from "./rank";

const SHARDS = 4;

const TEXT_PAGE = 400;

const ICON_PAGE = 120;

const APP_PAGE = 500;

const REVISION_CHECK_MS = 5 * 60 * 1000;
const CACHE_FORMAT = "market-safe-ids-q8-1";

type SqlRow = Record<string, unknown>;

type SqlCursor = Iterable<SqlRow> & {
  toArray?: () => SqlRow[];
};

type DoSql = {
  exec(query: string, ...bindings: unknown[]): SqlCursor;
};

type RankState = {
  storage: {
    sql: DoSql;

    transactionSync(work: () => void): void;
  };

  blockConcurrencyWhile(work: () => Promise<void>): Promise<void>;

  waitUntil(work: Promise<unknown>): void;
};

type RankEnv = {
  CATALOG_DB?: D1Database;
};

type Memory = {
  text: PackedVectors;

  icons: PackedVectors;

  apps: CatalogApp[];

  markets: Map<MarketCode, Set<number>>;

  localized: Map<MarketCode, CatalogApp[]>;
};

type VectorRow = {
  trackId: number;

  vector: Float32Array;
};

function isRankRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export class CatalogRank {
  private memory: Memory | null = null;

  private nextRevisionCheck = Date.now() + REVISION_CHECK_MS;

  private refreshing: Promise<void> | null = null;

  constructor(
    private readonly state: RankState,
    private readonly env: RankEnv,
  ) {
    this.state.blockConcurrencyWhile(() => this.ensure());
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;

    try {
      await this.ensure();
    } catch (error) {
      console.error("catalog rank", error);

      return Response.json(
        { ok: false },
        { status: 500 },
      );
    }

    if (!this.memory || this.memory.text.ids.length === 0) {
      return Response.json(
        { ok: false },
        { status: 500 },
      );
    }

    this.refreshInBackground();

    if (path !== "/nominate" || request.method !== "POST") {
      return new Response(null, { status: 404 });
    }

    const body = await request.json() as {
      query?: string;

      text?: string;

      icon?: string | null;

      market?: unknown;
    };

    if (!body.query || !body.text) {
      return Response.json(
        { ok: false },
        { status: 400 },
      );
    }

    const market = parseMarket(body.market ?? DEFAULT_MARKET);
    if (!market) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const asking = decodeVector(body.text, TEXT_DIMS * 4);

    if (!asking) {
      return Response.json(
        { ok: false },
        { status: 400 },
      );
    }

    const looking = body.icon
      ? decodeVector(body.icon, ICON_DIMS * 4)
      : null;

    const ids = nominateIds(
      body.query,
      this.memory.localized.get(market) ?? this.memory.apps,
      asking,
      this.memory.text,
      looking,
      this.memory.icons,
      this.memory.markets.get(market) ?? new Set<number>(),
    );

    return Response.json({
      ok: true,
      ids,
    });
  }

  private refreshInBackground(): void {
    if (this.refreshing || Date.now() < this.nextRevisionCheck) {
      return;
    }

    this.nextRevisionCheck = Date.now() + REVISION_CHECK_MS;

    const refresh = (async () => {
      const stamp = await this.liveStamp();

      if (stamp && stamp !== this.savedStamp()) {
        this.memory = await this.fill(stamp);
      }
    })().catch((error: unknown) => {
      console.error("catalog rank refresh", error);
    }).finally(() => {
      this.refreshing = null;
    });

    this.refreshing = refresh;
    this.state.waitUntil(refresh);
  }

  private async ensure(): Promise<void> {
    if (this.memory && this.memory.text.ids.length > 0) {
      return;
    }

    this.migrate();

    const stamp = await this.liveStamp();

    const saved = this.savedStamp();

    if (stamp && saved === stamp) {
      const loaded = this.readMemory();

      if (loaded && this.matches(loaded, stamp)) {
        this.memory = loaded;

        return;
      }
    }

    if (!stamp) {
      const loaded = this.readMemory();

      if (loaded && loaded.text.ids.length > 0) {
        this.memory = loaded;

        return;
      }

      throw new Error("catalog unread");
    }

    this.memory = await this.fill(stamp);
  }

  private matches(loaded: Memory, stamp: string): boolean {
    if (stamp.startsWith("v:")) {
      return loaded.text.ids.length > 0;
    }

    const [text, icon, apps] = stamp.split(":").map(Number);

    return loaded.text.ids.length === text
      && loaded.icons.ids.length === icon
      && loaded.apps.length === apps;
  }

  private async liveStamp(): Promise<string | null> {
    const db = this.env.CATALOG_DB;

    if (!db) {
      return null;
    }

    try {
      const rows = await d1All<{ value: string }>(
        db,
        "select value from catalog_meta where key = 'rank_revision'",
      );

      const revision = rows[0]?.value;

      if (isRankRevision(revision)) {
        return `v:${revision}`;
      }
    } catch {
      // Existing catalog databases may not have catalog_meta yet.
    }

    const [text, apps, icon, tags] = await Promise.all([
      this.count(
        db,
        `
        select count(*) as n
        from text_embeddings
        where model = ?
        `,
        [TEXT_MODEL],
      ),
      this.count(
        db,
        `
        select count(*) as n
        from apps
        `,
      ),
      this.count(
        db,
        `
        select count(*) as n
        from icon_embeddings
        where model = ?
        `,
        [ICON_MODEL],
      ),
      this.count(
        db,
        `
        select count(*) as n
        from app_tags
        `,
      ),
    ]);

    if (text === null || apps === null || text === 0) {
      return null;
    }

    const legacyStamp = `${text}:${icon ?? 0}:${apps}:${tags ?? 0}`;

    try {
      await db.exec("create table if not exists catalog_meta (key text primary key, value text not null)");

      await db.prepare(
        "insert or ignore into catalog_meta (key, value) values ('rank_revision', ?)",
      ).bind(crypto.randomUUID()).run();

      const rows = await d1All<{ value: string }>(
        db,
        "select value from catalog_meta where key = 'rank_revision'",
      );

      if (isRankRevision(rows[0]?.value)) {
        return `v:${rows[0].value}`;
      }
    } catch {
      // Read-only catalog bindings can continue to use the old stamp.
    }

    return legacyStamp;
  }

  private async count(
    db: D1Database,
    query: string,
    params: Array<string | number | null> = [],
  ): Promise<number | null> {
    try {
      const rows = await d1All<{ n: number }>(db, query, params);

      return Number(rows[0]?.n ?? 0);
    } catch {
      return null;
    }
  }

  private async fill(stamp: string): Promise<Memory> {
    const text = packVectors(await this.loadVectors(
      "text_embeddings",
      TEXT_MODEL,
      TEXT_DIMS,
      TEXT_PAGE,
    ), TEXT_DIMS);

    const icons = packVectors(await this.loadVectors(
      "icon_embeddings",
      ICON_MODEL,
      ICON_DIMS,
      ICON_PAGE,
    ), ICON_DIMS);

    const apps = prepareCatalogApps(await this.loadApps());

    const markets = await this.loadMarkets();
    const localized = await this.loadLocalizedApps(apps);

    const expectedTags = Number(stamp.split(":")[3] ?? 0);

    const storedTags = apps.reduce(
      (sum, app) => sum + app.tags.length,
      0,
    );

    if (expectedTags > 0 && storedTags === 0) {
      throw new Error("catalog tags");
    }

    const memory = {
      text,
      icons,
      apps,
      markets,
      localized,
    };

    if (!this.matches(memory, stamp)) {
      throw new Error(`catalog short ${memory.text.ids.length} ${stamp}`);
    }

    this.persist(memory, stamp);

    return memory;
  }

  private async loadVectors(
    table: string,
    model: string,
    dims: number,
    page: number,
  ): Promise<VectorRow[]> {
    const db = this.env.CATALOG_DB;

    if (!db) {
      return [];
    }

    const shards = await Promise.all(
      Array.from({ length: SHARDS }, (_, shard) => (
        this.vectorShard(db, table, model, dims, page, shard)
      )),
    );

    return shards.flat();
  }

  private async vectorShard(
    db: D1Database,
    table: string,
    model: string,
    dims: number,
    page: number,
    shard: number,
  ): Promise<VectorRow[]> {
    const rows: VectorRow[] = [];

    let after = 0;

    for (;;) {
      const pageRows = await d1All<{
        trackId: number;

        vector: string;
      }>(
        db,
        `
        select track_id as trackId, vector
        from ${table}
        where model = ?
          and track_id > ?
          and (track_id % ${SHARDS}) = ?
        order by track_id
        limit ${page}
        `,
        [model, after, shard],
      );

      if (pageRows.length === 0) {
        break;
      }

      for (const row of pageRows) {
        const trackId = Number(row.trackId);

        const vector = decodeVector(
          String(row.vector ?? ""),
          dims * 4,
        );

        if (vector) {
          rows.push({ trackId, vector });
        }

        if (trackId <= after) {
          return rows;
        }

        after = trackId;
      }

      if (pageRows.length < page) {
        break;
      }
    }

    return rows;
  }

  private async loadApps(): Promise<CatalogApp[]> {
    const db = this.env.CATALOG_DB;

    if (!db) {
      return [];
    }

    const shards = await Promise.all(
      Array.from({ length: SHARDS }, (_, shard) => (
        this.appShard(db, shard)
      )),
    );

    const apps = shards.flat().sort(
      (left, right) => left.trackId - right.trackId,
    );

    const byId = new Map(apps.map((app) => [app.trackId, app]));

    const letters = await this.attachLetters(db, byId);

    if (!letters) {
      throw new Error("catalog letters");
    }

    const tags = await this.attachTags(db, byId);

    if (!tags) {
      throw new Error("catalog tags");
    }

    return apps;
  }

  private async loadMarkets(): Promise<Map<MarketCode, Set<number>>> {
    const db = this.env.CATALOG_DB;
    const markets = new Map<MarketCode, Set<number>>();
    if (!db) return markets;

    await Promise.all(MARKETS.map(async ({ code }) => {
      const ids = new Set<number>();
      let after = 0;
      for (;;) {
        const rows = await d1All<{ trackId: number }>(db, `
          select m.track_id as trackId
          from market_apps m join apps a on a.track_id = m.track_id
          where m.country = ? and m.track_id > ?
            and (m.country <> 'us' or a.delisted = 0)
          order by m.track_id
          limit ${APP_PAGE}
        `, [code, after]);
        for (const row of rows) {
          const id = Number(row.trackId);
          if (Number.isSafeInteger(id) && id > 0) ids.add(id);
          after = id;
        }
        if (rows.length < APP_PAGE) break;
      }
      markets.set(code, ids);
    }));

    return markets;
  }

  private async loadLocalizedApps(apps: CatalogApp[]): Promise<Map<MarketCode, CatalogApp[]>> {
    const db = this.env.CATALOG_DB;
    const localized = new Map<MarketCode, CatalogApp[]>();
    if (!db) return localized;
    const byId = new Map(apps.map((app) => [app.trackId, app]));
    await Promise.all(MARKETS.filter((market) => market.code !== DEFAULT_MARKET).map(async ({ code }) => {
      const list: CatalogApp[] = [];
      let after = 0;
      for (;;) {
        const rows = await d1All<{ trackId: number; name: string; blurb: string }>(db, `
          select track_id as trackId, name, substr(description, 1, 800) as blurb
          from market_metadata
          where country = ? and track_id > ?
          order by track_id limit ${APP_PAGE}
        `, [code, after]);
        for (const row of rows) {
          const id = Number(row.trackId);
          const shared = byId.get(id);
          if (shared) list.push({ ...shared, name: String(row.name), blurb: String(row.blurb) });
          after = id;
        }
        if (rows.length < APP_PAGE) break;
      }
      localized.set(code, prepareCatalogApps(list));
    }));
    return localized;
  }

  private async appShard(
    db: D1Database,
    shard: number,
  ): Promise<CatalogApp[]> {
    const apps: CatalogApp[] = [];

    let after = 0;

    for (;;) {
      const rows = await d1All<{
        trackId: number;

        name: string;

        blurb: string;
      }>(
        db,
        `
        select
          track_id as trackId,
          name,
          substr(description, 1, 800) as blurb
        from apps
        where track_id > ?
          and (track_id % ${SHARDS}) = ?
        order by track_id
        limit ${APP_PAGE}
        `,
        [after, shard],
      );

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const trackId = Number(row.trackId);

        apps.push({
          trackId,
          name: String(row.name ?? ""),
          blurb: String(row.blurb ?? ""),
          letters: "",
          tags: [],
        });

        if (trackId <= after) {
          return apps;
        }

        after = trackId;
      }

      if (rows.length < APP_PAGE) {
        break;
      }
    }

    return apps;
  }

  private async attachLetters(
    db: D1Database,
    byId: Map<number, CatalogApp>,
  ): Promise<boolean> {
    try {
      const shards = await Promise.all(
        Array.from({ length: SHARDS }, (_, shard) => (
          this.letterShard(db, shard)
        )),
      );

      for (const row of shards.flat()) {
        const app = byId.get(row.trackId);

        if (app) {
          app.letters = row.letters;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private async letterShard(
    db: D1Database,
    shard: number,
  ): Promise<Array<{ trackId: number; letters: string }>> {
    const out: Array<{ trackId: number; letters: string }> = [];

    let after = 0;

    for (;;) {
      const rows = await d1All<{
        trackId: number;

        letters: string;
      }>(
        db,
        `
        select track_id as trackId, letters
        from icon_signals
        where track_id > ?
          and (track_id % ${SHARDS}) = ?
        order by track_id
        limit ${APP_PAGE}
        `,
        [after, shard],
      );

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const trackId = Number(row.trackId);

        out.push({
          trackId,
          letters: String(row.letters ?? ""),
        });

        if (trackId <= after) {
          return out;
        }

        after = trackId;
      }

      if (rows.length < APP_PAGE) {
        break;
      }
    }

    return out;
  }

  private async attachTags(
    db: D1Database,
    byId: Map<number, CatalogApp>,
  ): Promise<boolean> {
    try {
      const rows = await d1All<{
        trackId: number;

        tagId: string;
      }>(
        db,
        `
        select track_id as trackId, tag_id as tagId
        from app_tags
        `,
      );

      for (const row of rows) {
        const app = byId.get(Number(row.trackId));

        if (app) {
          app.tags.push(String(row.tagId));
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private persist(memory: Memory, stamp: string): void {
    this.state.storage.transactionSync(() => {
      this.run("delete from text_vec");

      this.run("delete from icon_vec");

      this.run("delete from app_row");

      this.run("delete from market_app_row");

      this.run("delete from meta");
    });

    this.writeVectors("text_vec", memory.text);

    this.writeVectors("icon_vec", memory.icons);

    this.writeApps(memory.apps);
    for (const [market, apps] of memory.localized) {
      for (let index = 0; index < apps.length; index += 200) {
        this.state.storage.transactionSync(() => {
          for (const app of apps.slice(index, index + 200)) {
            this.run("insert into market_app_row (country, track_id, name, blurb, letters, tags) values (?, ?, ?, ?, ?, ?)",
              market, app.trackId, app.name, app.blurb, app.letters, JSON.stringify(app.tags));
          }
        });
      }
    }

    this.state.storage.transactionSync(() => {
      this.run("insert into meta (key, value) values ('format', ?)", CACHE_FORMAT);
      for (const [market, ids] of memory.markets) {
        this.run(
          "insert into meta (key, value) values (?, ?)",
          `market:${market}`,
          JSON.stringify([...ids]),
        );
      }
      this.run(
        `
        insert into meta (key, value)
        values ('stamp', ?)
        `,
        stamp,
      );
    });
  }

  private writeVectors(table: string, packed: PackedVectors): void {
    const slice: Array<{ trackId: number; bytes: ArrayBuffer }> = [];

    for (let index = 0; index < packed.ids.length; index += 1) {
      const offset = index * packed.dims;

      const vector = new Float32Array(packed.dims);
      for (let at = 0; at < packed.dims; at += 1) {
        vector[at] = packed.data[offset + at]! * packed.scales[index]!;
      }

      const bytes = new Uint8Array(vector.byteLength);

      bytes.set(
        new Uint8Array(
          vector.buffer,
          vector.byteOffset,
          vector.byteLength,
        ),
      );

      slice.push({
        trackId: packed.ids[index]!,
        bytes: bytes.buffer,
      });

      if (slice.length === 200) {
        this.insertVectors(table, slice);

        slice.length = 0;
      }
    }

    if (slice.length > 0) {
      this.insertVectors(table, slice);
    }
  }

  private insertVectors(
    table: string,
    rows: Array<{ trackId: number; bytes: ArrayBuffer }>,
  ): void {
    this.state.storage.transactionSync(() => {
      for (const row of rows) {
        this.run(
          `
          insert into ${table} (track_id, vector)
          values (?, ?)
          `,
          row.trackId,
          row.bytes,
        );
      }
    });
  }

  private writeApps(apps: CatalogApp[]): void {
    for (let index = 0; index < apps.length; index += 200) {
      const slice = apps.slice(index, index + 200);

      this.state.storage.transactionSync(() => {
        for (const app of slice) {
          this.run(
            `
            insert into app_row
              (track_id, name, blurb, letters, tags)
            values (?, ?, ?, ?, ?)
            `,
            app.trackId,
            app.name,
            app.blurb,
            app.letters,
            JSON.stringify(app.tags),
          );
        }
      });
    }
  }

  private readMemory(): Memory | null {
    try {
      if (this.run("select value from meta where key = 'format'")[0]?.value !== CACHE_FORMAT) {
        return null;
      }
      const text = this.readPacked("text_vec", TEXT_DIMS);

      const icons = this.readPacked("icon_vec", ICON_DIMS);

      const apps = prepareCatalogApps(this.readApps());

      const markets = this.readMarkets();
      const localized = this.readLocalizedApps();

      if (text.ids.length === 0 || !markets.has(DEFAULT_MARKET)) {
        return null;
      }

      return { text, icons, apps, markets, localized };
    } catch {
      return null;
    }
  }

  private readPacked(table: string, dims: number): PackedVectors {
    const rows = this.run(
      `
      select track_id, vector
      from ${table}
      order by track_id
      `,
    );

    const decoded: VectorRow[] = [];

    for (const row of rows) {
      const trackId = Number(row.track_id);

      const vector = vectorFromCell(row.vector, dims);

      if (vector) {
        decoded.push({ trackId, vector });
      }
    }

    if (decoded.length === 0) {
      return emptyPacked(dims);
    }

    return packVectors(decoded, dims);
  }

  private readApps(): CatalogApp[] {
    const rows = this.run(
      `
      select track_id, name, blurb, letters, tags
      from app_row
      order by track_id
      `,
    );

    return rows.map((row) => ({
      trackId: Number(row.track_id),
      name: String(row.name ?? ""),
      blurb: String(row.blurb ?? ""),
      letters: String(row.letters ?? ""),
      tags: parseTags(row.tags),
    }));
  }

  private readMarkets(): Map<MarketCode, Set<number>> {
    const markets = new Map<MarketCode, Set<number>>();
    const rows = this.run("select key, value from meta where key like 'market:%'");
    for (const row of rows) {
      const market = parseMarket(String(row.key).slice(7));
      if (!market) continue;
      const ids = JSON.parse(String(row.value)) as unknown;
      if (!Array.isArray(ids)) throw new Error("catalog market cache");
      markets.set(market, new Set(ids.filter((id): id is number =>
        Number.isSafeInteger(id) && Number(id) > 0)));
    }
    return markets;
  }

  private readLocalizedApps(): Map<MarketCode, CatalogApp[]> {
    const localized = new Map<MarketCode, CatalogApp[]>();
    const rows = this.run("select country, track_id, name, blurb, letters, tags from market_app_row order by country, track_id");
    for (const row of rows) {
      const market = parseMarket(row.country);
      if (!market) continue;
      const list = localized.get(market) ?? [];
      list.push({ trackId: Number(row.track_id), name: String(row.name), blurb: String(row.blurb),
        letters: String(row.letters), tags: parseTags(row.tags) });
      localized.set(market, list);
    }
    for (const apps of localized.values()) prepareCatalogApps(apps);
    return localized;
  }

  private savedStamp(): string | null {
    const rows = this.run(
      `
      select value
      from meta
      where key = 'stamp'
      `,
    );

    const value = rows[0]?.value;

    return typeof value === "string" && value.length > 0
      ? value
      : null;
  }

  private migrate(): void {
    this.run(`
      create table if not exists meta (
        key text primary key,
        value text not null
      )
    `);

    this.run(`
      create table if not exists text_vec (
        track_id integer primary key,
        vector blob not null
      )
    `);

    this.run(`
      create table if not exists icon_vec (
        track_id integer primary key,
        vector blob not null
      )
    `);

    this.run(`
      create table if not exists app_row (
        track_id integer primary key,
        name text not null,
        blurb text not null,
        letters text not null,
        tags text not null
      )
    `);

    this.run(`
      create table if not exists market_app_row (
        country text not null,
        track_id integer not null,
        name text not null,
        blurb text not null,
        letters text not null,
        tags text not null,
        primary key (country, track_id)
      )
    `);
  }

  private run(query: string, ...bindings: unknown[]): SqlRow[] {
    const cursor = this.state.storage.sql.exec(query, ...bindings);

    if (cursor && typeof cursor.toArray === "function") {
      return cursor.toArray();
    }

    if (cursor && typeof cursor[Symbol.iterator] === "function") {
      return [...cursor];
    }

    return [];
  }
}

function parseTags(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((tag) => String(tag));
  } catch {
    return [];
  }
}

function vectorFromCell(
  value: unknown,
  dims: number,
): Float32Array | null {
  if (typeof value === "string") {
    return decodeVector(value, dims * 4);
  }

  if (value instanceof ArrayBuffer) {
    return floatsFromBytes(new Uint8Array(value), dims);
  }

  if (ArrayBuffer.isView(value)) {
    const view = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    );

    return floatsFromBytes(view, dims);
  }

  return null;
}

async function d1All<T>(
  db: D1Database,
  query: string,
  params: Array<string | number | null> = [],
): Promise<T[]> {
  const prepared = db.prepare(query);

  const bound = params.length > 0
    ? prepared.bind(...params)
    : prepared;

  const result = await bound.all<T>();

  return result.results ?? [];
}
