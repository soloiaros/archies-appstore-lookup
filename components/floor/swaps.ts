import Matter from "matter-js";
import { wakeAt } from "./forces";
import { POP_IN, POP_OUT } from "./pop";
import { createReserve } from "./reserve";
import type { Scene } from "./scene";

/** Images popping in for a search match that was not in the pile yet. */
export function createSwaps(scene: Scene, isDragged: (i: number) => boolean, stats: { swaps: number }) {
  const reserve = createReserve((src) => scene.srcs.includes(src));

  return {
    /**
     * The image in `slot` shrinks away and `img` takes its place. With `rain` the new one does not appear where the old
     * one stood: it drops in from the top of the window and falls into the pile, which is how a pile gains an icon.
     */
    swapIn(slot: number, img: HTMLImageElement, src: string, delay = 0, then?: () => void, rain = false) {
      scene.pops.set(slot, { t0: performance.now() + delay, img, src, swapped: false, rain, then });
    },

    /** Idle library rain — off. It never stopped waking the pile and on phones it crushed the tab. */
    churn(_now: number) {},

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
