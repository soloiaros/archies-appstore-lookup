import { ensureSchema, fromD1, type D1Database } from "@/lib/site/d1";

import { sqliteSite } from "@/lib/site/sqlite";

import type { SiteSql } from "@/lib/site/types";

type PresenceNamespace = {
  idFromName(name: string): unknown;

  get(id: unknown): {
    fetch(input: string): Promise<Response>;
  };
};

export type IconEmbedNamespace = {
  getByName(name: string): {
    fetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response>;
  };
};

export type WorkersAi = {
  run(
    model: string,
    input: {
      text: string[];
      pooling?: "mean" | "cls";
    },
  ): Promise<{ data?: unknown }>;
};

type CfEnv = {
  SITE_DB?: D1Database;

  CATALOG_DB?: D1Database;

  PRESENCE?: PresenceNamespace;

  AI?: WorkersAi;

  ICON_EMBED?: IconEmbedNamespace;
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

export async function siteReader(): Promise<SiteSql | null> {
  const env = await cloudflareEnv();

  if (!env?.SITE_DB) {
    return null;
  }

  return fromD1(env.SITE_DB);
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

export async function iconEmbed(): Promise<IconEmbedNamespace | null> {
  const env = await cloudflareEnv();

  return env?.ICON_EMBED ?? null;
}

export async function workersAi(): Promise<WorkersAi | null> {
  const env = await cloudflareEnv();

  return env?.AI ?? null;
}

export async function catalogDb(): Promise<SiteSql | null> {
  const env = await cloudflareEnv();

  if (!env?.CATALOG_DB) {
    return null;
  }

  return fromD1(env.CATALOG_DB);
}

export async function presenceNamespace(): Promise<PresenceNamespace | null> {
  const env = await cloudflareEnv();

  return env?.PRESENCE ?? null;
}
