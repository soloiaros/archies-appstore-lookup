/**
 * Where the matches rest: a centred grid inside a container that sits just above the search bar. The icons are as
 * large as they can be while every row still fits between the motion switch and the bar. They are never made smaller
 * than is comfortable to look at: if there are too many for that, the container shows as many full rows as fit and
 * the rest scroll. Each cell reserves room for its probability label, so nothing overlaps, whatever the window size.
 */
export type Anchor = { x: number; above: number }; // the search bar's centre and its top edge
export type Rest = { x: number; y: number; side: number }; // y is where the cell sits before any scrolling
export type Box = { x: number; y: number; width: number; height: number };
export type Layout = { rests: Rest[]; box: Box | null; small: boolean; scrollMost: number };

export const LABEL = 26; // a probability label and the gap under it
const GAP = 14; // between icons in a row
const ROW_GAP = 12; // between rows
const PAD = 18; // inside the container
const LIFT = 18; // clear space between the container and the search bar
const TOP = 64; // and between the container and the top of the window, where the settings cog sits
const SMALLEST = 52; // below this the logos stop being readable, so the box scrolls instead

export function gridLayout(count: number, anchor: Anchor, viewport: { width: number }, largest: number): Layout {
  if (count <= 0) return { rests: [], box: null, small: false, scrollMost: 0 };
  const room = { width: Math.min(viewport.width - 32, 1120) - PAD * 2, height: anchor.above - LIFT - TOP - PAD * 2 };
  const columnsAt = (side: number) => Math.max(1, Math.floor((room.width + GAP) / (side + GAP)));
  const heightOf = (rows: number, side: number) => rows * (side + LABEL) + (rows - 1) * ROW_GAP;

  // The largest icon size at which every match still fits. If none does, the smallest size, and the box scrolls.
  let side = Math.min(SMALLEST, Math.round(largest));
  for (let s = Math.round(largest); s >= SMALLEST; s -= 2) {
    if (heightOf(Math.ceil(count / columnsAt(s)), s) <= room.height) {
      side = s;
      break;
    }
  }
  const rows = Math.ceil(count / columnsAt(side));
  const perRow = Math.ceil(count / rows); // even rows, not a full row and a stray one
  const visibleRows = Math.max(1, Math.min(rows, Math.floor((room.height + ROW_GAP) / (side + LABEL + ROW_GAP))));
  // When it scrolls, half a row peeks out at the bottom: the plainest hint that there is more.
  const peek = rows > visibleRows ? Math.min((side + LABEL) / 2, room.height - heightOf(visibleRows, side)) : 0;

  const width = perRow * side + (perRow - 1) * GAP + PAD * 2;
  const height = heightOf(visibleRows, side) + Math.max(0, peek) + PAD * 2;
  const box = { x: anchor.x - width / 2, y: anchor.above - LIFT - height, width, height };

  const rests: Rest[] = [];
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / perRow);
    const inRow = Math.min(perRow, count - row * perRow); // a shorter last row is centred
    const rowWidth = inRow * side + (inRow - 1) * GAP;
    rests.push({
      x: anchor.x - rowWidth / 2 + (k - row * perRow) * (side + GAP) + side / 2,
      y: box.y + PAD + row * (side + LABEL + ROW_GAP) + LABEL + side / 2,
      side,
    });
  }
  return { rests, box, small: side < 60, scrollMost: Math.max(0, heightOf(rows, side) + PAD * 2 - height) };
}
