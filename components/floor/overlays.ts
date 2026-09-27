import { LABEL, type Box, type Rest } from "./layout";
import type { Match, Scene } from "./scene";

export const MOST = 180; // labels kept in the page. Only cells near the view hold one, so this covers any window size
const LABEL_FADE = 420; // ms, matches the CSS transition on the labels
const EDGE = 12; // the tooltip keeps this far from the window's edge
const TOP_EDGE = 64; // and this far from the top, where the settings cog sits: the card must never sit over it
const REST = 90; // ms the cursor has to settle before the FIRST card appears, so sweeping the grid does not flash one per icon
const HOP = 35; // ms before an open card moves to the next icon. Short enough to feel immediate, long enough that crossing a cell edge does not rewrite the card twice in a frame
const GLIDE = 340; // px: a hop shorter than this slides, a longer one jumps, so the card never travels across the page
const CARET_GAP = 14; // between the tooltip and the label it points at: the caret's tip stops 7 px short of the pill

type Elements = {
  labels: () => (HTMLDivElement | null)[];
  tip: () => HTMLDivElement | null;
  frame: () => HTMLDivElement | null; // the container, behind the canvas
  clip: () => HTMLDivElement | null; // the same rectangle in front of the canvas: it clips the labels
  content: () => HTMLDivElement | null; // what scrolls inside it
  beam: () => HTMLDivElement | null;
};

export type MatchPick = {
  match: Match;
  x: number;
  y: number;
  side: number;
};

/**
 * Everything drawn over the canvas: the container behind the matches, their probability labels, the tooltip for the
 * match under the cursor and the rim of light on the best one. They are DOM and written to only when something changes:
 * a label is placed once, in its cell, and the whole layer of labels moves as one when the container scrolls.
 */
export function createOverlays(
  scene: Scene,
  els: Elements,
  onPick?: (pick: MatchPick) => void,
) {
  const labels = Array.from({ length: MOST }, () => ({ body: -1, until: 0, shown: false })); // which match each label belongs to
  const pointer = { x: -1, y: -1 };
  const tipped = { body: -1, pending: -1, showAt: 0, width: 0, height: 0, x: 0, y: 0 };
  const wrote = { open: "", side: "", tip: "", caret: "", beam: "", beamOn: "", glide: "" }; // last values written, so nothing is written twice
  // What each card measured, so hovering back over a match a second time costs no layout. The card's width is capped
  // in CSS, so its size depends only on its text.
  const sized = new WeakMap<Match, { w: number; h: number }>();
  const half = (i: number) => (scene.size * (scene.grown.get(i) ?? 1)) / 2;
  const inBox = (x: number, y: number) => !!scene.box && x >= scene.box.x && x <= scene.box.x + scene.box.width && y >= scene.box.y && y <= scene.box.y + scene.box.height;

  const hitAt = (x: number, y: number) => {
    if (!inBox(x, y)) return -1;

    let over = -1;

    scene.holds.forEach((hold, i) => {
      const reach = half(i) + 3;

      if (
        hold.arrived
        && Math.abs(x - scene.bodies[i].position.x) < reach
        && Math.abs(y - scene.bodies[i].position.y) < reach
      ) {
        over = i;
      }
    });

    return over;
  };

  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  const onLeave = () => {
    pointer.x = pointer.y = -1;
  };
  const onUp = (e: PointerEvent) => {
    if (!onPick || e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("[data-seat]")) return;

    const over = hitAt(e.clientX, e.clientY);

    if (over < 0) return;

    const hold = scene.holds.get(over);

    if (!hold) return;

    const body = scene.bodies[over];
    const side = half(over) * 2;

    onPick({
      match: hold.match,
      x: body.position.x - side / 2,
      y: body.position.y - side / 2,
      side,
    });
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  /** The tooltip: what the match under the cursor is, in a box with a caret pointing at its label. */
  const placeTip = () => {
    const el = els.tip();
    if (!el) return;
    const over = hitAt(pointer.x, pointer.y);
    // It waits for the cursor to settle, and always fades out before it moves, so it never slides from one icon to
    // another and a sweep across the grid does not flash a card per icon.
    const setOpen = (on: boolean) => {
      const want = String(on);
      if (want !== wrote.open) el.dataset.open = wrote.open = want;
    };
    // Off every icon: the card fades out where it stands.
    if (over < 0) {
      tipped.pending = -1;
      if (tipped.body >= 0) {
        setOpen(false);
        tipped.body = -1;
      }
      return;
    }
    if (over !== tipped.pending) {
      tipped.pending = over;
      // Only the first card waits for the cursor to settle; that is what stops a sweep across the grid flashing one
      // card per icon. Once a card is up it simply moves, because fading the old one out and the new one in meant
      // 150 ms of nothing plus a 420 ms entrance for every icon, so reading along a row showed no complete card at all.
      tipped.showAt = scene.now + (tipped.body >= 0 ? HOP : REST);
    }
    if (scene.now < tipped.showAt) return;
    if (tipped.body !== over) {
      const hold = scene.holds.get(over);
      if (!hold) return;
      const part = (name: string) => el.querySelector<HTMLElement>(`[data-part="${name}"]`);
      part("name")!.textContent = hold.match.title;
      part("tagline")!.textContent = hold.match.tagline ?? "";
      part("tagline")!.hidden = !hold.match.tagline;
      part("detail")!.textContent = hold.match.detail ?? "";
      part("detail")!.hidden = !hold.match.detail;
      const had = sized.get(hold.match);
      if (had) {
        tipped.width = had.w; // measured before: no layout at all this time
        tipped.height = had.h;
      } else {
        tipped.width = el.offsetWidth; // one forced layout the first time this match is hovered, never per frame
        tipped.height = el.offsetHeight;
        sized.set(hold.match, { w: tipped.width, h: tipped.height });
      }
      tipped.body = over;
    }

    const body = scene.bodies[tipped.body];
    const { width: w, height: h } = tipped;
    const bx = body.position.x;
    const by = body.position.y;
    const r = half(tipped.body);
    const acrossX = Math.max(w / 2 + EDGE, Math.min(scene.width - w / 2 - EDGE, bx)); // centred on the icon, but never off the window
    const acrossY = Math.max(h / 2 + TOP_EDGE, Math.min(scene.height - h / 2 - EDGE, by));

    // Above is best. The grid is pressed against the top of the window though, so the first rows have no room there:
    // then the card goes beside the icon, where it hides two or three neighbours instead of two whole rows.
    const overIt = by - r - LABEL - CARET_GAP;
    const rightOf = bx + r + CARET_GAP;
    const leftOf = bx - r - CARET_GAP;
    const under = by + r + CARET_GAP;
    let side: "top" | "right" | "left" | "bottom";
    if (overIt - h >= TOP_EDGE) side = "top";
    else if (rightOf + w <= scene.width - EDGE) side = "right";
    else if (leftOf - w >= EDGE) side = "left";
    else side = "bottom";

    const place = {
      top: { transform: `translate3d(${Math.round(acrossX)}px, ${Math.round(overIt)}px, 0) translate(-50%, -100%)`, caret: `calc(50% + ${Math.round(bx - acrossX)}px)` },
      bottom: { transform: `translate3d(${Math.round(acrossX)}px, ${Math.round(under)}px, 0) translate(-50%, 0)`, caret: `calc(50% + ${Math.round(bx - acrossX)}px)` },
      right: { transform: `translate3d(${Math.round(rightOf)}px, ${Math.round(acrossY)}px, 0) translate(0, -50%)`, caret: `calc(50% + ${Math.round(by - acrossY)}px)` },
      left: { transform: `translate3d(${Math.round(leftOf)}px, ${Math.round(acrossY)}px, 0) translate(-100%, -50%)`, caret: `calc(50% + ${Math.round(by - acrossY)}px)` },
    }[side];

    // A short hop slides, a long one jumps, and the very first card never slides in from wherever the last one was.
    const glide = String(wrote.open === "true" && Math.hypot(bx - tipped.x, by - tipped.y) < GLIDE);
    tipped.x = bx;
    tipped.y = by;
    if (glide !== wrote.glide) el.dataset.glide = wrote.glide = glide;
    if (side !== wrote.side) el.dataset.side = wrote.side = side;
    if (place.caret !== wrote.caret) el.style.setProperty("--caret", (wrote.caret = place.caret));
    const transform = place.transform;
    if (transform !== wrote.tip) el.style.transform = wrote.tip = transform;
    setOpen(true);
  };

  const placeLabel = (el: HTMLDivElement, rest: Rest) => {
    if (!scene.box) return;
    el.style.transform = `translate3d(${Math.round(rest.x - scene.box.x)}px, ${Math.round(rest.y - rest.side / 2 - 6 - scene.box.y)}px, 0) translate(-50%, -100%)`;
  };

  return {
    /** Gives a match its probability label, placed once in its cell. Returns which label it got, or -1. */
    assign(i: number, rank: number, match: Match, rest: Rest, small: boolean): number {
      const label = labels.findIndex((l) => l.body < 0);
      if (label < 0) return -1;
      labels[label] = { body: i, until: 0, shown: false };
      const el = els.labels()[label];
      if (el) {
        el.textContent = `${Math.round(match.probability * 100)}%`;
        el.dataset.best = String(rank === 0);
        el.dataset.small = String(small);
        el.style.opacity = "0";
        placeLabel(el, rest);
      }
      return label;
    },

    /** The window changed: a label moves with its cell. */
    move(label: number, rest: Rest) {
      const el = els.labels()[label];
      if (el) placeLabel(el, rest);
    },

    /** The icon was let go: its label fades where it is, and is free again afterwards. */
    fade(label: number) {
      if (label < 0) return;
      labels[label].until = performance.now() + LABEL_FADE;
      labels[label].shown = false;
      const el = els.labels()[label];
      if (el) el.style.opacity = "0";
    },

    /** The container: one rectangle behind the canvas, and the same one in front of it that clips the labels. */
    frame(box: Box | null) {
      for (const el of [els.frame(), els.clip()]) {
        if (!el) continue;
        el.style.opacity = box ? "1" : "0";
        if (!box) continue;
        el.style.width = `${Math.round(box.width)}px`;
        el.style.height = `${Math.round(box.height)}px`;
        el.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`;
      }
    },

    /** One write moves every label. The soft edges say whether there is more above or below. */
    scroll(by: number, most: number) {
      const content = els.content();
      if (content) content.style.transform = `translate3d(0, ${-Math.round(by)}px, 0)`;
      const clip = els.clip();
      if (clip) {
        clip.dataset.above = String(by > 1);
        clip.dataset.below = String(by < most - 1);
      }
    },

    place(now: number) {
      // A label appears when its icon arrives. After that nothing here is touched until the icon is let go.
      // "In its cell" is strict here (within 8 px, or parked). A label that showed up while its icon was still 40 px away
      // and tilted is what made a scroll during the rise look broken.
      scene.holds.forEach((hold, i) => {
        const label = labels[hold.label];
        if (!label || label.shown) return;
        const body = scene.bodies[i];
        const home = hold.parked || (hold.arrived && Math.abs(body.position.x - hold.rest.x) < 8 && Math.abs(body.position.y - (hold.rest.y - scene.scroll)) < 8);
        if (!home) return;
        hold.labelled = true;
        scene.seatRev++;
        label.shown = true;
        const el = els.labels()[hold.label];
        if (el) el.style.opacity = "1";
      });
      for (const label of labels) if (label.until && now > label.until) Object.assign(label, { body: -1, until: 0 }); // faded out: free again
      placeTip();

      const beam = els.beam();
      if (!beam) return;
      let best = -1;
      scene.holds.forEach((hold, i) => {
        if (hold.rank === 0) best = i;
      });
      // The rim rides up with the best match, and hides while that match is scrolled out of the container.
      const b = best >= 0 ? scene.bodies[best] : null;
      const hidden = !b || (scene.holds.get(best)!.parked && !(inBox(b.position.x, b.position.y - half(best)) && inBox(b.position.x, b.position.y + half(best))));
      const on = hidden ? "0" : "1";
      if (on !== wrote.beamOn) beam.style.opacity = wrote.beamOn = on;
      if (hidden || !b) return;
      // It is laid out at full size and scaled down while the icon is still small, so it is crisp once grown.
      const k = (half(best) * 2) / scene.bigSize;
      const transform = `translate3d(${b.position.x - scene.bigSize / 2}px, ${b.position.y - scene.bigSize / 2}px, 0) rotate(${b.angle}rad) scale(${k})`;
      if (transform !== wrote.beam) beam.style.transform = wrote.beam = transform;
    },

    destroy() {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    },
  };
}
