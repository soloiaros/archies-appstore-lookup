import { mkdirSync } from "node:fs";

import { join } from "node:path";

import { DatabaseSync } from "node:sqlite";

import { betterAuth } from "better-auth";

import { nextCookies } from "better-auth/next-js";

function socialProviders() {
  const providers: {
    github?: { clientId: string; clientSecret: string };
    google?: { clientId: string; clientSecret: string };
  } = {};

  const githubId = process.env.GITHUB_CLIENT_ID?.trim();
  const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (githubId && githubSecret) {
    providers.github = {
      clientId: githubId,
      clientSecret: githubSecret,
    };
  }

  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (googleId && googleSecret) {
    providers.google = {
      clientId: googleId,
      clientSecret: googleSecret,
    };
  }

  return providers;
}

function trustedOrigins() {
  const fromEnv = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:3000",
    "https://10k.aauburn.com",
  ];

  return [...new Set([...defaults, ...fromEnv])];
}

function createAuth(database: DatabaseSync | D1DatabaseLike) {
  return betterAuth({
    database,
    appName: "10K",
    socialProviders: socialProviders(),
    trustedOrigins: trustedOrigins(),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
    },
    plugins: [nextCookies()],
  });
}

type D1DatabaseLike = {
  prepare(query: string): unknown;
  batch?(statements: unknown[]): Promise<unknown>;
  exec?(query: string): Promise<unknown>;
};

let localDb: DatabaseSync | null = null;

function localDatabase() {
  if (!localDb) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    localDb = new DatabaseSync(join(process.cwd(), "data", "site.sqlite"));
    localDb.exec("pragma journal_mode = WAL");
  }

  return localDb;
}

/** Sync instance for the Better Auth CLI (`npx auth migrate`). */
export const auth = createAuth(localDatabase());

export type Auth = typeof auth;

export async function getAuth(): Promise<Auth> {
  const onWorkers = typeof navigator !== "undefined"
    && navigator.userAgent === "Cloudflare-Workers";

  if (!onWorkers) {
    return auth;
  }

  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = await mod.getCloudflareContext({ async: true });
    const db = (ctx.env as { SITE_DB?: D1DatabaseLike } | undefined)?.SITE_DB;

    if (db) {
      // Ensure Better Auth tables exist on SITE_DB (same path as rate limits).
      const { siteDb } = await import("@/lib/site/db");
      await siteDb();
      return createAuth(db) as Auth;
    }
  } catch {
    // Fall through to local sqlite auth.
  }

  return auth;
}

export async function getSession(headers: Headers) {
  const instance = await getAuth();

  return instance.api.getSession({ headers });
}
