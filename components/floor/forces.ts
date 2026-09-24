import Matter from "matter-js";
import type { Scene } from "./scene";

export const STEP = 1000 / 60; // matter-js is only stable on a fixed timestep
export const SUBSTEPS = 3; // collision checks per step. Hard hits used to leave icons overlapping: three short steps catch them, one long step did not
// matter turns force into acceleration scaled by dt^2 (~278), so gravity is 0.001 in these units.
const SPRING = 0.00002; // ~6x gravity from across the screen: a brisk lift that eases in as it arrives
const DAMPING = 0.00046; // just under critical for that spring: one soft overshoot, then still
const TURN = 0.0000043; // the same kind of spring, for the angle: about 2 s to come upright
const TURN_DAMPING = 0.00026; // slightly over critical: it eases level and never wobbles past it

/**
 * Sleeping bodies behave like static walls, so a rising icon could never push past them, and icons resting on one that
 * leaves would hang in the air over the hole it left. Whenever something arrives at or leaves a spot, the icons around
 * that spot are woken so gravity can take over again. Only the neighbours, never the whole pile.
 */
export function wakeAt(scene: Scene, x: number, y: number) {
  const reach = (scene.size * 3.2) ** 2;
  const column = scene.size * 2.2; // everything stacked above the spot, however high, or it hangs over the hole
  for (let k = 0; k < scene.added; k++) {
    const other = scene.bodies[k];
    if (!other.isSleeping || scene.holds.has(k)) continue; // a parked match stays parked
    const dx = other.position.x - x;
    const dy = other.position.y - y;
    if (dx * dx + dy * dy < reach || (Math.abs(dx) < column && dy < scene.size)) Matter.Sleeping.set(other, false);
  }
}

export const wakeNear = (scene: Scene, body: Matter.Body) => wakeAt(scene, body.position.x, body.position.y);

/**
 * A match is never teleported. Gravity is cancelled on it and a soft spring pulls it to its rest point, so it
 * accelerates, leans, overshoots once and settles under its own momentum. This runs once per physics substep, not
 * once per animation frame: at 120 Hz a per-frame force would land twice per step and send it off the screen.
 * Velocities are read through Body.getVelocity, which is per 1/60 s whatever the substep, so the tuning holds.
 */
export function applyHoldForces(scene: Scene, dt: number) {
  const { engine, bodies, holds, size } = scene;
  let moving = false;
  holds.forEach((hold, i) => {
    const body = bodies[i];
    if (hold.parked) {
      if (!body.isSleeping) Matter.Sleeping.set(body, true); // something woke it (a drag, a jolt): back to sleep, it has a place
      return;
    }
    moving = true;
    Matter.Sleeping.set(body, false);
    const part = dt / STEP;
    const v = Matter.Body.getVelocity(body);
    hold.t += dt / 1000;
    const restY = hold.rest.y - scene.scroll;
    // If the pile has it pinned (far from the rest point but barely moving), lean harder until it breaks free.
    const far = Math.abs(restY - body.position.y) > 40;
    hold.boost = far && Matter.Body.getSpeed(body) < 3 ? Math.min(6, hold.boost + 0.12 * part) : Math.max(1, hold.boost - 0.15 * part);
    if (hold.boost > 1.2) wakeNear(scene, body);
    // It collides all the way up. Once it has arrived it stops, so that pile icons it carried up on its back
    // fall off instead of sitting on it, and so that the row of matches cannot jostle itself out of line.
    // "Arrived" is generous on purpose: within most of its own size of the slot, or 3 s after setting off at the latest.
    // With a tight test, pile icons wedged against a match kept it just short of its slot, and so kept riding on it.
    const near = Math.max(26, size * hold.scale * 0.8);
    if (!hold.arrived && ((Math.abs(restY - body.position.y) < near && Math.abs(hold.rest.x - body.position.x) < near) || hold.t > 3)) {
      hold.arrived = true;
      body.collisionFilter.mask = 0;
      wakeNear(scene, body);
    }
    // Soft on the way up through the pile. Once it has arrived nothing is in its way any more, so it homes in on its
    // cell with a spring five times as stiff (damping scales with the square root, which keeps it from overshooting).
    const firm = hold.arrived ? 5 : 1;
    const pullX = (hold.rest.x - body.position.x) * SPRING * hold.boost * firm - v.x * DAMPING * Math.sqrt(firm);
    const pullY = (restY - body.position.y) * SPRING * hold.boost * firm - v.y * DAMPING * Math.sqrt(firm);
    // Gravity is cancelled in both directions: with the motion sensor on, it can point anywhere.
    Matter.Body.applyForce(body, body.position, { x: (pullX - engine.gravity.x * engine.gravity.scale) * body.mass, y: (pullY - engine.gravity.y * engine.gravity.scale) * body.mass });
    // It also turns upright, by the shortest way round, under a torque: bumps on the way up can still knock it about.
    const lean = Math.atan2(Math.sin(body.angle), Math.cos(body.angle));
    // Slowly on the way up, briskly once it is in its cell: a grid of icons that stay tilted for two seconds looks unfinished.
    const brisk = hold.arrived ? 7 : 1;
    body.torque += (-lean * TURN * brisk - Matter.Body.getAngularVelocity(body) * TURN_DAMPING * Math.sqrt(brisk)) * body.inertia;

    // Settled: in its cell, upright, full size and still. It is snapped exactly into place and put to sleep. A row of
    // matches that kept bobbing meant repainting the whole canvas on every frame for as long as they were up.
    const off = Math.hypot(hold.rest.x - body.position.x, restY - body.position.y);
    const grownUp = Math.abs((scene.grown.get(i) ?? 1) - hold.scale) < 0.01;
    const settled = off < 0.8 && Math.abs(lean) < 0.012 && Matter.Body.getSpeed(body) < 0.12;
    if (hold.arrived && grownUp && (settled || hold.t > 7)) park(scene, i);
  });
  if (moving) scene.dirty = true;
}

/** Put a match exactly in its cell, upright and asleep. Scrolling moves parked matches the same way. */
export function park(scene: Scene, i: number) {
  const hold = scene.holds.get(i);
  if (!hold) return;
  const body = scene.bodies[i];
  Matter.Body.setPosition(body, { x: hold.rest.x, y: hold.rest.y - scene.scroll });
  Matter.Body.setAngle(body, 0);
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(body, 0);
  Matter.Sleeping.set(body, true);
  hold.parked = true;
  hold.arrived = true;
  body.collisionFilter.mask = 0;
  scene.dirty = true;
}

/** Ease every grown icon toward the size it should be right now, scaling its rigid body along with it. */
export function applyGrowth(scene: Scene, part = 1) {
  const { bodies, holds, grown, sharp } = scene;
  grown.forEach((scale, i) => {
    const body = bodies[i];
    const hold = holds.get(i);
    let want = 1;
    if (hold) {
      const span = hold.startY - (hold.rest.y - scene.scroll);
      const progress = Math.abs(span) > 1 ? Math.max(0, Math.min(1, (hold.startY - body.position.y) / span)) : 1;
      const late = Math.max(0, (progress - 0.3) / 0.7); // stay small while still inside the pile
      want = 1 + (hold.scale - 1) * late * late * (3 - 2 * late);
    }
    // 0.12 of the way there per 1/60 s. `part` is how much of one of those this call covers, so the easing is the same
    // whether it arrives as one call or as three, which is what lets the substeps be spread across frames.
    let next = scale + (want - scale) * (part >= 1 ? 0.12 : 1 - (1 - 0.12) ** part);
    if (Math.abs(want - next) < 0.004) next = want;
    if (next !== scale) {
      Matter.Sleeping.set(body, false);
      Matter.Body.scale(body, next / scale, next / scale);
      scene.dirty = true;
    }
    if (next === 1 && !hold) {
      grown.delete(i);
      sharp.delete(i);
    } else grown.set(i, next);
  });
}
