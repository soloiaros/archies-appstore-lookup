import { SCHEMA } from "@/lib/site/schema";

import type { SiteSql, SqlValue } from "@/lib/site/types";

export type D1Prepared = {
  bind(...values: SqlValue[]): D1Prepared;

  all<T>(): Promise<{ results?: T[] }>;

  first<T>(): Promise<T | null>;

  run(): Promise<{ meta?: { changes?: number } }>;
};

export type D1Database = {
  prepare(sql: string): D1Prepared;

  exec(sql: string): Promise<unknown>;
};

export function fromD1(db: D1Database): SiteSql {
  return {
    async exec(sql) {
      await db.exec(sql);
    },

    async all<T>(sql: string, params: SqlValue[] = []) {
      const result = await db.prepare(sql).bind(...params).all<T>();

      return result.results ?? [];
    },

    async get<T>(sql: string, params: SqlValue[] = []) {
      const row = await db.prepare(sql).bind(...params).first<T>();

      return row ?? undefined;
    },

    async run(sql, params = []) {
      const result = await db.prepare(sql).bind(...params).run();

      return result.meta?.changes ?? 0;
    },
  };
}

const ready = new WeakSet<object>();

const PAGEVIEW_COLUMNS = [
  ["city", "text"],
  ["region", "text"],
  ["lat", "real"],
  ["lon", "real"],
] as const;

async function migratePageviews(sql: SiteSql) {
  const columns = await sql.all<{ name: string }>(
    "pragma table_info(pageviews)",
  );

  const have = new Set(columns.map((column) => column.name));

  for (const [name, type] of PAGEVIEW_COLUMNS) {
    if (have.has(name)) {
      continue;
    }

    await sql.exec(`alter table pageviews add column ${name} ${type}`);
  }
}

export async function ensureSchema(
  sql: SiteSql,
  token: object,
) {
  if (ready.has(token)) {
    return;
  }

  const statements = SCHEMA
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.exec(statement);
  }

  await migratePageviews(sql);

  ready.add(token);
}
