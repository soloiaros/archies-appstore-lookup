import Matter from "matter-js";
import type { Scene } from "./scene";

const WALL = 400; // thick walls: even a body that gets pressed into one cannot come out the other side
export const HEADROOM = 140; // clear space above the window, under the ceiling, where a new icon starts its fall unseen

/**
 * Keeps every icon inside the window: four thick walls (the top one closes once the pile has poured in), a speed limit
 * so that no body can travel further than its own size between two collision checks, a pointer that cannot drag a body
 * past the edge, and a last-resort rescue for anything that still ends up outside.
 */
export function createBounds(scene: Scene, canvas: HTMLCanvasElement, mouse: Matter.Mouse) {
  const { engine, bodies } = scene;
  let walls: Matter.Body[] = [];
  let ceiling: Matter.Body | null = null;
  let checked = 0;

  // The ceiling sits well above the window, not right on its edge, so an icon can be dropped in out of sight and is
  // already falling by the time you see it.
  const makeCeiling = () => Matter.Bodies.rectangle(scene.width / 2, -HEADROOM - WALL / 2, scene.width + WALL * 2, WALL, { isStatic: true });

  // The physics mouse reads the pointer on its own. This listener runs after it and pulls the point back inside.
  const clampPointer = () => {
    const pad = scene.size / 2;
    mouse.position.x = Math.max(pad, Math.min(scene.width - pad, mouse.position.x));
    mouse.position.y = Math.max(pad, Math.min(scene.height - pad, mouse.position.y));
  };
  canvas.addEventListener("mousemove", clampPointer);

  return {
    build() {
      const { width, height } = scene;
      Matter.Composite.remove(engine.world, walls);
      walls = [
        Matter.Bodies.rectangle(width / 2, height + WALL / 2, width + WALL * 2, WALL, { isStatic: true, friction: 0.9 }),
        Matter.Bodies.rectangle(-WALL / 2, height / 2, WALL, height * 4 + WALL * 2, { isStatic: true }),
        Matter.Bodies.rectangle(width + WALL / 2, height / 2, WALL, height * 4 + WALL * 2, { isStatic: true }),
      ];
      if (ceiling) walls.push((ceiling = makeCeiling()));
      Matter.Composite.add(engine.world, walls);
    },

    /**
     * A small fast body can be on one side of another body at one check and on the other side at the next, or end up
     * deep inside it. Capping the distance covered per step at under half its size makes that impossible.
     */
    limitSpeeds(dt: number) {
      const perStep = 1000 / 60 / dt; // getVelocity and setVelocity speak in distance per 1/60 s, whatever the substep
      for (let i = 0; i < scene.added; i++) {
        const body = bodies[i];
        if (body.isSleeping) continue;
        const most = scene.size * (scene.grown.get(i) ?? 1) * 0.45 * perStep;
        const speed = Matter.Body.getSpeed(body);
        if (speed > most) {
          const v = Matter.Body.getVelocity(body);
          Matter.Body.setVelocity(body, { x: (v.x * most) / speed, y: (v.y * most) / speed });
        }
      }
    },

    /** Once a second: close the top when everything has come in, and bring back anything that got out anyway. */
    patrol(frame: number) {
      if (frame - checked < 60) return;
      checked = frame;
      const { width, height, size } = scene;
      if (!ceiling && scene.added === bodies.length && bodies.every((b) => b.position.y > size)) {
        ceiling = makeCeiling();
        walls.push(ceiling);
        Matter.Composite.add(engine.world, ceiling);
      }
      for (let i = 0; i < scene.added; i++) {
        const { x, y } = bodies[i].position;
        const out = x < -size || x > width + size || y > height + size || (ceiling && y < -HEADROOM) || Number.isNaN(x + y);
        if (!out || scene.holds.has(i)) continue;
        Matter.Body.setPosition(bodies[i], { x: width * (0.3 + Math.random() * 0.4), y: size * 2 });
        Matter.Body.setVelocity(bodies[i], { x: 0, y: 0 });
        Matter.Sleeping.set(bodies[i], false);
      }
    },

    destroy: () => canvas.removeEventListener("mousemove", clampPointer),
  };
}
