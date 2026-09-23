import { mkdirSync } from "node:fs";

import { writeFileSync } from "node:fs";

import { join } from "node:path";

import { recognizeScreenshots } from "../lib/pipeline/ocr";

import { openCatalog } from "../lib/scrape/store";

import { replaceScreenshotOcr } from "../lib/scrape/store";

const SAMPLE_TRACK_IDS = [
  284862083,
  1010865877,
  904237743,
  570060128,
  324715238,
  302584613,
  333710667,
  329218549,
];

const SHOTS_PER_APP = 2;

async function main(): Promise<void> {
  const shots = readShots();

  console.log(
    `ocr scope: ${shots.length} screenshots from ${SAMPLE_TRACK_IDS.length} apps`,
  );

  const recognized = await recognizeScreenshots(shots);

  const rows = recognized.map((row, index) => ({
    name: shots[index].name,
    ...row,
  }));

  const db = openCatalog();

  try {
    replaceScreenshotOcr(
      db,
      rows,
    );
  } finally {
    db.close();
  }

  const dir = join(
    process.cwd(),
    "data",
    "ocr",
  );

  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, "sample.json"),
    JSON.stringify(rows, null, 2) + "\n",
  );

  for (const row of rows) {
    console.log(
      `\n--- ${row.trackId} ---\n${row.text}`,
    );
  }
}

function readShots(): Array<{
  trackId: number;

  name: string;

  screenshotUrl: string;
}> {
  const db = openCatalog();

  try {
    const statement = db.prepare(`
      select
        track_id as trackId,
        name,
        screenshot_urls as screenshotUrls
      from apps
      where track_id = ?
    `);

    const shots: Array<{
      trackId: number;

      name: string;

      screenshotUrl: string;
    }> = [];

    for (const trackId of SAMPLE_TRACK_IDS) {
      const row = statement.get(trackId) as {
        trackId: number;

        name: string;

        screenshotUrls: string;
      } | undefined;

      if (!row) {
        throw new Error(
          `ocr sample missing ${trackId}`,
        );
      }

      const urls = JSON.parse(
        row.screenshotUrls,
      ) as string[];

      for (const screenshotUrl of urls.slice(0, SHOTS_PER_APP)) {
        shots.push({
          trackId: row.trackId,
          name: row.name,
          screenshotUrl,
        });
      }
    }

    return shots;
  } finally {
    db.close();
  }
}

void main();
