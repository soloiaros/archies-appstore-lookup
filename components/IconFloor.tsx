"use client";

import Matter from "matter-js";
import { BorderBeam } from "border-beam";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createAtlas, type Sheet } from "./floor/atlas";
import { createBounds } from "./floor/bounds";
import { createDebug } from "./floor/debug";
import { applyGrowth, applyHoldForces, STEP, SUBSTEPS } from "./floor/forces";
import type { Anchor } from "./floor/layout";
import { createMatches } from "./floor/matches";
import { createOverlays, MOST, type MatchPick } from "./floor/overlays";
import { popScale } from "./floor/pop";
import type { Match, Scene } from "./floor/scene";
import { renderSprite } from "./floor/sprite";
import { createSwaps } from "./floor/swaps";
import { createTilt } from "./floor/tilt";

export type { Match };

export type FloorApi = {
  /** Shake the pile. 0 is a nudge, 1 is a hard jolt. */
  shake: (intensity: number) => void;
  /** Float the matches up out of the pile, best first. They stay physics bodies throughout, each with its probability above it. */
  select: (matches: Match[], getAnchor: () => Anchor) => void;
  /** Let every floating icon go. Labels fade, gravity takes the icons back into the pile. */
  release: () => void;
  /** A new image arrived while the page is open: it drops into the pile from above. */
  add: (src: string) => void;
  /** Let the MacBook's motion sensor steer gravity, or not. */
  setMotion: (on: boolean) => void;
};

type Props = {
  sources: string[];
  /** Which cell of the packed sheet each pile icon is, or -1 for one that has to be loaded on its own (an upload). */
  cells: number[];
  sheet: Sheet | null;
  apiRef: React.RefObject<FloorApi | null>;
  /** Called once the world is built and `apiRef` is live. A rebuild means whatever was floating has to be sent again. */
  onReady?: () => void;
  onMatchOpen?: (pick: MatchPick) => void;
};

const loadImage = (src: string) => {
  const img = new Image();
  img.decoding = "async";
  if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
  img.src = src;
  return img;
};

/**
 * Every icon is a rigid body: they drop in, settle on the floor, and can be thrown with the cursor.
 * This file owns the world, the frame loop and the drawing. The springs are in floor/forces, the labels in
 * floor/overlays, and the images popping in and out in floor/swaps.
 */
/**
 * Memoised, and every one of its props is stable on purpose. Typing re-renders the page on each keystroke, and without
 * this the floor re-rendered with it: 180 label elements reconciled, and, because their ref was an inline arrow, 180
 * refs detached and re-attached, thirteen times a second. That alone was most of the jank while typing.
 */
export const IconFloor = memo(function IconFloor({ sources, cells, sheet, apiRef, onReady, onMatchOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const onMatchOpenRef = useRef(onMatchOpen);
  onMatchOpenRef.current = onMatchOpen;
  // One callback per slot, made once. An inline arrow here is a new identity every render, which makes React drop and
  // re-take all 180 refs each time.
  const setLabel = useMemo(() => Array.from({ length: MOST }, (_, k) => (el: HTMLDivElement | null) => void (labelRefs.current[k] = el)), []);
  const [iconSize, setIconSize] = useState(96);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    engine.enableSleeping = true; // bodies that stop moving leave the solver: no jitter, and far less CPU
    // These run in each of the three substeps, so a step gets 12 position passes in all (it was 4): hard hits no longer leave icons overlapping.
    engine.positionIterations = 4;
    engine.velocityIterations = 3;

    // Sleep is decided from speed per 1/60 s. With three substeps the solver's tiny resting corrections read three times
    // faster (nine times the "motion"), so a settled pile stayed awake for seconds. The thresholds move up to match.
    const sleeping = Matter.Sleeping as unknown as { _motionSleepThreshold: number; _motionWakeThreshold: number };
    sleeping._motionSleepThreshold = 0.35;
    sleeping._motionWakeThreshold = 0.8;

    const srcs = [...sources];
    const scene: Scene = {
      engine, srcs, images: srcs.map(() => null), tiles: srcs.map((_, i) => (sheet && cells[i] >= 0 ? cells[i] : null)),
      atlas: createAtlas(), sheet, sheetImg: null, bodies: [],
      grown: new Map(), sharp: new Map(), holds: new Map(), pops: new Map(), box: null, scroll: 0,
      width: 0, height: 0, size: 96, bigSize: 96, midSize: 56, dpr: 1, added: 0, dirty: true, now: performance.now(),
      retile(i) {
        const tile = scene.tiles[i];
        if (typeof tile === "number") {
          if (scene.sheetImg?.complete && scene.sheetImg.naturalWidth) scene.atlas.putSheet(i, sheet!, scene.sheetImg, tile);
        } else if (!scene.atlas.putImage(i, tile)) return; // its own picture has not arrived yet; it will call back
        if (scene.grown.has(i)) scene.sharp.set(i, renderSprite(scene.images[i], scene.bigSize, scene.dpr)); // keep the enlarged copy crisp after a resize
        scene.dirty = true;
      },
      ensureImage(i) {
        const had = scene.images[i];
        if (had && had.getAttribute("src") === srcs[i]) return had;
        const img = loadImage(srcs[i]);
        scene.images[i] = img;
        return img;
      },
    };
    const { images, bodies, holds, grown, sharp, pops } = scene;

    /** Redraw every cell. One pass over the pile, and the only thing a resize costs. */
    const rebake = () => {
      scene.atlas.layout(srcs.length, scene.size * scene.dpr);
      for (let i = 0; i < srcs.length; i++) scene.retile(i);
      scene.dirty = true;
    };

    // The packed sheet: one request for the whole pile. Anything it does not cover, and anything that arrives later,
    // loads its own image and draws itself into its cell when it lands.
    if (sheet) {
      const img = loadImage(sheet.url);
      scene.sheetImg = img;
      if (img.complete && img.naturalWidth) rebake();
      else img.onload = () => rebake();
      img.onerror = () => {
        scene.sheet = null; // no sheet: fall back to one image each, which is slower but still works
        for (let i = 0; i < srcs.length; i++) if (typeof scene.tiles[i] === "number") loadOwn(i);
      };
    }
    /** Give body `i` its own picture for the pile, for want of a cell in the sheet. */
    function loadOwn(i: number) {
      const img = scene.ensureImage(i);
      scene.tiles[i] = img;
      if (img.complete && img.naturalWidth) scene.retile(i);
      else img.onload = () => scene.tiles[i] === img && scene.retile(i);
    }
    srcs.forEach((_, i) => {
      if (scene.tiles[i] === null) loadOwn(i);
    });

    const mouse = Matter.Mouse.create(canvas);
    const bounds = createBounds(scene, canvas, mouse);
    const resize = () => {
      const dpr = (scene.dpr = Math.min(window.devicePixelRatio || 1, 2));
      const width = (scene.width = canvas.clientWidth);
      const height = (scene.height = canvas.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Small enough that the settled pile stays under the search bar: at most ~38% of the window, however many images there are.
      const fits = Math.sqrt((0.38 * height * width * 0.75) / Math.max(1, srcs.length));
      scene.size = Math.max(10, Math.min(25, width / 55, fits));
      scene.bigSize = Math.max(64, Math.min(104, width / 12));
      scene.midSize = Math.max(40, Math.min(60, width / 22));
      setIconSize(scene.bigSize);
      bounds.build();
      rebake();
    };
    resize();

    // Plain 4-corner boxes: the rounded corners are only painted. A chamfered body has ~16 corners, and collision
    // checks cost per corner, which is what made a pile of hundreds lag.
    const spawn = (i: number) =>
      Matter.Bodies.rectangle(scene.width * (0.1 + 0.8 * ((i * 0.618) % 1)), -scene.size * (1.4 + (i % 12) * 1.3), scene.size, scene.size, {
        restitution: 0.45,
        friction: 0.6,
        frictionStatic: 1.2,
        frictionAir: 0.014,
        angle: (Math.random() - 0.5) * 0.6,
        sleepThreshold: 30, // in 1/60 s steps (matter scales it to the substep): half a second of stillness, enough for an overlap to be pushed apart first
      });
    images.forEach((_, i) => bodies.push(spawn(i)));

    const drag = Matter.MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.14, render: { visible: false } } });
    Matter.Composite.add(engine.world, drag);
    const wheel = (mouse as unknown as { mousewheel: EventListener }).mousewheel;
    canvas.removeEventListener("wheel", wheel); // the physics mouse otherwise swallows the wheel

    /**
     * What the frames actually cost, measured where they happen. "Smooth" is not an average: a run at 120 fps with one
     * 40 ms frame a second reads as a stutter, and the mean hides it completely. So this keeps the last couple of
     * seconds of frame gaps and reports the median, the 95th, and how many were late enough to see.
     */
    const pace: number[] = [];
    const PACE = 240; // about two seconds at 120 Hz
    const paced = () => {
      if (pace.length < 8) return { fps: 0, p50: 0, p95: 0, late: 0 };
      const sorted = [...pace].sort((a, b) => a - b);
      const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
      const mid = at(0.5);
      return {
        fps: Math.round(1000 / mid),
        p50: +mid.toFixed(1),
        p95: +at(0.95).toFixed(1),
        late: pace.filter((d) => d > mid * 1.6).length, // frames that missed their slot by enough to be seen
      };
    };
    const stats = { stepMs: 0, drawMs: 0, awake: 0, swaps: 0, gx: 0, gy: 1, paced }; // read from the console as window.__floor when chasing lag
    (window as unknown as { __floor?: unknown }).__floor = Object.assign(stats, createDebug(scene));
    const overlays = createOverlays(
      scene,
      {
        labels: () => labelRefs.current,
        tip: () => tipRef.current,
        frame: () => frameRef.current,
        clip: () => clipRef.current,
        content: () => contentRef.current,
        beam: () => beamRef.current,
      },
      (pick) => onMatchOpenRef.current?.(pick),
    );
    const swaps = createSwaps(scene, (i) => drag.body === bodies[i], stats);
    const tilt = createTilt(scene);
    const matches = createMatches(scene, overlays, swaps, loadImage);
    Object.assign(stats, { holes: () => matches.holes() });

    const SUB = STEP / SUBSTEPS; // one substep of simulated time, the unit the world actually advances by
    const CATCH_UP = 4; // most substeps in one frame, so a stall cannot cascade into a long freeze
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    let acc = 0;
    let dropAt = performance.now() + 200;
    let lastShake = 0;

    if (reduced) {
      Matter.Composite.add(engine.world, bodies);
      scene.added = bodies.length;
      for (let i = 0; i < 500; i++) Matter.Engine.update(engine, STEP);
    }

    const paint = (i: number, scale: number) => {
      const sprite = (scale > 1 ? sharp.get(i) : null) ?? scene.atlas.patch(i);
      if (!sprite) return;
      const body = bodies[i];
      const pop = pops.get(i);
      const side = scene.size * scale * (pop ? popScale(scene.now - pop.t0) : 1);
      if (side < 0.5) return;
      const { dpr } = scene;
      const cos = Math.cos(body.angle);
      const sin = Math.sin(body.angle);
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * body.position.x, dpr * body.position.y); // one call instead of save/translate/rotate/restore
      ctx.drawImage(sprite.img, sprite.x, sprite.y, sprite.w, sprite.w, -side / 2, -side / 2, side, side);
    };

    const draw = () => {
      const { dpr, box } = scene;
      ctx.clearRect(0, 0, scene.width, scene.height);
      for (let i = 0; i < scene.added; i++) if (!grown.has(i)) paint(i, 1);
      // Grown icons go on top. Those still rising, or shrinking on the way down, are painted freely. Those that have
      // settled belong to the container: they are clipped to it, which is what lets it scroll.
      const settled: number[] = [];
      grown.forEach((scale, i) => {
        const hold = holds.get(i);
        const { x, y } = bodies[i].position;
        const reach = scene.size * scale; // a row that only peeks into the container has its centre just outside it
        const close = !!box && x > box.x && x < box.x + box.width && y > box.y - reach && y < box.y + box.height + reach;
        // An icon belongs to the container once it is at its cell, not merely once it counts as arrived. "Arrived" is
        // also set after three seconds however far away it still is, and clipping one to the container while it was
        // still climbing past the search bar cut it in half and then swallowed it, which read as icons vanishing
        // underneath the bar. Anything still travelling is drawn free, on top of everything, all the way home.
        const home = !!hold && Math.abs(y - (hold.rest.y - scene.scroll)) < reach && Math.abs(x - hold.rest.x) < reach;
        if (box && hold && (hold.parked || (hold.arrived && close && home))) settled.push(i);
        else paint(i, scale);
      });
      if (box && settled.length) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        ctx.roundRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2, 4);
        ctx.clip();
        for (const i of settled) {
          const y = bodies[i].position.y;
          const reach = scene.size * (grown.get(i) ?? 1);
          if (y + reach > box.y && y - reach < box.y + box.height) paint(i, grown.get(i) ?? 1); // rows scrolled out of sight are skipped
        }
        ctx.restore();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /**
     * An image swapping in the resting pile changes a patch a few dozen pixels wide. Repainting only that patch, and not
     * millions of pixels of canvas three times a second, is what keeps a large window smooth while nothing else moves.
     */
    const drawSwaps = () => {
      const { dpr, size } = scene;
      const r = size * 0.9; // the overshoot of the pop, at any angle
      pops.forEach((_, i) => {
        if (grown.has(i)) return;
        const { x, y } = bodies[i].position;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        ctx.rect(x - r, y - r, r * 2, r * 2);
        ctx.clip();
        ctx.clearRect(x - r, y - r, r * 2, r * 2);
        for (let k = 0; k < scene.added; k++) {
          const at = bodies[k].position;
          const reach = r + size * (grown.get(k) ?? 1);
          if (Math.abs(at.x - x) < reach && Math.abs(at.y - y) < reach) paint(k, grown.get(k) ?? 1);
        }
        ctx.restore();
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const raw = now - last;
      if (raw > 0 && raw < 500) {
        pace.push(raw); // a gap over half a second is the tab being parked, not a dropped frame
        if (pace.length > PACE) pace.shift();
      }
      const elapsed = Math.min(now - last, 120);
      last = now;
      scene.now = now;
      if (!reduced) {
        swaps.churn(now);
        // A small library trickles in one by one; a large one pours, so the whole pile is down in about 4 seconds.
        const gap = Math.min(50, 4000 / Math.max(1, bodies.length));
        let poured = 0;
        while (scene.added < bodies.length && now >= dropAt && poured < 12) {
          Matter.Composite.add(engine.world, bodies[scene.added++]);
          dropAt = Math.max(dropAt + gap, now - 100);
          poured++;
          scene.dirty = true;
        }
        // The substeps are spread across frames rather than fired in bursts. A 1/60 s step is three 1/180 s substeps,
        // so on a 120 Hz screen the old loop ran three of them on one frame and none on the next: half the frames did
        // all the work and the pacing alternated visibly, about 6 ms then 10.5 ms, even though the work itself is
        // under a millisecond. Draining one substep at a time gives 1, 1, 2, 1, 1, 2 instead of 3, 0, 3, 0. The
        // simulation sees exactly the same fixed 1/180 s steps it always did; only when they arrive has changed.
        acc += elapsed;
        let ran = 0;
        const t0 = performance.now();
        while (acc >= SUB && ran < CATCH_UP) {
          applyGrowth(scene, SUB / STEP);
          applyHoldForces(scene, SUB);
          bounds.limitSpeeds(SUB);
          Matter.Engine.update(engine, SUB);
          acc -= SUB;
          ran++;
        }
        if (ran) stats.stepMs += ((performance.now() - t0) / ran - stats.stepMs) * 0.1; // now per substep
        if (acc > SUB * CATCH_UP) acc = 0; // never try to catch up after a stall: slow motion beats a freeze
      }
      swaps.run(now);
      bounds.patrol(++frames);
      matches.tick(frames);
      let awake = 0;
      for (let i = 0; i < scene.added; i++) if (!bodies[i].isSleeping) awake++;
      stats.awake = awake;
      stats.gx = engine.gravity.x; // what the motion sensor has made of gravity, if it is on
      stats.gy = engine.gravity.y;
      if (awake) scene.dirty = true;
      overlays.place(now);
      if (scene.dirty) {
        const t0 = performance.now();
        draw();
        stats.drawMs += (performance.now() - t0 - stats.drawMs) * 0.1;
        scene.dirty = false;
      } else if (pops.size) drawSwaps();
    };
    raf = requestAnimationFrame(frame);

    apiRef.current = {
      shake(intensity) {
        const now = performance.now();
        if (now - lastShake < 70 || !scene.added) return; // a burst of keystrokes must not compound into one big throw
        lastShake = now;
        const power = Math.max(0.05, Math.min(1, intensity)) * Math.max(0.25, scene.size / 110); // tuned at ~110 px icons, scaled to the current size
        // Only a handful of icons jump. Waking the whole pile on every keystroke is what made typing lag.
        const jolts = Math.min(28, Math.ceil(scene.added * 0.06));
        for (let n = 0; n < jolts; n++) {
          const i = Math.floor(Math.random() * scene.added);
          const body = bodies[i];
          if (holds.has(i) || body.position.y < scene.height * 0.45) continue;
          Matter.Sleeping.set(body, false);
          Matter.Body.setVelocity(body, { x: body.velocity.x + (Math.random() - 0.5) * 2.2 * power, y: body.velocity.y - Math.random() * 1.6 * power });
          Matter.Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.04 * power);
        }
        scene.dirty = true;
      },
      select: (found, getAnchor) => matches.select(found, getAnchor),
      release: () => matches.release(),
      add(src) {
        if (srcs.includes(src)) return;
        const i = srcs.push(src) - 1;
        images.push(null);
        scene.tiles.push(null);
        loadOwn(i);
        const body = spawn(i);
        Matter.Body.setPosition(body, { x: scene.width * (0.3 + Math.random() * 0.4), y: -scene.size * 1.5 }); // above the window, under the ceiling: it falls in
        bodies.push(body); // the drop loop adds it to the world on its next tick
        scene.dirty = true;
      },
      setMotion: (on) => tilt.set(on),
    };
    onReady?.();

    const onResize = () => {
      resize();
      matches.relayout();
      for (let i = 0; i < scene.added; i++) {
        const body = bodies[i];
        if (holds.has(i)) continue;
        if (body.position.y > scene.height + scene.size * 3 || body.position.x < -scene.size || body.position.x > scene.width + scene.size) {
          Matter.Body.setPosition(body, { x: scene.width / 2, y: -scene.size * 1.5 });
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
          Matter.Sleeping.set(body, false);
        }
      }
    };
    window.addEventListener("resize", onResize);
    // The wheel scrolls the container when the cursor is over it and there is more than fits.
    const onWheel = (e: WheelEvent) => {
      if (matches.scrollBy(e.deltaY, e.clientX, e.clientY)) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      overlays.destroy();
      bounds.destroy();
      tilt.stop();
      swaps.stop();
      apiRef.current = null;
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    };
  }, [sources, cells, sheet, apiRef, onReady]);

  return (
    <>
      {/* The container the matches gather in. It comes before the canvas, so every icon is drawn over it. */}
      <div ref={frameRef} aria-hidden className="match-frame pointer-events-none fixed left-0 top-0 rounded-[5px] border border-line bg-panel" style={{ opacity: 0 }} />
      <canvas ref={canvasRef} aria-hidden className="fixed inset-0 h-full w-full" style={{ touchAction: "pan-y" }} />
      {/* The real border-beam, riding the best match's actual edge. The icon itself is still drawn by the
          canvas underneath; this layer is only the rim of light, and it copies the body's pose every frame. */}
      <div
        ref={beamRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 will-change-transform"
        style={{ width: iconSize, height: iconSize, opacity: 0, transition: "opacity 300ms ease-out" }}
      >
        <BorderBeam size="md" colorVariant="colorful" theme="dark" strength={1} brightness={1.9} saturation={1.5} borderRadius={iconSize * 0.225}>
          <div style={{ width: iconSize, height: iconSize, borderRadius: iconSize * 0.225 }} />
        </BorderBeam>
      </div>
      {/* The container again, in front of the canvas this time: it clips the labels and carries the soft edges that
          show there is more to scroll to. One probability label per match, each placed once in its cell. */}
      <div ref={clipRef} aria-hidden data-above="false" data-below="false" className="match-clip pointer-events-none fixed left-0 top-0 z-20 overflow-hidden rounded-[5px]" style={{ opacity: 0 }}>
        <div ref={contentRef} className="absolute inset-0 will-change-transform">
          {Array.from({ length: MOST }, (_, k) => (
            <div
              key={k}
              ref={setLabel[k]}
              className="match-label absolute left-0 top-0 rounded-[4px] border border-line-strong bg-panel px-2 py-0.5 text-[11.5px] font-medium tabular-nums tracking-[-0.01em] text-muted data-[best=true]:text-text data-[small=true]:px-1.5 data-[small=true]:text-[10px]"
              style={{ opacity: 0 }}
            />
          ))}
        </div>
      </div>
      {/* What the match under the cursor is: a box with a caret pointing down at it. The words fade in one after another. */}
      <div ref={tipRef} aria-hidden data-open="false" data-side="top" className="match-tip pointer-events-none fixed left-0 top-0 z-30 will-change-transform">
        <div className="relative max-w-[290px] rounded-[5px] border border-line-strong bg-raised px-4 py-3 will-change-[filter,transform]">
          <p data-part="name" className="text-[14px] font-semibold tracking-[-0.012em] text-text" />
          <p data-part="tagline" className="mt-1 text-[12.5px] leading-[1.45] text-muted" />
          <p data-part="detail" className="mt-2 text-[11px] tracking-[0.02em] text-faint" />
          <span className="match-tip-caret border-line-strong bg-raised" />
        </div>
      </div>
    </>
  );
});
