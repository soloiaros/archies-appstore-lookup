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

export async function ensureSchema(
  sql: SiteSql,
  token: object,
) {
  if (ready.has(token)) {
    return;
  }

  await sql.exec(SCHEMA);

  ready.add(token);
}
