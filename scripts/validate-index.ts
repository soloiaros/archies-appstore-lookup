import { mkdirSync, writeFileSync } from "node:fs";

import { readFileSync } from "node:fs";

import { join } from "node:path";

import {
  embedAsking,
  embedIconQuery,
} from "../lib/pipeline/embed";

import {
  topIconHits,
  topMeaningHits,
} from "../lib/retrieve/finalists";

import { openCatalog } from "../lib/scrape/store";

async function main(): Promise<void> {
  const db = openCatalog();

  const validation = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "data",
        "validation",
        "queries.json",
      ),
      "utf8",
    ),
  ) as {
    queries: Array<{
      text: string;

      shape: string;
    }>;
  };

  const iconQueries = [
    "simple blue square icon",
    "green owl mascot icon",
    "yellow bird logo",
  ];

  const discovery: Array<{
    query: string;

    top: Array<{
      trackId: number;

      name: string;

      score: number;
    }>;

    plausible: boolean;
  }> = [];

  for (const item of validation.queries) {
    const vector = await embedAsking(item.text);

    const top = topMeaningHits(
      db,
      vector,
      5,
    ).map((hit) => ({
      trackId: hit.trackId,
      name: hit.name,
      score: Number(hit.score.toFixed(4)),
    }));

    discovery.push({
      query: item.text,
      top,
      plausible: top.length > 0,
    });

    console.log(
      JSON.stringify({
        query: item.text,
        top: top.map((hit) => hit.name),
      }),
    );
  }

  const icons: Array<{
    query: string;

    top: Array<{
      trackId: number;

      name: string;

      score: number;
    }>;

    plausible: boolean;
  }> = [];

  for (const text of iconQueries) {
    const vector = await embedIconQuery(text);

    const top = topIconHits(
      db,
      vector,
      5,
    ).map((hit) => ({
      trackId: hit.trackId,
      name: hit.name,
      score: Number(hit.score.toFixed(4)),
    }));

    icons.push({
      query: text,
      top,
      plausible: top.length > 0,
    });

    console.log(
      JSON.stringify({
        iconQuery: text,
        top: top.map((hit) => hit.name),
      }),
    );
  }

  const counts = {
    textEmbeddings: count(db, "text_embeddings"),
    iconEmbeddings: count(db, "icon_embeddings"),
    apps: count(db, "apps"),
  };

  db.close();

  const report = {
    checkedAt: new Date().toISOString(),
    counts,
    discovery,
    icons,
  };

  const dir = join(
    process.cwd(),
    "data",
    "validation",
  );

  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, "index-check.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

  console.log(
    JSON.stringify(counts),
  );
}

function count(
  db: ReturnType<typeof openCatalog>,
  table: string,
): number {
  return (
    db.prepare(
      `select count(*) as n from ${table}`,
    ).get() as { n: number }
  ).n;
}

void main();
