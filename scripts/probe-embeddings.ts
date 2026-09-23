import { mkdirSync } from "node:fs";

import { writeFileSync } from "node:fs";

import { join } from "node:path";

import { probeIconEmbedding } from "../lib/pipeline/embed";

import { probeTextEmbedding } from "../lib/pipeline/embed";

import { openCatalog } from "../lib/scrape/store";

const SAMPLE_TRACK_ID = 963034692;

async function main(): Promise<void> {
  const sample = readSample(SAMPLE_TRACK_ID);

  const text = await probeTextEmbedding(
    sample.description,
  );

  const icon = await probeIconEmbedding(
    sample.iconUrl,
  );

  const report = {
    trackId: sample.trackId,
    name: sample.name,
    text: summarize(text),
    icon: summarize(icon),
  };

  const dir = join(
    process.cwd(),
    "data",
    "embeddings",
  );

  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, "probe.json"),
    JSON.stringify(
      {
        ...report,
        textVector: text.vector,
        iconVector: icon.vector,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(JSON.stringify(report));

  if (
    !text.finite
    || text.norm === 0
    || text.dimensions !== 384
    || !icon.finite
    || icon.norm === 0
    || icon.dimensions !== 512
  ) {
    process.exitCode = 1;
  }
}

function summarize(
  result: {
    model: string;

    repo: string;

    dimensions: number;

    finite: boolean;

    norm: number;

    vector: number[];
  },
): {
  model: string;

  repo: string;

  dimensions: number;

  finite: boolean;

  norm: number;

  head: number[];
} {
  return {
    model: result.model,
    repo: result.repo,
    dimensions: result.dimensions,
    finite: result.finite,
    norm: result.norm,
    head: result.vector.slice(0, 4),
  };
}

function readSample(
  trackId: number,
): {
  trackId: number;

  name: string;

  description: string;

  iconUrl: string;
} {
  const db = openCatalog();

  try {
    const row = db.prepare(`
      select
        track_id as trackId,
        name,
        description,
        icon_url as iconUrl
      from apps
      where track_id = ?
    `).get(trackId) as {
      trackId: number;

      name: string;

      description: string;

      iconUrl: string;
    } | undefined;

    if (!row) {
      throw new Error(
        "probe sample missing",
      );
    }

    return row;
  } finally {
    db.close();
  }
}

void main();
