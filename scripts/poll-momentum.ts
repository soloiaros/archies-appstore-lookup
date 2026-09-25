import { readFileSync } from "node:fs";

import { join } from "node:path";

import {
  itunesCountry,
  loadLocalEnv,
} from "../lib/env";

import { reportPoll } from "../lib/pipeline/monitor";

import { runRevenueEstimates } from "../lib/pipeline/revenue";

import { refreshCatalog } from "../lib/scrape/refresh";

loadLocalEnv();

async function main(): Promise<void> {
  const at = new Date().toISOString();

  try {
    const result = await refreshCatalog(
      itunesCountry(),
      readGenreIds(),
      readAddList(),
    );

    const detail = JSON.stringify(
      result.counts,
    );

    if (result.counts.apps === 0) {
      reportPoll({
        ok: false,
        at,
        detail: "empty catalog",
      });

      process.exitCode = 1;

      return;
    }

    reportPoll({
      ok: true,
      at,
      detail,
    });

    console.log(detail);

    const revenue = runRevenueEstimates();

    console.log(
      JSON.stringify({
        revenue,
      }),
    );
  } catch (error) {
    reportPoll({
      ok: false,
      at,
      detail:
        error instanceof Error
          ? error.message
          : "poll failed",
    });

    process.exitCode = 1;
  }
}

function readGenreIds(): number[] {
  const parsed = readJson(
    join(
      process.cwd(),
      "data",
      "categories",
      "taxonomy.json",
    ),
  );

  if (
    typeof parsed !== "object"
    || parsed === null
    || !("genres" in parsed)
    || !Array.isArray(parsed.genres)
  ) {
    return [];
  }

  const ids: number[] = [];

  for (const genre of parsed.genres) {
    if (
      typeof genre === "object"
      && genre !== null
      && "id" in genre
      && typeof genre.id === "number"
    ) {
      ids.push(genre.id);
    }
  }

  return ids;
}

function readAddList(): number[] {
  const parsed = readJson(
    join(
      process.cwd(),
      "data",
      "seeds",
      "add-list.json",
    ),
  );

  if (
    typeof parsed !== "object"
    || parsed === null
    || !("trackIds" in parsed)
    || !Array.isArray(parsed.trackIds)
  ) {
    return [];
  }

  return parsed.trackIds.filter(
    (trackId): trackId is number =>
      typeof trackId === "number",
  );
}

function readJson(
  path: string,
): unknown {
  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  ) as unknown;
}

void main();
