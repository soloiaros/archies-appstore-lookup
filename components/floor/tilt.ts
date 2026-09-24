import Matter from "matter-js";
import type { Scene } from "./scene";

const FEED = "http://127.0.0.1:3917/motion"; // native/motion.swift, started with the server by lib/motion.ts. Without it nothing here does anything
const SHAKE = 2.5; // how much harder a jolt pushes the icons than it pushed the laptop
const SPIN = 0.003; // sideways pull per degree/second of turning the laptop flat on the desk
const LID = 105; // degrees, used when the hinge sensor gives nothing
const LEVEL = 0.045; // the sensor rests at about -0.013 sideways, and a constant 1.3% pull slides the whole pile into a
// corner over a few minutes. Anything under this counts as level.
const FLIP_X = 1; // set to -1 if tilting the laptop to the right sends the icons left

type Sample = { a: [number, number, number]; w: [number, number, number]; lid: number | null };

/**
 * The MacBook's own accelerometer and gyro become the pile's gravity: tilt the laptop and the icons slide, shake it and
 * they jump. Browsers get no motion events on macOS, so a small native helper streams the sensor to this page.
 *
 * The sensor sits in the base: x to the right, y toward the hinge, z up, and lying flat it reads (0, 0, -1), the way
 * gravity points. The screen stands at the lid angle, so "down on the screen" is part of z and part of y.
 */
export function createTilt(scene: Scene) {
  const { engine } = scene;
  let source: EventSource | null = null;
  let timer = 0;
  let stopped = false;
  let wanted = false; // off until the page says otherwise
  let low: [number, number, number] | null = null; // the slow part of the signal: which way gravity points
  let seen = 0;
  let sign = 1;
  const settled = { x: 0, y: 1 }; // the gravity the sleeping pile came to rest under

  const apply = (gx: number, gy: number) => {
    engine.gravity.x = gx;
    engine.gravity.y = gy;
    // Sleeping bodies do not feel gravity change. Wake them when it has turned or jumped enough to matter.
    if (Math.hypot(gx - settled.x, gy - settled.y) < 0.1) return;
    settled.x = gx;
    settled.y = gy;
    for (let i = 0; i < scene.added; i++) if (!scene.holds.has(i)) Matter.Sleeping.set(scene.bodies[i], false); // parked matches stay parked
    scene.dirty = true;
  };

  const onSample = ({ a, w, lid }: Sample) => {
    low = low ? [low[0] + (a[0] - low[0]) * 0.08, low[1] + (a[1] - low[1]) * 0.08, low[2] + (a[2] - low[2]) * 0.08] : a;
    if (++seen === 15) sign = low[2] <= 0 ? 1 : -1; // some firmware reports the push of the desk instead of the pull of gravity
    if (seen < 15) return;
    // What loose things inside the laptop feel: gravity, plus every jolt, exaggerated.
    const p = [0, 1, 2].map((k) => sign * (low![k] + SHAKE * (a[k] - low![k])));
    const angle = ((lid && lid > 30 && lid < 170 ? lid : LID) * Math.PI) / 180;
    const turning = Math.abs(w[2]) > 8 ? w[2] : 0; // the gyro drifts by a few degrees/second at rest
    let gx = FLIP_X * p[0] + SPIN * turning;
    let gy = p[1] * Math.cos(angle) - p[2] * Math.sin(angle);
    if (Math.abs(gx) < LEVEL) gx = 0;
    const size = Math.hypot(gx, gy);
    if (size > 3) {
      gx *= 3 / size;
      gy *= 3 / size;
    }
    apply(gx, gy);
  };

  const connect = () => {
    if (stopped || !wanted || source) return;
    source = new EventSource(FEED);
    source.onmessage = (e) => {
      try {
        onSample(JSON.parse(e.data) as Sample);
      } catch {}
    };
    source.onerror = () => {
      // The helper is not running or went away: ordinary gravity, and a quiet retry later.
      disconnect();
      timer = window.setTimeout(connect, 20000);
    };
  };

  const disconnect = () => {
    window.clearTimeout(timer);
    source?.close();
    source = null;
    low = null;
    seen = 0;
    apply(0, 1);
  };

  return {
    /** The switch in the corner of the page. Off means ordinary gravity and no connection to the helper at all. */
    set(on: boolean) {
      wanted = on;
      if (on) connect();
      else disconnect();
    },
    stop() {
      stopped = true;
      disconnect();
    },
  };
}
