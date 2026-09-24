import Matter from "matter-js";
import { wakeAt } from "./forces";
import { POP_IN, POP_OUT } from "./pop";
import { createReserve } from "./reserve";
import type { Scene } from "./scene";

const CHURN = 900; // ms between swaps: the pile is a moving window onto a library far larger than it can hold. Slower than
// when a swap happened in place, because now each one is a visible little event: one icon goes, another falls in.

/** Images popping in and out of the pile: the steady churn, and a search match that was not in the pile yet. */
export function createSwaps(scene: Scene, isDragged: (i: number) => boolean, stats: { swaps: number }) {
  const reserve = createReserve((src) => scene.srcs.includes(src));
  let churnAt = performance.now() + 6000; // the pile pours first

  return {
    /**
     * The image in `slot` shrinks away and `img` takes its place. With `rain` the new one does not appear where the old
     * one stood: it drops in from the top of the window and falls into the pile, which is how a pile gains an icon.
     */
    swapIn(slot: number, img: HTMLImageElement, src: string, delay = 0, then?: () => void, rain = false) {
      scene.pops.set(slot, { t0: performance.now() + delay, img, src, swapped: false, rain, then });
    },

    /** Every third of a second one image in the pile pops away and another from the library takes its place. */
    churn(now: number) {
      if (now < churnAt || scene.added < scene.bodies.length) return;
      churnAt = now + CHURN * (0.6 + Math.random() * 0.8);
      const i = Math.floor(Math.random() * scene.added);
      if (scene.holds.has(i) || scene.grown.has(i) || scene.pops.has(i) || isDragged(i)) return;
      const img = reserve.next();
      if (img) this.swapIn(i, img, img.getAttribute("src")!, 0, undefined, true);
    },

    /** Swaps in progress: at the halfway point the slot gets its new image. */
    run(now: number) {
      scene.pops.forEach((pop, i) => {
        const elapsed = now - pop.t0;
        if (!pop.swapped && elapsed >= POP_OUT) {
          pop.swapped = true;
          stats.swaps++;
          scene.srcs[i] = pop.src;
          scene.images[i] = pop.img;
          scene.tiles[i] = pop.img; // from here this body is drawn from its own picture, not from the packed sheet
          const wasDirty = scene.dirty;
          scene.retile(i);
          scene.dirty = wasDirty; // a swap only repaints its own patch of the canvas (see the frame loop), not all of it
          pop.then?.();
          if (pop.rain) {
            // Back in from the sky. It starts above the top of the window, in the clear space under the ceiling, so it is
            // already falling by the time it comes into view rather than appearing and then dropping.
            const body = scene.bodies[i];
            wakeAt(scene, body.position.x, body.position.y); // the icons resting on it must not hang over the hole it leaves
            Matter.Body.setPosition(body, { x: scene.size + Math.random() * Math.max(1, scene.width - scene.size * 2), y: -scene.size * (1.2 + Math.random() * 2.5) });
            Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.6, y: 0 });
            Matter.Body.setAngle(body, (Math.random() - 0.5) * 0.6);
            Matter.Body.setAngularVelocity(body, 0);
            Matter.Sleeping.set(body, false);
            scene.pops.delete(i); // it is full size on the way down, not springing up out of nothing
            scene.dirty = true;
            return;
          }
        }
        if (elapsed >= POP_OUT + POP_IN) {
          scene.pops.delete(i);
          scene.dirty = true; // the last frame of the spring has to be painted, and a patch redraw only covers pops still running
        }
      });
    },

    stop: () => reserve.stop(),
  };
}
