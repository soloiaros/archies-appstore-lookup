import {
  BGE_DIMS,
  SIGLIP_DIMS,
  embedDescriptions,
  embedIconUrl,
} from "../lib/pipeline/embed";

import { openCatalog } from "../lib/scrape/store";

async function main(): Promise<void> {
  const db = openCatalog();

  const row = db.prepare(`
    select
      description,
      icon_url as iconUrl
    from apps
    where track_id = 963034692
  `).get() as {
    description: string;

    iconUrl: string;
  };

  db.close();

  const [text] = await embedDescriptions([
    row.description,
  ]);

  const icon = await embedIconUrl(
    row.iconUrl,
  );

  if (!text) {
    throw new Error("no text vector");
  }

  const report = {
    textDims: text.length,
    textFinite: [...text].every(Number.isFinite),
    textNorm: Math.hypot(...text),
    textNonZero: [...text].some((value) => value !== 0),
    iconDims: icon.length,
    iconFinite: [...icon].every(Number.isFinite),
    iconNorm: Math.hypot(...icon),
    iconNonZero: [...icon].some((value) => value !== 0),
    expectText: BGE_DIMS,
    expectIcon: SIGLIP_DIMS,
  };

  console.log(JSON.stringify(report, null, 2));

  const ok =
    text.length === BGE_DIMS
    && icon.length === SIGLIP_DIMS
    && report.textFinite
    && report.iconFinite
    && report.textNonZero
    && report.iconNonZero
    && Math.abs(report.iconNorm - 1) < 0.02;

  if (!ok) {
    process.exitCode = 1;
  }
}

void main();
