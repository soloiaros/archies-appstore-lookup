/** A square of some canvas, ready to be blitted. Several patches usually share one canvas: see `atlas.ts`. */
export type Patch = { img: CanvasImageSource; x: number; y: number; w: number };

export const RADIUS = 0.225; // of the side

/** The square of an image that the canvas actually shows: the largest centred square, so a tall logo is not squashed. */
export function crop(img: HTMLImageElement) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  return { sx: (img.naturalWidth - side) / 2, sy: (img.naturalHeight - side) / 2, side };
}

/**
 * One tile: the light glass backing, then the logo on top of it.
 *
 * A see-through logo would vanish on the dark page, so it sits on a pane of light glass: a near-white sheet with a
 * gloss sweep across the top-left and a soft rim. Light rather than dark on purpose, because a dark logo on dark glass
 * is just as invisible as it was with no backing at all. An opaque logo covers it, so this needs no test for whether a
 * particular image has a transparent background.
 *
 * The caller has already clipped to the rounded square, which is why this can fill the whole cell.
 */
export function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, img: CanvasImageSource, sx: number, sy: number, side: number) {
  const sheet = ctx.createLinearGradient(x, y, x + px * 0.4, y + px);
  sheet.addColorStop(0, "rgba(255,255,255,0.97)");
  sheet.addColorStop(0.5, "rgba(246,247,249,0.93)");
  sheet.addColorStop(1, "rgba(232,235,240,0.90)");
  ctx.fillStyle = sheet;
  ctx.fillRect(x, y, px, px);
  // The gloss: a bright sweep across the upper left, which is what makes it read as glass rather than as paper.
  const gloss = ctx.createLinearGradient(x, y, x + px * 0.75, y + px * 0.75);
  gloss.addColorStop(0, "rgba(255,255,255,0.85)");
  gloss.addColorStop(0.45, "rgba(255,255,255,0.12)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, px, px);
  const line = Math.max(1, px * 0.012);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.roundRect(x + line / 2, y + line / 2, px - line, px - line, px * RADIUS);
  ctx.stroke();

  ctx.drawImage(img, sx, sy, side, side, x, y, px, px);
}

/**
 * One image on its own canvas at its on-screen size, corners already rounded. This is for the handful of enlarged
 * matches, which are far too big to keep in the shared sheet. Null until the image has loaded.
 */
export function renderSprite(img: HTMLImageElement | null, side: number, dpr: number): Patch | null {
  if (!img?.complete || img.naturalWidth === 0) return null;
  const px = Math.round(side * dpr);
  const sprite = document.createElement("canvas");
  sprite.width = px;
  sprite.height = px;
  const ctx = sprite.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.beginPath();
  ctx.roundRect(0, 0, px, px, px * RADIUS);
  ctx.clip();
  const { sx, sy, side: source } = crop(img);
  drawTile(ctx, 0, 0, px, img, sx, sy, source);
  return { img: sprite, x: 0, y: 0, w: px };
}
