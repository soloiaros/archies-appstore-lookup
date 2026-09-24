import Matter from "matter-js";
import type { Scene } from "./scene";

/**
 * Stress-test hooks, reachable from the console as window.__floor. `jolt()` throws the whole pile as hard as a throw can
 * be; `overlaps()` then counts icons left deep inside one another (centres closer than 60% of a side) or outside the
 * window. Both must stay at 0: that is the check that hard hits no longer leave images overlapping.
 */
export function createDebug(scene: Scene) {
  const { bodies, grown } = scene;
  return {
    jolt() {
      for (let i = 0; i < scene.added; i++) {
        if (scene.holds.has(i)) continue;
        Matter.Sleeping.set(bodies[i], false);
        Matter.Body.setVelocity(bodies[i], { x: (Math.random() - 0.5) * 120, y: -Math.random() * 90 });
      }
    },
    /** How far the icons that have reached their cells are from those cells right now, in pixels. While scrolling this must stay small: it is the gap between an icon and its label. */
    drift() {
      let worst = 0;
      let arrived = 0;
      let parked = 0;
      scene.holds.forEach((hold, i) => {
        if (!hold.labelled) return; // only icons whose label is showing: that is the mismatch a person can see
        arrived++;
        if (hold.parked) parked++;
        worst = Math.max(worst, Math.abs(bodies[i].position.y - (hold.rest.y - scene.scroll)), Math.abs(bodies[i].position.x - hold.rest.x));
      });
      return { labelled: arrived, parked, flying: scene.holds.size - arrived, worstPx: Math.round(worst), scroll: Math.round(scene.scroll) };
    },
    /** Icons hanging in the air: asleep, well clear of the floor, and with nothing underneath holding them up. */
    floating() {
      const size = scene.size;
      let hanging = 0;
      for (let a = 0; a < scene.added; a++) {
        const me = bodies[a];
        if (scene.holds.has(a) || !me.isSleeping) continue;
        if (me.position.y > scene.height - size * 1.6) continue; // resting on the floor is not hanging
        let held = false;
        for (let b = 0; b < scene.added && !held; b++) {
          if (b === a) continue;
          const it = bodies[b].position;
          held = Math.abs(it.x - me.position.x) < size * 1.3 && it.y > me.position.y && it.y - me.position.y < size * 1.5;
        }
        if (!held) hanging++;
      }
      return hanging;
    },
    /**
     * Every match that is not sitting in its cell, and why. `belowBox` is the telling one: a cell that is not inside
     * the container at all, which is what an icon stranded under the search bar looks like.
     */
    stuck() {
      const box = scene.box;
      const out: Record<string, unknown>[] = [];
      scene.holds.forEach((hold, i) => {
        const restY = hold.rest.y - scene.scroll;
        const off = Math.round(Math.hypot(bodies[i].position.y - restY, bodies[i].position.x - hold.rest.x));
        const belowBox = !!box && restY > box.y + box.height;
        if (off < 6 && !belowBox) return;
        out.push({ rank: hold.rank, offPx: off, y: Math.round(bodies[i].position.y), restY: Math.round(restY),
                   boxBottom: box ? Math.round(box.y + box.height) : null, belowBox, arrived: hold.arrived, parked: hold.parked, t: +hold.t.toFixed(1) });
      });
      return { holds: scene.holds.size, offOrBelow: out.length, worst: out.sort((a, b) => (b.offPx as number) - (a.offPx as number)).slice(0, 8) };
    },
    overlaps() {
      let deep = 0;
      const reach = (scene.size * 0.6) ** 2;
      for (let a = 0; a < scene.added; a++) {
        if (grown.has(a)) continue;
        for (let b = a + 1; b < scene.added; b++) {
          if (grown.has(b)) continue;
          const dx = bodies[a].position.x - bodies[b].position.x;
          const dy = bodies[a].position.y - bodies[b].position.y;
          if (dx * dx + dy * dy < reach) deep++;
        }
      }
      const outside = bodies.slice(0, scene.added).filter((b) => b.position.x < 0 || b.position.x > scene.width || b.position.y > scene.height || b.position.y < -scene.size * 20).length;
      return { deep, outside };
    },
  };
}
