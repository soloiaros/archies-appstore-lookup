import { crop, drawTile, type Patch, RADIUS } from "./sprite";

/** The packed sheet of logos that `scripts/build-atlas.mjs` writes, and where in it each of the pile's logos sits. */
export type Sheet = { url: string; cell: number; gutter: number; cols: number };

const GUTTER = 2; // transparent pixels between cells: a rotating icon samples a pixel or two past its own edge

/**
 * One canvas holding every pile icon, each drawn at exactly the size the page draws it.
 *
 * A thousand icons used to mean a thousand offscreen canvases, and a thousand textures for the compositor to juggle;
 * drawing a frame meant switching source between every single one. Here they share one canvas, so a frame is a
 * thousand blits out of one texture, which is the difference between a pile that stutters and a pile that does not.
 *
 * Cells are whole device pixels, so a settled icon lands exactly 1:1 on the screen with no resampling at all. That is
 * also why the atlas is rebuilt when the window or the pile size changes: the size on screen changed, so the cells
 * have to change with it.
 */
export function createAtlas() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const patches: (Patch | null)[] = [];
  let cols = 0;
  let pitch = 0;
  let px = 0;

  return {
    get side() {
      return px;
    },

    /** Give `count` bodies a cell of `sizePx` device pixels each. Everything drawn before this is gone. */
    layout(count: number, sizePx: number) {
      px = Math.max(8, Math.round(sizePx));
      pitch = px + GUTTER;
      cols = Math.max(1, Math.ceil(Math.sqrt(count)));
      canvas.width = cols * pitch;
      canvas.height = Math.max(1, Math.ceil(count / cols)) * pitch;
      if (ctx) ctx.imageSmoothingQuality = "high"; // the sheet's 64px logos come down to about 40: worth the better filter
      patches.length = 0;
    },

    patch(i: number): Patch | null {
      return patches[i] ?? null;
    },

    /** Paint body `i`'s cell from a square of `img`. */
    put(i: number, img: CanvasImageSource, sx: number, sy: number, side: number) {
      if (!ctx || !px) return;
      const x = (i % cols) * pitch;
      const y = Math.floor(i / cols) * pitch;
      ctx.clearRect(x, y, pitch, pitch);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, px, px, px * RADIUS);
      ctx.clip();
      drawTile(ctx, x, y, px, img, sx, sy, side);
      ctx.restore();
      patches[i] = { img: canvas, x, y, w: px };
    },

    /** Paint body `i`'s cell from its own loaded image, centre-cropped. Says whether there was anything to draw. */
    putImage(i: number, img: HTMLImageElement | null) {
      if (!img?.complete || !img.naturalWidth) return false;
      const { sx, sy, side } = crop(img);
      this.put(i, img, sx, sy, side);
      return true;
    },

    /** Paint body `i`'s cell from cell `at` of the packed sheet. */
    putSheet(i: number, sheet: Sheet, img: HTMLImageElement, at: number) {
      const step = sheet.cell + sheet.gutter;
      this.put(i, img, (at % sheet.cols) * step, Math.floor(at / sheet.cols) * step, sheet.cell);
    },

    forget(i: number) {
      patches[i] = null;
    },
  };
}

export type Atlas = ReturnType<typeof createAtlas>;
