import { readFileSync } from "node:fs";

import { TAG_PASS_LIMIT } from "../lib/pipeline/tags";

import { openCatalog } from "../lib/scrape/store";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const check = args.includes("--check");

  const idsFlag = args.indexOf("--ids");

  const idsPath = idsFlag >= 0
    ? args[idsFlag + 1]
    : undefined;

  if (!idsPath) {
    console.error(
      "tag-pass: pass --ids data/tags/subset-50.json",
    );

    console.error(
      "tag-pass: full catalog refused",
    );

    process.exitCode = 1;

    return;
  }

  const trackIds = readTrackIds(idsPath);

  const present = presentIds(trackIds);

  console.log(
    `tag-pass scope: ${present.length} ids from ${idsPath}`,
  );

  if (
    trackIds.length !== TAG_PASS_LIMIT
    || present.length !== TAG_PASS_LIMIT
  ) {
    console.error(
      `tag-pass refused: file ${trackIds.length}, catalog ${present.length}, limit ${TAG_PASS_LIMIT}`,
    );

    process.exitCode = 1;

    return;
  }

  if (check) {
    console.log(
      trackIds.join("\n"),
    );

    return;
  }

  console.error(
    "tag-pass: does not call an API; tags assigned offline",
  );

  process.exitCode = 1;
}

function readTrackIds(
  path: string,
): number[] {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as { trackIds?: unknown };

  if (!Array.isArray(parsed.trackIds)) {
    return [];
  }

  return parsed.trackIds.filter(
    (trackId): trackId is number =>
      typeof trackId === "number",
  );
}

function presentIds(
  trackIds: number[],
): number[] {
  const db = openCatalog();

  try {
    const statement = db.prepare(
      "select track_id as trackId from apps where track_id = ?",
    );

    const found: number[] = [];

    for (const trackId of trackIds) {
      const row = statement.get(trackId) as
        | { trackId: number }
        | undefined;

      if (row) {
        found.push(row.trackId);
      }
    }

    return found;
  } finally {
    db.close();
  }
}

void main();
