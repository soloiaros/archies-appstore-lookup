import fs from "node:fs";

import path from "node:path";

import bundledAtlas from "../public/atlas/pile.json";

/** Packed pile sheet from `scripts/build-atlas.mjs`. */
export type PileAtlas = {
  cell: number;

  gutter: number;

  cols: number;

  sheet: string;

  ids: string[];

  srcs: string[];

  indexed: number;
};

const FILE = path.join(
  process.cwd(),
  "public",
  "atlas",
  "pile.json",
);

let loaded: {
  mtime: number;

  atlas: PileAtlas;
} | null = null;

/** Re-read when the file changes. */
export function pileAtlas(): PileAtlas | null {
  try {
    const mtime = fs.statSync(FILE).mtimeMs;

    if (
      !loaded
      || loaded.mtime !== mtime
    ) {
      loaded = {
        mtime,
        atlas: JSON.parse(
          fs.readFileSync(FILE, "utf8"),
        ) as PileAtlas,
      };
    }

    return loaded.atlas;
  } catch {
    return bundledAtlas as PileAtlas;
  }
}
