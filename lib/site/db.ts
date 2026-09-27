import { ensureSchema, fromD1, type D1Database } from "@/lib/site/d1";

import { sqliteSite } from "@/lib/site/sqlite";

import type { SiteSql } from "@/lib/site/types";

type PresenceNamespace = {
  idFromName(name: string): unknown;

  get(id: unknown): {
    fetch(input: string): Promise<Response>;
  };
};

type CfEnv = {
  SITE_DB?: D1Database;

  PRESENCE?: PresenceNamespace;
};

const d1Token = {};

async function cloudflareEnv(): Promise<CfEnv | null> {
  const global = globalThis as typeof globalThis & {
    [key: symbol]: { env?: CfEnv } | undefined;
  };

  const existing = global[Symbol.for("__cloudflare-context__")];

  if (existing?.env) {
    return existing.env;
  }

  const onWorkers = typeof navigator !== "undefined"
    && navigator.userAgent === "Cloudflare-Workers";

  if (!onWorkers) {
    return null;
  }

  try {
    const mod = await import("@opennextjs/cloudflare");

    const ctx = await mod.getCloudflareContext({
      async: true,
    });

    return ctx.env as CfEnv;
  } catch {
    return null;
  }
}

export async function siteDb(): Promise<SiteSql> {
  const env = await cloudflareEnv();

  if (env?.SITE_DB) {
    const sql = fromD1(env.SITE_DB);

    await ensureSchema(sql, d1Token);

    return sql;
  }

  return sqliteSite();
}

export async function presenceNamespace(): Promise<PresenceNamespace | null> {
  const env = await cloudflareEnv();

  return env?.PRESENCE ?? null;
}
