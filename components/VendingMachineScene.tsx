"use client";

import { useEffect, useRef } from "react";

import GUI from "lil-gui";
import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import {
  playCoinSound,
  playFallSound,
} from "@/lib/sounds";

/**
 * Served asset: public/vending_machine_optimized.glb
 * (copy of vending_machine_optimized._lights_full.glb).
 */
const MODEL_URL = "/vending_machine_optimized.glb";

/** Four shelf rows (row 5 removed). */
const ROW_COUNT = 4;

const GLASS_MESH = "pCube413_lambert1_0";

const NEON_MESHES = ["light1", "light2", "light3"] as const;

const BLINK_MESH = "blinking_light";

const CARDS_PER_ROW = 4;

/** Front + three behind, equally spaced by depthGap. */
const STACK_DEPTH = 4;

const ATLAS_CELL = 128;

const ATLAS_COLS = 8;

/** Superellipse exponent — iOS continuous-corner feel. */
const SQUIRCLE_N = 5;

const CARD_DEPTH = 0.032;

/** Matches tuned default cardSize. */
const BASE_CARD_SIZE = 0.72;

const DEFAULT_SLIDE_MS = 900;

const DEFAULT_FALL_MS = 780;

/** Fall tumble range (degrees). */
const DEFAULT_ROT_MIN_DEG = 8;

const DEFAULT_ROT_SPAN_DEG = 14;

/** Tuned photographic framing (do not auto-fit over these). */
const FOCAL_LENGTH_MM = 36.5;

const FILM_GAUGE_MM = 36;

const ICON_POOL_LIMIT = 50;

const PAGE_INK = 0x0b0b0c;

type AnimPhase = "slide" | "fall";

type RowTune = {
  spacing: number;
  x: number;
  y: number;
  z: number;
  cardSize: number;
  depthGap: number;
};

/** One shelf slot: queue order[0] = front … order[last] = furthest back. */
type CardStack = {
  row: number;
  slot: number;
  /** Instance ids front → back. */
  order: number[];
  homes: THREE.Vector3[];
  busy: boolean;
};

type StackAnim = {
  stack: CardStack;
  phase: AnimPhase;
  t0: number;
  /** Start positions for each card in current order. */
  starts: THREE.Vector3[];
  /** Slide targets (order[i] → homes[i-1] / outward for front). */
  slideEnds: THREE.Vector3[];
  fallEnd: THREE.Vector3;
  fallId: number;
  rotAxis: THREE.Vector3;
  rotAmount: number;
  baseQuat: THREE.Quaternion;
};

type IconAtlas = {
  texture: THREE.CanvasTexture;
  cols: number;
  rows: number;
  count: number;
  tileScale: THREE.Vector2;
};

type NeonTube = {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  point: THREE.PointLight;
  baseIntensity: number;
  blink: boolean;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInQuad(t: number): number {
  return t * t;
}

function squirclePoint(half: number, t: number, n: number): THREE.Vector2 {
  const ang = t * Math.PI * 2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const exp = 2 / n;

  return new THREE.Vector2(
    half * Math.sign(c) * Math.pow(Math.abs(c), exp),
    half * Math.sign(s) * Math.pow(Math.abs(s), exp),
  );
}

function makeSquircleShape(size: number, n = SQUIRCLE_N): THREE.Shape {
  const half = size / 2;
  const segments = 64;
  const shape = new THREE.Shape();

  for (let i = 0; i <= segments; i += 1) {
    const p = squirclePoint(half, i / segments, n);

    if (i === 0) {
      shape.moveTo(p.x, p.y);
    } else {
      shape.lineTo(p.x, p.y);
    }
  }

  return shape;
}

/**
 * Extrude with silhouette XY UVs (0–1) so one glossy icon covers the whole box.
 */
function makeCardGeometry(size: number): THREE.ExtrudeGeometry {
  const shape = makeSquircleShape(size);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: CARD_DEPTH,
    bevelEnabled: true,
    bevelThickness: CARD_DEPTH * 0.28,
    bevelSize: size * 0.018,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 20,
  });

  geo.center();

  const pos = geo.attributes.position;
  const half = size / 2;

  if (!geo.attributes.uv) {
    geo.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2),
    );
  }

  const uv = geo.attributes.uv as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = THREE.MathUtils.clamp((x / half) * 0.5 + 0.5, 0, 1);
    const v = THREE.MathUtils.clamp((y / half) * 0.5 + 0.5, 0, 1);
    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
  geo.clearGroups();
  geo.computeVertexNormals();
  return geo;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`icon load failed: ${url}`));
    img.src = url;
  });
}

function atlasUvOffset(
  index: number,
  cols: number,
  rows: number,
): { u: number; v: number } {
  const col = index % cols;
  const row = Math.floor(index / cols);
  // flipY atlas: row 0 drawn at canvas top → GL v high
  return {
    u: col / cols,
    v: 1 - (row + 1) / rows,
  };
}

function buildIconAtlas(images: HTMLImageElement[]): IconAtlas {
  const count = images.length;
  const cols = ATLAS_COLS;
  const rows = Math.max(1, Math.ceil(count / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * ATLAS_CELL;
  canvas.height = rows * ATLAS_CELL;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(
      images[i],
      col * ATLAS_CELL,
      row * ATLAS_CELL,
      ATLAS_CELL,
      ATLAS_CELL,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = true;
  texture.needsUpdate = true;
  texture.userData.ownsTexture = true;
  texture.userData.canvas = canvas;

  console.info(
    `[vending] atlas ${cols}x${rows} cells @${ATLAS_CELL}px → ${canvas.width}x${canvas.height} (${count} icons)`,
  );

  return {
    texture,
    cols,
    rows,
    count,
    tileScale: new THREE.Vector2(1 / cols, 1 / rows),
  };
}

async function loadIconAtlas(limit: number): Promise<IconAtlas> {
  const res = await fetch(`/api/vending-icons?limit=${limit}`);

  if (!res.ok) {
    throw new Error(`vending-icons ${res.status}`);
  }

  const body = (await res.json()) as {
    count: number;
    icons: Array<{ trackId: number; src: string; name: string }>;
  };

  console.info(
    `[vending] packing ${body.icons.length} WebP icons (api count=${body.count})`,
  );

  const settled = await Promise.allSettled(
    body.icons.map((icon) => loadImage(icon.src)),
  );

  const images: HTMLImageElement[] = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];

    if (result.status === "fulfilled") {
      images.push(result.value);
    } else {
      console.warn("[vending] skip icon", body.icons[i].trackId, result.reason);
    }
  }

  if (images.length === 0) {
    throw new Error("no icons loaded for atlas");
  }

  return buildIconAtlas(images);
}

function disposeOwned(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    if (mesh.userData.ownsGeometry) {
      mesh.geometry.dispose();
    }

    const mat = mesh.material;

    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        if (m.userData.ownsClone) {
          m.dispose();
        }
      });
    } else if (mat?.userData.ownsClone) {
      mat.dispose();
    }
  });
}

function openFrontGlass(root: THREE.Object3D): THREE.Material[] {
  const cloned: THREE.Material[] = [];
  const mesh = root.getObjectByName(GLASS_MESH) as THREE.Mesh | undefined;

  if (!mesh?.isMesh) {
    return cloned;
  }

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  const next = mats.map((m) => {
    if (!m) {
      return m;
    }

    const glass = m.clone();
    glass.userData.ownsClone = true;
    glass.transparent = true;
    glass.opacity = 0.1;
    glass.depthWrite = false;
    glass.side = THREE.DoubleSide;

    const std = glass as THREE.MeshStandardMaterial;

    if (std.color) {
      std.color.setHex(0xb8c0ca);
    }

    if ("roughness" in std) {
      std.roughness = 0.1;
      std.metalness = 0.05;
    }

    cloned.push(glass);
    return glass;
  });

  mesh.material = next.length === 1 ? next[0] : next;
  mesh.renderOrder = 3;

  return cloned;
}

/** One glossy material; atlas UV offset is a per-instance attribute. */
function makeAtlasCardMaterial(
  atlas: IconAtlas,
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: atlas.texture,
    roughness: 0.16,
    metalness: 0.14,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    side: THREE.FrontSide,
  });
  mat.userData.ownsClone = true;
  mat.userData.tileScale = atlas.tileScale;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTileScale = { value: atlas.tileScale.clone() };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec2 atlasOffset;
uniform vec2 uTileScale;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
#ifdef USE_MAP
	vMapUv = vMapUv * uTileScale + atlasOffset;
#endif`,
      );
  };

  mat.customProgramCacheKey = () =>
    `vending-atlas-v3-${atlas.cols}x${atlas.rows}`;
  mat.needsUpdate = true;
  return mat;
}

function makeAsphaltTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  g.addColorStop(0, "rgba(36, 36, 38, 1)");
  g.addColorStop(0.45, "rgba(22, 22, 24, 0.92)");
  g.addColorStop(0.75, "rgba(14, 14, 15, 0.35)");
  g.addColorStop(1, "rgba(11, 11, 12, 0)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // fine grit
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 8) {
      continue;
    }
    const n = (Math.random() - 0.5) * 18;
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n));
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n));
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.userData.canvas = canvas;
  return tex;
}

export function VendingMachineScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hostEl = hostRef.current;

    if (!hostEl) {
      return;
    }

    const mount = hostEl;

    // HMR / StrictMode orphan cleanup
    document.querySelectorAll(".lil-gui").forEach((el) => el.remove());

    let disposed = false;
    let frameId = 0;

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(PAGE_INK, 0.028);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
    camera.filmGauge = FILM_GAUGE_MM;
    camera.setFocalLength(FOCAL_LENGTH_MM);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.07;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = true;
    renderer.setClearColor(PAGE_INK, 0);
    mount.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.background = "transparent";

    // low ambient — neons carry the mood
    const ambientLight = new THREE.AmbientLight(0x8a90a0, 0.22);
    const hemiLight = new THREE.HemisphereLight(0x3a4558, 0x0a0a0c, 0.28);
    hemiLight.position.set(0, 14, 0);
    scene.add(ambientLight, hemiLight);

    // magenta wash (reference neon neighbor)
    const magentaLight = new THREE.PointLight(0xff2d8a, 4.5, 28, 1.8);
    magentaLight.position.set(-5.5, 2.8, -4);
    scene.add(magentaLight);

    // cool pool in front of glass onto asphalt
    const poolLight = new THREE.SpotLight(0xd8f4ff, 18, 36, Math.PI / 3.8, 0.7, 1.25);
    poolLight.position.set(0.2, 10, -9);
    poolLight.target.position.set(0.2, -4.5, -2.5);
    poolLight.castShadow = true;
    poolLight.shadow.mapSize.set(512, 512);
    poolLight.shadow.bias = -0.0002;
    poolLight.shadow.normalBias = 0.03;
    poolLight.shadow.camera.near = 1;
    poolLight.shadow.camera.far = 35;
    scene.add(poolLight, poolLight.target);

    const neonTubes: NeonTube[] = [];

    const composer = new EffectComposer(renderer);
    renderer.autoClear = true;
    renderer.setClearColor(PAGE_INK, 0);

    const renderPass = new RenderPass(scene, camera);
    renderPass.clear = true;
    renderPass.clearAlpha = 0;
    composer.addPass(renderPass);

    // half-res bloom — mild neon glow from tuned defaults
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.04, 1.5, 0);
    bloomPass.enabled = true;
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const stacks: CardStack[] = [];
    const animations: StackAnim[] = [];
    const ownedMats: THREE.Material[] = [];
    const ownedTextures: THREE.Texture[] = [];
    const ownedGeos: THREE.BufferGeometry[] = [];

    const instanceCount = ROW_COUNT * CARDS_PER_ROW * STACK_DEPTH;
    let cardGeo = makeCardGeometry(BASE_CARD_SIZE);
    ownedGeos.push(cardGeo);

    const atlasOffsets = new Float32Array(instanceCount * 2);
    const atlasAttr = new THREE.InstancedBufferAttribute(atlasOffsets, 2);
    cardGeo.setAttribute("atlasOffset", atlasAttr);

    let cardMesh: THREE.InstancedMesh | null = null;
    let iconAtlas: IconAtlas | null = null;
    /** atlas cell index per instance */
    const iconIndexOf = new Int16Array(instanceCount).fill(-1);
    /** stack owning each instance id */
    const stackOfInstance: Array<CardStack | null> = Array(instanceCount).fill(
      null,
    );

    const dummy = new THREE.Object3D();
    const faceQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, Math.PI, 0),
    );
    const scratchQuat = new THREE.Quaternion();

    let modelRoot: THREE.Object3D | null = null;
    let ground: THREE.Mesh | null = null;
    let fitted = false;
    // tuned camera is the source of truth — never auto-fit over it
    let cameraLocked = true;
    let shelfSeats: Array<{ y: number; z: number }> = [];
    let bayMinX = 0;
    let bayMaxX = 0;
    /** Local Y where every fallen card lands (retrieval mouth). */
    let fallLandLocalY = -2.2;
    let gui: GUI | null = null;

    const outAxis = new THREE.Vector3(0, 0, -1);
    const lookTarget = new THREE.Vector3();

    const rows: RowTune[] = [
      { spacing: 1.025, x: 0.135, y: -0.675, z: 0.58, cardSize: 0.72, depthGap: 0.35 },
      { spacing: 1.025, x: 0.135, y: -0.565, z: 0.615, cardSize: 0.72, depthGap: 0.35 },
      { spacing: 1.025, x: 0.135, y: -0.345, z: 0.65, cardSize: 0.72, depthGap: 0.35 },
      { spacing: 1.025, x: 0.09, y: -0.305, z: 0.615, cardSize: 0.72, depthGap: 0.35 },
    ];

    const camTune = {
      x: -20,
      y: 7.71,
      z: -25.89,
      tx: 10,
      ty: 1.15,
      tz: -4.01,
      focalLength: FOCAL_LENGTH_MM,
      yaw: 9,
      pitch: -6,
    };

    const postTune = {
      bloomStrength: 0.04,
      bloomRadius: 1.5,
      bloomThreshold: 0,
      exposure: 1.07,
    };

    const lightTune = {
      ambient: 0.22,
      hemi: 0.28,
      neon: 1.35,
      magenta: 4.5,
      pool: 18,
      fog: 0.028,
      ambientColor: "#8a90a0",
      neonColor: "#c8f0ff",
      magentaColor: "#ff2d8a",
    };

    const vendTune = {
      slideMs: DEFAULT_SLIDE_MS,
      fallMs: DEFAULT_FALL_MS,
      rotMinDeg: DEFAULT_ROT_MIN_DEG,
      rotSpanDeg: DEFAULT_ROT_SPAN_DEG,
    };

    function shelfSeat(
      index: number,
      count: number,
      glassBox: THREE.Box3,
    ): { y: number; z: number } {
      const top = glassBox.max.y - 0.55;
      const bottom = glassBox.min.y + 1.15;
      const t = count <= 1 ? 0 : index / (count - 1);
      const y = top - t * (top - bottom);
      const z = glassBox.min.z + 0.12;
      return { y, z };
    }

    function pickIconIndex(exclude?: number): number {
      if (!iconAtlas || iconAtlas.count === 0) {
        return 0;
      }

      if (iconAtlas.count === 1) {
        return 0;
      }

      let idx = Math.floor(Math.random() * iconAtlas.count);

      for (let i = 0; i < 8 && idx === exclude; i += 1) {
        idx = Math.floor(Math.random() * iconAtlas.count);
      }

      return idx;
    }

    function setInstanceIcon(id: number, iconIndex: number) {
      if (!iconAtlas) {
        return;
      }

      const clamped = ((iconIndex % iconAtlas.count) + iconAtlas.count) % iconAtlas.count;
      iconIndexOf[id] = clamped;
      const { u, v } = atlasUvOffset(clamped, iconAtlas.cols, iconAtlas.rows);
      atlasOffsets[id * 2] = u;
      atlasOffsets[id * 2 + 1] = v;
      atlasAttr.needsUpdate = true;
    }

    function writeInstance(
      id: number,
      pos: THREE.Vector3,
      quat: THREE.Quaternion,
      scale: number,
    ) {
      if (!cardMesh) {
        return;
      }

      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      cardMesh.setMatrixAt(id, dummy.matrix);
      cardMesh.instanceMatrix.needsUpdate = true;
    }

    function layoutCards() {
      if (!modelRoot || shelfSeats.length === 0 || !cardMesh) {
        return;
      }

      const toLocal = (world: THREE.Vector3) =>
        modelRoot!.worldToLocal(world.clone());

      for (const stack of stacks) {
        const row = rows[stack.row];
        const seat = shelfSeats[stack.row];
        const bayW = bayMaxX - bayMinX;
        const spacing =
          row.spacing > 0.001 ? row.spacing : bayW / (CARDS_PER_ROW + 0.35);
        const span = spacing * (CARDS_PER_ROW - 1);
        const startX = (bayMinX + bayMaxX) / 2 - span / 2;
        const wx = startX + stack.slot * spacing + row.x;
        const seatY = seat.y + row.cardSize / 2 + row.y;
        const seatZ = seat.z + row.z;

        if (![wx, seatY, seatZ].every(Number.isFinite)) {
          continue;
        }

        for (let d = 0; d < STACK_DEPTH; d += 1) {
          const world = new THREE.Vector3(
            wx,
            seatY,
            seatZ + d * row.depthGap,
          );
          stack.homes[d].copy(toLocal(world));
        }

        if (!stack.busy) {
          const s = row.cardSize / BASE_CARD_SIZE;

          for (let d = 0; d < STACK_DEPTH; d += 1) {
            writeInstance(stack.order[d], stack.homes[d], faceQuat, s);
          }
        }
      }
    }

    function placeCards(root: THREE.Object3D) {
      if (!iconAtlas) {
        console.warn("[vending] placeCards: no atlas");
        return;
      }

      const glass = root.getObjectByName(GLASS_MESH);
      const glassBox = glass
        ? new THREE.Box3().setFromObject(glass)
        : new THREE.Box3().setFromObject(root);

      if (
        glassBox.isEmpty() ||
        ![glassBox.min.y, glassBox.max.y, glassBox.min.z].every(Number.isFinite)
      ) {
        console.warn("[vending] glass bounds unusable");
        return;
      }

      shelfSeats = [];

      for (let i = 0; i < ROW_COUNT; i += 1) {
        shelfSeats.push(shelfSeat(i, ROW_COUNT, glassBox));
      }

      bayMinX = Number.isFinite(glassBox.min.x)
        ? glassBox.min.x + 0.35
        : -1.2;
      bayMaxX = Number.isFinite(glassBox.max.x)
        ? glassBox.max.x - 0.55
        : 1.2;

      if (![bayMinX, bayMaxX].every(Number.isFinite) || bayMaxX <= bayMinX) {
        bayMinX = -1.2;
        bayMaxX = 1.2;
      }

      const landWorld = new THREE.Vector3(
        (glassBox.min.x + glassBox.max.x) / 2,
        glassBox.min.y - 0.4,
        glassBox.min.z - 0.05,
      );
      fallLandLocalY = root.worldToLocal(landWorld.clone()).y;

      console.info(
        `[vending] seats=${shelfSeats.map((s) => s.y.toFixed(2)).join(",")} landY=${fallLandLocalY.toFixed(2)} stack=${STACK_DEPTH}`,
      );

      const mat = makeAtlasCardMaterial(iconAtlas);
      ownedMats.push(mat);

      cardMesh = new THREE.InstancedMesh(cardGeo, mat, instanceCount);
      cardMesh.castShadow = true;
      cardMesh.receiveShadow = true;
      cardMesh.frustumCulled = false;
      cardMesh.renderOrder = 2;
      root.add(cardMesh);

      let nextId = 0;

      for (let s = 0; s < shelfSeats.length; s += 1) {
        for (let i = 0; i < CARDS_PER_ROW; i += 1) {
          const order: number[] = [];
          const homes: THREE.Vector3[] = [];

          for (let d = 0; d < STACK_DEPTH; d += 1) {
            homes.push(new THREE.Vector3());
          }

          const stack: CardStack = {
            row: s,
            slot: i,
            order,
            homes,
            busy: false,
          };

          let lastIcon = -1;

          for (let d = 0; d < STACK_DEPTH; d += 1) {
            const id = nextId;
            nextId += 1;
            order.push(id);
            stackOfInstance[id] = stack;
            lastIcon = pickIconIndex(lastIcon);
            setInstanceIcon(id, lastIcon);
          }

          stacks.push(stack);
        }
      }

      layoutCards();
    }

    function setupNeon(root: THREE.Object3D) {
      const color = new THREE.Color(lightTune.neonColor);

      const wire = (name: string, blink: boolean) => {
        const mesh = root.getObjectByName(name) as THREE.Mesh | undefined;

        if (!mesh?.isMesh) {
          console.warn(`[vending] neon mesh missing: ${name}`);
          return;
        }

        const prev = mesh.material;
        const mat = new THREE.MeshStandardMaterial({
          color: blink ? 0x003300 : color.clone(),
          emissive: blink ? new THREE.Color(0x22ff66) : color.clone(),
          emissiveIntensity: blink ? 8 : 7.5,
          roughness: 0.25,
          metalness: 0.1,
          toneMapped: false,
        });
        mat.userData.ownsClone = true;
        ownedMats.push(mat);
        mesh.material = mat;

        if (prev && prev !== mat) {
          // leave original; GLTF owns it
        }

        const world = new THREE.Vector3();
        mesh.getWorldPosition(world);

        const point = new THREE.PointLight(
          blink ? 0x33ff77 : color.getHex(),
          blink ? 8 : 14,
          blink ? 14 : 24,
          1.7,
        );
        point.position.copy(world);
        scene.add(point);

        neonTubes.push({
          mesh,
          mat,
          point,
          baseIntensity: point.intensity,
          blink,
        });
      };

      for (const name of NEON_MESHES) {
        wire(name, false);
      }

      wire(BLINK_MESH, true);
    }

    function applyNeonIntensity() {
      const color = new THREE.Color(lightTune.neonColor);

      for (const tube of neonTubes) {
        if (tube.blink) {
          tube.point.intensity = tube.baseIntensity * lightTune.neon;
          tube.mat.emissiveIntensity = 8 * lightTune.neon;
        } else {
          tube.point.color.copy(color);
          tube.point.intensity = tube.baseIntensity * lightTune.neon;
          tube.mat.color.copy(color);
          tube.mat.emissive.copy(color);
          tube.mat.emissiveIntensity = 7.5 * lightTune.neon;
        }
      }
    }

    function placeGround(root: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(root);
      const asphalt = makeAsphaltTexture(256);
      ownedTextures.push(asphalt);

      const mat = new THREE.MeshStandardMaterial({
        map: asphalt,
        transparent: true,
        roughness: 0.92,
        metalness: 0.06,
        depthWrite: false,
          emissive: new THREE.Color(0x142838),
          emissiveIntensity: 0.35,
      });
      mat.userData.ownsClone = true;
      ownedMats.push(mat);

      const geo = new THREE.CircleGeometry(14, 64);
      ownedGeos.push(geo);

      ground = new THREE.Mesh(geo, mat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(
        (box.min.x + box.max.x) / 2,
        box.min.y + 0.01,
        box.min.z - 1.2,
      );
      ground.receiveShadow = true;
      ground.renderOrder = -1;
      scene.add(ground);
    }

    function applyCameraFromTune() {
      camera.filmGauge = FILM_GAUGE_MM;
      camera.setFocalLength(camTune.focalLength);
      camera.updateProjectionMatrix();
      camera.position.set(camTune.x, camTune.y, camTune.z);
      lookTarget.set(camTune.tx, camTune.ty, camTune.tz);
      camera.lookAt(lookTarget);
    }

    function fitCamera(root: THREE.Object3D) {
      if (cameraLocked) {
        applyCameraFromTune();
        return;
      }

      const prevVis = cardMesh ? cardMesh.visible : true;

      if (cardMesh) {
        cardMesh.visible = false;
      }

      const box = new THREE.Box3().setFromObject(root);

      if (cardMesh) {
        cardMesh.visible = prevVis;
      }

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      if (
        box.isEmpty() ||
        ![size.x, size.y, size.z, center.x, center.y, center.z].every(
          Number.isFinite,
        )
      ) {
        console.warn("[vending] fitCamera: invalid model bounds");
        return;
      }

      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.aspect = aspect;
      camera.filmGauge = FILM_GAUGE_MM;
      camera.setFocalLength(camTune.focalLength);
      camera.updateProjectionMatrix();

      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const fitH = size.y * 1.28;
      const fitW = size.x * 1.35;
      const distH = fitH / (2 * Math.tan(vFov / 2));
      const distW = fitW / (2 * Math.tan(vFov / 2) * aspect);
      let dist = Math.max(distH, distW);

      if (!Number.isFinite(dist) || dist < 0.5) {
        dist = 16;
      }

      const yaw = THREE.MathUtils.degToRad(camTune.yaw);
      const pitch = THREE.MathUtils.degToRad(camTune.pitch);
      const front = new THREE.Vector3(
        Math.sin(yaw) * dist * 0.32,
        Math.sin(-pitch) * dist * 0.22 + size.y * 0.02,
        -Math.cos(yaw) * dist,
      );

      camTune.x = center.x + front.x;
      camTune.y = center.y + front.y;
      camTune.z = center.z + front.z;
      camTune.tx = center.x + size.x * 0.02;
      camTune.ty = center.y - size.y * 0.06;
      camTune.tz = center.z;

      applyCameraFromTune();
      cameraLocked = true;
    }

    function applyPostTune() {
      bloomPass.strength = postTune.bloomStrength;
      bloomPass.radius = postTune.bloomRadius;
      bloomPass.threshold = postTune.bloomThreshold;
      bloomPass.enabled = postTune.bloomStrength > 0.001;
      renderer.toneMappingExposure = postTune.exposure;
    }

    function applyFogTune() {
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = lightTune.fog;
      }
    }

    function buildGui() {
      if (gui) {
        gui.destroy();
        gui = null;
      }

      document.querySelectorAll(".lil-gui").forEach((el) => el.remove());

      gui = new GUI({ title: "Vending tune" });
      gui.domElement.style.zIndex = "40";

      const camFolder = gui.addFolder("Camera");
      camFolder.add(camTune, "x", -40, 40, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "y", -20, 20, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "z", -40, 40, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "tx", -20, 20, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "ty", -10, 10, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "tz", -10, 10, 0.01).onChange(applyCameraFromTune);
      camFolder
        .add(camTune, "focalLength", 24, 85, 0.5)
        .name("focal mm")
        .onChange(applyCameraFromTune);
      camFolder.add(camTune, "yaw", -35, 35, 0.1).onChange(() => {
        cameraLocked = false;
        if (modelRoot) {
          fitCamera(modelRoot);
        }
      });
      camFolder.add(camTune, "pitch", -35, 35, 0.1).onChange(() => {
        cameraLocked = false;
        if (modelRoot) {
          fitCamera(modelRoot);
        }
      });

      const postFolder = gui.addFolder("Post");
      postFolder
        .add(postTune, "bloomStrength", 0, 1.5, 0.01)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "bloomRadius", 0, 1.5, 0.01)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "bloomThreshold", 0, 1, 0.01)
        .onChange(applyPostTune);
      postFolder.add(postTune, "exposure", 0.2, 2, 0.01).onChange(applyPostTune);

      rows.forEach((row, i) => {
        const f = gui!.addFolder(`Row ${i + 1}`);
        f.add(row, "spacing", 0, 1.2, 0.005).onChange(layoutCards);
        f.add(row, "x", -1.5, 1.5, 0.005).onChange(layoutCards);
        f.add(row, "y", -1.5, 1.5, 0.005).onChange(layoutCards);
        f.add(row, "z", -1.5, 1.5, 0.005).onChange(layoutCards);
        f.add(row, "cardSize", 0.2, 1.2, 0.01).onChange(layoutCards);
        f.add(row, "depthGap", 0.04, 0.35, 0.005).onChange(layoutCards);
      });

      const lightFolder = gui.addFolder("Lights");
      lightFolder
        .add(lightTune, "ambient", 0, 1.5, 0.01)
        .onChange((v: number) => {
          ambientLight.intensity = v;
        });
      lightFolder.add(lightTune, "hemi", 0, 1.5, 0.01).onChange((v: number) => {
        hemiLight.intensity = v;
      });
      lightFolder
        .add(lightTune, "neon", 0, 3, 0.01)
        .onChange(() => applyNeonIntensity());
      lightFolder
        .add(lightTune, "magenta", 0, 8, 0.05)
        .onChange((v: number) => {
          magentaLight.intensity = v;
        });
      lightFolder.add(lightTune, "pool", 0, 20, 0.1).onChange((v: number) => {
        poolLight.intensity = v;
      });
      lightFolder.add(lightTune, "fog", 0, 0.12, 0.001).onChange(applyFogTune);
      lightFolder.addColor(lightTune, "ambientColor").onChange((v: string) => {
        ambientLight.color.set(v);
      });
      lightFolder.addColor(lightTune, "neonColor").onChange(() => {
        applyNeonIntensity();
      });
      lightFolder.addColor(lightTune, "magentaColor").onChange((v: string) => {
        magentaLight.color.set(v);
      });

      const vendFolder = gui.addFolder("Vend anim");
      vendFolder
        .add(vendTune, "slideMs", 100, 2500, 10)
        .name("slide ms");
      vendFolder
        .add(vendTune, "fallMs", 100, 2500, 10)
        .name("fall ms");
      vendFolder
        .add(vendTune, "rotMinDeg", 0, 40, 0.5)
        .name("rot min °");
      vendFolder
        .add(vendTune, "rotSpanDeg", 0, 40, 0.5)
        .name("rot span °");

      applyPostTune();
      applyFogTune();
    }

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;

      if (w < 1 || h < 1) {
        return;
      }

      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      // bloom internals at half res
      bloomPass.resolution.set(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      if (modelRoot && fitted) {
        if (!cameraLocked) {
          fitCamera(modelRoot);
        } else {
          applyCameraFromTune();
        }
      }
    }

    function pointerFromEvent(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickFront(event: PointerEvent): CardStack | null {
      if (!cardMesh) {
        return null;
      }

      pointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(cardMesh, false);

      for (const hit of hits) {
        const id = hit.instanceId;

        if (id === undefined || id < 0) {
          continue;
        }

        const stack = stackOfInstance[id];

        if (
          stack &&
          !stack.busy &&
          stack.order[0] === id
        ) {
          return stack;
        }
      }

      return null;
    }

    function onPointerMove(event: PointerEvent) {
      canvas.style.cursor = pickFront(event) ? "pointer" : "default";
    }

    function startStackVend(stack: CardStack) {
      if (stack.busy || !cardMesh) {
        return;
      }

      stack.busy = true;

      const gap = rows[stack.row].depthGap;
      const starts: THREE.Vector3[] = [];
      const slideEnds: THREE.Vector3[] = [];

      for (let d = 0; d < STACK_DEPTH; d += 1) {
        const start = stack.homes[d].clone();
        starts.push(start);
        // whole stack eases forward by one gap
        slideEnds.push(start.clone().addScaledVector(outAxis, gap));
      }

      const fallEnd = new THREE.Vector3(
        slideEnds[0].x,
        fallLandLocalY,
        slideEnds[0].z,
      ).addScaledVector(outAxis, 0.04);

      const rotAxis = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 0.6,
      ).normalize();
      const rotAmount = THREE.MathUtils.degToRad(
        vendTune.rotMinDeg + Math.random() * vendTune.rotSpanDeg,
      );

      playCoinSound();

      animations.push({
        stack,
        phase: "slide",
        t0: performance.now(),
        starts,
        slideEnds,
        fallEnd,
        fallId: stack.order[0],
        rotAxis,
        rotAmount,
        baseQuat: faceQuat.clone(),
      });
    }

    function finishStack(anim: StackAnim) {
      const { stack } = anim;
      const scale = rows[stack.row].cardSize / BASE_CARD_SIZE;
      const fallen = stack.order.shift()!;
      stack.order.push(fallen);

      // others already sit in homes[0..n-2] after the one-gap slide
      for (let d = 0; d < STACK_DEPTH - 1; d += 1) {
        writeInstance(stack.order[d], stack.homes[d], faceQuat, scale);
      }

      // fallen → furthest back
      writeInstance(
        fallen,
        stack.homes[STACK_DEPTH - 1],
        faceQuat,
        scale,
      );

      const exclude = iconIndexOf[stack.order[0]];
      setInstanceIcon(fallen, pickIconIndex(exclude));

      stack.busy = false;
    }

    function onPointerDown(event: PointerEvent) {
      const stack = pickFront(event);

      if (stack) {
        startStackVend(stack);
      }
    }

    function updateAnims(now: number) {
      if (!cardMesh) {
        return;
      }

      for (let i = animations.length - 1; i >= 0; i -= 1) {
        const anim = animations[i];
        const scale = rows[anim.stack.row].cardSize / BASE_CARD_SIZE;

        if (anim.phase === "slide") {
          const u = Math.min(1, (now - anim.t0) / vendTune.slideMs);
          const e = easeOutCubic(u);
          const pos = new THREE.Vector3();

          for (let d = 0; d < STACK_DEPTH; d += 1) {
            pos.lerpVectors(anim.starts[d], anim.slideEnds[d], e);
            writeInstance(anim.stack.order[d], pos, faceQuat, scale);
          }

          if (u >= 1) {
            // snap followers onto forward homes
            for (let d = 1; d < STACK_DEPTH; d += 1) {
              writeInstance(
                anim.stack.order[d],
                anim.stack.homes[d - 1],
                faceQuat,
                scale,
              );
            }

            writeInstance(
              anim.fallId,
              anim.slideEnds[0],
              faceQuat,
              scale,
            );
            anim.phase = "fall";
            anim.t0 = now;
            anim.starts[0].copy(anim.slideEnds[0]);
          }

          continue;
        }

        if (anim.phase === "fall") {
          const elapsed = now - anim.t0;
          const u = Math.min(1, elapsed / vendTune.fallMs);
          const e = easeInQuad(u);
          const pos = new THREE.Vector3().lerpVectors(
            anim.starts[0],
            anim.fallEnd,
            e,
          );
          scratchQuat
            .setFromAxisAngle(anim.rotAxis, anim.rotAmount * e)
            .premultiply(anim.baseQuat);
          writeInstance(anim.fallId, pos, scratchQuat, scale);

          if (u >= 1) {
            playFallSound();
            finishStack(anim);
            animations.splice(i, 1);
          }
        }
      }
    }

    function animate(now: number) {
      if (disposed) {
        return;
      }

      frameId = requestAnimationFrame(animate);
      updateAnims(now);

      // blink green neon
      for (const tube of neonTubes) {
        if (!tube.blink) {
          continue;
        }

        const pulse = 0.55 + 0.45 * Math.sin(now * 0.006);
        tube.point.intensity = tube.baseIntensity * lightTune.neon * pulse;
        tube.mat.emissiveIntensity = 8 * lightTune.neon * pulse;
      }

      if (bloomPass.enabled) {
        // bloom path: clear to page ink so edges match fog
        renderer.setClearColor(PAGE_INK, 1);
        composer.render();
      } else {
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        renderer.setClearColor(PAGE_INK, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
      }
    }

    (window as unknown as { __vending?: object }).__vending = {
      scene,
      camera,
      composer,
      renderer,
      stacks,
      cardMesh: () => cardMesh,
      modelUrl: MODEL_URL,
      lightTune,
      postTune,
      stackDepth: STACK_DEPTH,
      startStackVend,
      get fallLandLocalY() {
        return fallLandLocalY;
      },
    };

    const loader = new GLTFLoader();

    void (async () => {
      try {
        const atlas = await loadIconAtlas(ICON_POOL_LIMIT);

        if (disposed) {
          atlas.texture.dispose();
          const c = atlas.texture.userData.canvas as HTMLCanvasElement | undefined;
          if (c) {
            c.width = 0;
            c.height = 0;
          }
          return;
        }

        iconAtlas = atlas;
        ownedTextures.push(atlas.texture);
      } catch (err) {
        console.error("[vending] icon atlas failed", err);
      }

      if (disposed) {
        return;
      }

      loader.load(
        MODEL_URL,
        (gltf) => {
          if (disposed) {
            disposeOwned(gltf.scene);
            return;
          }

          modelRoot = gltf.scene;
          scene.add(modelRoot);
          modelRoot.updateMatrixWorld(true);

          let meshCount = 0;
          modelRoot.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              meshCount += 1;
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          console.info(
            `[vending] loaded url=${MODEL_URL} meshes=${meshCount} icons=${iconAtlas?.count ?? 0} rows=${ROW_COUNT} stack=${STACK_DEPTH}`,
          );

          const box = new THREE.Box3().setFromObject(modelRoot);
          const center = box.getCenter(new THREE.Vector3());
          modelRoot.position.sub(center);
          modelRoot.updateMatrixWorld(true);

          const glass = modelRoot.getObjectByName(GLASS_MESH);
          const glassBox = glass
            ? new THREE.Box3().setFromObject(glass)
            : new THREE.Box3().setFromObject(modelRoot);

          console.info(
            `[vending] glass minY=${glassBox.min.y.toFixed(2)} maxY=${glassBox.max.y.toFixed(2)}`,
          );

          ownedMats.push(...openFrontGlass(modelRoot));
          setupNeon(modelRoot);
          applyNeonIntensity();
          placeGround(modelRoot);

          poolLight.target.position.set(
            (glassBox.min.x + glassBox.max.x) / 2,
            glassBox.min.y + 0.2,
            glassBox.min.z - 0.5,
          );
          poolLight.target.updateMatrixWorld();

          placeCards(modelRoot);
          applyCameraFromTune();
          fitted = true;
          buildGui();
          resize();
        },
        undefined,
        (err) => {
          console.error("GLB load failed", err);
        },
      );
    })();

    resize();
    frameId = requestAnimationFrame(animate);

    const ro = new ResizeObserver(() => resize());
    ro.observe(mount);

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);

      if (gui) {
        gui.destroy();
        gui = null;
      }

      delete (window as unknown as { __vending?: object }).__vending;

      for (const tube of neonTubes) {
        scene.remove(tube.point);
        tube.point.dispose();
      }

      if (ground) {
        scene.remove(ground);
        ground = null;
      }

      scene.remove(magentaLight);
      scene.remove(poolLight);
      scene.remove(poolLight.target);
      magentaLight.dispose();
      poolLight.dispose();

      if (modelRoot) {
        if (cardMesh) {
          modelRoot.remove(cardMesh);
          cardMesh.dispose();
          cardMesh = null;
        }

        disposeOwned(modelRoot);
        scene.remove(modelRoot);
        modelRoot = null;
      }

      for (const geo of ownedGeos) {
        geo.dispose();
      }

      for (const mat of ownedMats) {
        mat.dispose();
      }

      for (const tex of ownedTextures) {
        const c = tex.userData.canvas as HTMLCanvasElement | undefined;
        tex.dispose();

        if (c) {
          c.width = 0;
          c.height = 0;
        }
      }

      composer.dispose();
      renderer.dispose();

      if (canvas.parentNode === mount) {
        mount.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={hostRef} className="vending-scene" aria-hidden />;
}
