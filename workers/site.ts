import { ensureSchema, fromD1, type D1Database } from "../lib/site/d1";

import { Presence } from "../lib/site/presence-do";

import { releaseExpired } from "../lib/site/sweep";

export { Presence };

type FetchHandler = (
  request: Request,
  env: Bindings,
  ctx: ExecutionContext,
) => Promise<Response> | Response;

type Bindings = {
  SITE_DB?: D1Database;
};

const token = {};

async function openNextFetch(): Promise<FetchHandler> {
  const mod = await import("../.open-next/worker.js") as {
    default?: { fetch?: FetchHandler } | FetchHandler;
  };

  if (typeof mod.default === "function") {
    return mod.default;
  }

  if (
    mod.default
    && typeof mod.default === "object"
    && mod.default.fetch
  ) {
    return mod.default.fetch.bind(mod.default);
  }

  throw new Error("OpenNext worker is missing.");
}

export default {
  async fetch(
    request: Request,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    const fetchWorker = await openNextFetch();

    return fetchWorker(request, env, ctx);
  },

  async scheduled(
    _event: unknown,
    env: Bindings,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ) {
    if (!env.SITE_DB) {
      return;
    }

    const sql = fromD1(env.SITE_DB);

    ctx.waitUntil(
      ensureSchema(sql, token).then(() => releaseExpired(sql)),
    );
  },
};
