import { refreshOneApp } from "../lib/scrape/single";

import { openCatalog } from "../lib/scrape/store";

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "stub";

  if (mode === "stub") {
    const before = {
      called: false,
    };

    const decision = shouldRefresh(
      "2000-01-01T00:00:00.000Z",
      7 * 24 * 60 * 60 * 1000,
    );

    console.log(
      JSON.stringify({
        mode: "stub",
        shouldRefresh: decision,
        note: "decision only; no network",
      }),
    );

    if (!decision) {
      process.exitCode = 1;
    }

    void before;

    return;
  }

  if (mode === "live") {
    const trackId = Number(
      process.argv[3] ?? "6448311069",
    );

    const db = openCatalog();

    const before = db.prepare(`
      select metadata_fetched_at as at
      from apps
      where track_id = ?
    `).get(trackId) as {
      at: string;
    } | undefined;

    db.close();

    const app = await refreshOneApp(trackId);

    console.log(
      JSON.stringify({
        mode: "live",
        trackId,
        before: before?.at ?? null,
        after: app?.metadataFetchedAt ?? null,
        name: app?.name ?? null,
      }),
    );

    if (!app) {
      process.exitCode = 1;
    }
  }
}

function shouldRefresh(
  fetchedAt: string,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  const then = Date.parse(fetchedAt);

  if (Number.isNaN(then)) {
    return true;
  }

  return now - then > maxAgeMs;
}

void main();
