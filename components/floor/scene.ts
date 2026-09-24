import type Matter from "matter-js";
import type { Atlas, Sheet } from "./atlas";
import type { Box, Rest } from "./layout";
import type { Patch } from "./sprite";

export type Match = {
  src: string;
  probability: number;
  title: string;
  tagline?: string;
  detail?: string;
  trackId: number;
};

/** A match while it floats above the search bar. */
export type Hold = { rest: Rest; scale: number; startY: number; t: number; boost: number; rank: number; label: number; arrived: boolean; match: Match;
  labelled: boolean; // its probability label is showing: from here on it must move exactly with the container
  parked: boolean; // settled in its cell: snapped into place and put to sleep, so it costs nothing until it is let go
};

/** An image being swapped for another in place: the old one shrinks away, the new one springs up. */
export type Pop = { t0: number; img: HTMLImageElement; src: string; swapped: boolean; rain?: boolean; then?: () => void };

/**
 * Everything the parts of the floor share (forces, overlays, swaps, drawing). It is one object on purpose:
 * a part can change `size` or set `dirty`, and every other part sees it.
 */
export type Scene = {
  engine: Matter.Engine;
  srcs: string[]; // index -> image address. Grows when images arrive, changes when a slot is swapped
  // The full-size picture, loaded only for the bodies that need one: a match about to be enlarged, an upload, a churn
  // swap. A pile icon is drawn from the shared sheet, so a thousand of them decode no full-size images at all.
  images: (HTMLImageElement | null)[];
  tiles: (number | HTMLImageElement | null)[]; // where a body's pile picture comes from: a cell of the packed sheet, or its own image
  atlas: Atlas; // every pile icon, drawn once at exactly its size on screen, on one canvas
  sheet: Sheet | null; // the packed sheet's shape, if the build script has run
  sheetImg: HTMLImageElement | null;
  bodies: Matter.Body[];
  grown: Map<number, number>; // icons currently larger than the rest: index -> scale. The rigid body is scaled too
  sharp: Map<number, Patch | null>; // full-resolution sprites for the grown icons, each on its own canvas
  holds: Map<number, Hold>;
  pops: Map<number, Pop>;
  box: Box | null; // the container the matches gather in, while there are any
  scroll: number; // how far that container has been scrolled. A match's place is its rest minus this
  width: number;
  height: number;
  size: number; // a pile icon
  bigSize: number; // the best match once it is above the search bar
  midSize: number; // the other matches
  dpr: number;
  added: number; // how many bodies have been poured into the world so far
  dirty: boolean; // only repaint when something actually moved
  now: number; // the current frame's clock
  retile: (i: number) => void; // draw body i's cell of the atlas again, from whatever its picture is now
  ensureImage: (i: number) => HTMLImageElement; // the full-size picture for body i, loading it if this is the first ask
};
