import { mkdirSync } from "node:fs";

import { join } from "node:path";

import { DatabaseSync } from "node:sqlite";

import { ensureSchema } from "@/lib/site/d1";

import type { SiteSql, SqlValue } from "@/lib/site/types";

const PATH = join(
  process.cwd(),
  "data",
  "site.sqlite",
);

const token = {};

let db: DatabaseSync | null = null;

function database(): DatabaseSync {
  if (db) {
    return db;
  }

  mkdirSync(
    join(process.cwd(), "data"),
    { recursive: true },
  );

  db = new DatabaseSync(PATH);

  db.exec("pragma journal_mode = WAL");

  return db;
}

function sqliteSql(): SiteSql {
  const connection = database();

  return {
    async exec(sql) {
      connection.exec(sql);
    },

    async all<T>(sql: string, params: SqlValue[] = []) {
      return connection.prepare(sql).all(...params) as T[];
    },

    async get<T>(sql: string, params: SqlValue[] = []) {
      return connection.prepare(sql).get(...params) as T | undefined;
    },

    async run(sql, params = []) {
      const result = connection.prepare(sql).run(...params) as {
        changes: number | bigint;
      };

      return Number(result.changes);
    },
  };
}

export async function sqliteSite(): Promise<SiteSql> {
  const sql = sqliteSql();

  await ensureSchema(sql, token);

  return sql;
}
