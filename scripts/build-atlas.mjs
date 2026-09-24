/**
 * Packs pile icons into one lossless WebP sheet.
 * node scripts/build-atlas.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";

const ROOT = process.cwd();
const CELL = 64;
const GUTTER = 2;
const COLS = 48;
const COUNT = 1200;
const SEED = 0x5eed1c04;
const CONCURRENCY = 24;
const pitch = CELL + GUTTER;

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const db = new DatabaseSync(
  path.join(ROOT, "data", "catalog.sqlite"),
  { readOnly: true },
);

const rows = db
  .prepare(
    `
    select track_id as trackId, icon_url as iconUrl
    from apps
    where icon_url != ''
      and delisted = 0
    order by track_id
  `,
  )
  .all();

db.close();

const eligible = rows.map((row) => ({
  id: String(row.trackId),
  src: String(row.iconUrl).replace(
    /\/\d+x\d+bb\.(jpg|png|webp)$/i,
    "/64x64bb.jpg",
  ),
  full: String(row.iconUrl),
}));

const random = mulberry32(SEED);

for (let i = eligible.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
}

const chosen = eligible.slice(0, COUNT);
const rowsN = Math.ceil(chosen.length / COLS);

console.log(
  `${eligible.length} icons, packing ${chosen.length} into ${COLS}x${rowsN} @ ${CELL}px`,
);

const cacheDir = path.join(ROOT, "data", "icons");
fs.mkdirSync(cacheDir, { recursive: true });

const started = Date.now();
let failed = 0;
let done = 0;

async function loadTile(item, at) {
  const cachePath = path.join(cacheDir, `${item.id}.png`);

  try {
    let buffer;

    if (fs.existsSync(cachePath)) {
      buffer = fs.readFileSync(cachePath);
    } else {
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(item.src, {
            headers: {
              "user-agent": "AppStoreIndexorAtlas/1.0",
            },
          });

          if (!response.ok) {
            throw new Error(`http ${response.status}`);
          }

          const raw = Buffer.from(
            await response.arrayBuffer(),
          );

          buffer = await sharp(raw)
            .resize(CELL, CELL, {
              fit: "cover",
              position: "centre",
              kernel: "lanczos3",
            })
            .ensureAlpha()
            .png()
            .toBuffer();

          fs.writeFileSync(cachePath, buffer);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * (attempt + 1)),
          );
        }
      }

      if (lastError || !buffer) {
        throw lastError ?? new Error("empty");
      }
    }

    done++;

    if (done % 100 === 0 || done === chosen.length) {
      console.log(`  ${done}/${chosen.length}`);
    }

    return {
      input: buffer,
      left: (at % COLS) * pitch,
      top: Math.floor(at / COLS) * pitch,
    };
  } catch {
    failed++;
    done++;
    return null;
  }
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => run(),
    ),
  );

  return out;
}

const tiles = await mapPool(
  chosen,
  CONCURRENCY,
  loadTile,
);

const sheet = sharp({
  create: {
    width: COLS * pitch,
    height: rowsN * pitch,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
}).composite(tiles.filter(Boolean));

const out = path.join(ROOT, "public", "atlas");
fs.mkdirSync(out, { recursive: true });

await sheet
  .webp({ lossless: true, effort: 6 })
  .toFile(path.join(out, "pile.webp"));

fs.writeFileSync(
  path.join(out, "pile.json"),
  JSON.stringify({
    cell: CELL,
    gutter: GUTTER,
    cols: COLS,
    sheet: "/atlas/pile.webp",
    ids: chosen.map((i) => i.id),
    srcs: chosen.map((i) => i.full),
  }),
);

const bytes = fs.statSync(
  path.join(out, "pile.webp"),
).size;

console.log(
  `public/atlas/pile.webp ${(bytes / 1048576).toFixed(2)} MB (${Math.round(bytes / chosen.length)} B/icon) in ${((Date.now() - started) / 1000).toFixed(1)}s${failed ? `, ${failed} failed` : ""}`,
);
