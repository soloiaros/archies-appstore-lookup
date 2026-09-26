"use client";

import { useEffect, useRef } from "react";

import GUI from "lil-gui";
import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

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

/** Superellipse exponent — iOS continuous-corner feel. */
const SQUIRCLE_N = 5;

const CARD_DEPTH = 0.032;

/** Matches tuned default cardSize. */
const BASE_CARD_SIZE = 0.72;

const SLIDE_MS = 900;

const FALL_MS = 780;

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

type CardPiece = {
  root: THREE.Group;
  mesh: THREE.Mesh;
  mat: THREE.MeshPhysicalMaterial;
};

type CardPair = {
  front: CardPiece;
  back: CardPiece;
  row: number;
  slot: number;
  frontHome: THREE.Vector3;
  backHome: THREE.Vector3;
  busy: boolean;
};

type PairAnim = {
  pair: CardPair;
  phase: AnimPhase;
  t0: number;
  frontStart: THREE.Vector3;
  backStart: THREE.Vector3;
  slideEndFront: THREE.Vector3;
  slideEndBack: THREE.Vector3;
  fallEnd: THREE.Vector3;
  rotAxis: THREE.Vector3;
  rotAmount: number;
  baseQuat: THREE.Quaternion;
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

function loadTexture(url: string, loader: THREE.TextureLoader): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.userData.sourceUrl = url;
        tex.userData.ownsTexture = true;
        resolve(tex);
      },
      undefined,
      () => reject(new Error(`icon load failed: ${url}`)),
    );
  });
}

async function loadIconPool(
  limit: number,
): Promise<{ textures: THREE.Texture[]; count: number }> {
  const res = await fetch(`/api/vending-icons?limit=${limit}`);

  if (!res.ok) {
    throw new Error(`vending-icons ${res.status}`);
  }

  const body = (await res.json()) as {
    count: number;
    icons: Array<{ trackId: number; src: string; name: string }>;
  };

  console.info(
    `[vending] loading ${body.icons.length} WebP icons (api count=${body.count})`,
  );

  THREE.Cache.enabled = true;
  const loader = new THREE.TextureLoader();

  const settled = await Promise.allSettled(
    body.icons.map((icon) => loadTexture(icon.src, loader)),
  );

  const textures: THREE.Texture[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];

    if (result.status === "fulfilled") {
      const url = String(result.value.userData.sourceUrl ?? "");

      if (url && seen.has(url)) {
        result.value.dispose();
        continue;
      }

      if (url) {
        seen.add(url);
      }

      textures.push(result.value);
    } else {
      console.warn("[vending] skip icon", body.icons[i].trackId, result.reason);
    }
  }

  console.info(`[vending] cached ${textures.length} unique WebP textures @128px`);

  return { textures, count: textures.length };
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

/** Glossy so neon catches the icon surface. */
function makeGlossIconMaterial(
  map: THREE.Texture | null,
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: map ?? null,
    roughness: 0.16,
    metalness: 0.14,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    side: THREE.FrontSide,
  });
  mat.userData.ownsClone = true;
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
    const pairs: CardPair[] = [];
    const animations: PairAnim[] = [];
    const ownedMats: THREE.Material[] = [];
    const ownedTextures: THREE.Texture[] = [];
    const ownedGeos: THREE.BufferGeometry[] = [];

    let cardGeo = makeCardGeometry(BASE_CARD_SIZE);
    ownedGeos.push(cardGeo);

    let modelRoot: THREE.Object3D | null = null;
    let ground: THREE.Mesh | null = null;
    let fitted = false;
    // tuned camera is the source of truth — never auto-fit over it
    let cameraLocked = true;
    let iconTextures: THREE.Texture[] = [];
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

    function pickTexture(exclude?: THREE.Texture | null): THREE.Texture | null {
      if (iconTextures.length === 0) {
        return null;
      }

      if (iconTextures.length === 1) {
        return iconTextures[0];
      }

      let tex = iconTextures[Math.floor(Math.random() * iconTextures.length)];

      for (let i = 0; i < 6 && tex === exclude; i += 1) {
        tex = iconTextures[Math.floor(Math.random() * iconTextures.length)];
      }

      return tex;
    }

    /** One map on the whole mesh — same icon front/back/sides. */
    function assignMap(piece: CardPiece, tex: THREE.Texture | null) {
      piece.mat.map = tex;
      piece.mat.needsUpdate = true;
    }

    function applyCardScale(piece: CardPiece, size: number) {
      const s = size / BASE_CARD_SIZE;
      piece.root.scale.set(s, s, 1);
    }

    // Extrude +Z; rotate so front faces machine front (−Z).
    function faceCamera(piece: CardPiece) {
      piece.root.rotation.set(0, Math.PI, 0);
      piece.root.quaternion.setFromEuler(piece.root.rotation);
    }

    function makeCardPiece(map: THREE.Texture | null): CardPiece {
      const root = new THREE.Group();
      const mat = makeGlossIconMaterial(map);
      ownedMats.push(mat);

      const mesh = new THREE.Mesh(cardGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 2;
      root.add(mesh);

      return { root, mesh, mat };
    }

    function layoutCards() {
      if (!modelRoot || shelfSeats.length === 0) {
        return;
      }

      const toLocal = (world: THREE.Vector3) =>
        modelRoot!.worldToLocal(world.clone());

      for (const pair of pairs) {
        const row = rows[pair.row];
        const seat = shelfSeats[pair.row];
        const bayW = bayMaxX - bayMinX;
        const spacing =
          row.spacing > 0.001 ? row.spacing : bayW / (CARDS_PER_ROW + 0.35);
        const span = spacing * (CARDS_PER_ROW - 1);
        const startX = (bayMinX + bayMaxX) / 2 - span / 2;
        const wx = startX + pair.slot * spacing + row.x;
        const seatY = seat.y + row.cardSize / 2 + row.y;
        const seatZ = seat.z + row.z;

        if (![wx, seatY, seatZ].every(Number.isFinite)) {
          continue;
        }

        const frontWorld = new THREE.Vector3(wx, seatY, seatZ);
        // back is further into the cabinet (+Z); gap == slide travel
        const backWorld = new THREE.Vector3(
          wx,
          seatY,
          seatZ + row.depthGap,
        );

        pair.frontHome.copy(toLocal(frontWorld));
        pair.backHome.copy(toLocal(backWorld));

        if (!pair.busy) {
          pair.front.root.position.copy(pair.frontHome);
          pair.back.root.position.copy(pair.backHome);
          faceCamera(pair.front);
          faceCamera(pair.back);
          applyCardScale(pair.front, row.cardSize);
          applyCardScale(pair.back, row.cardSize);
        }
      }
    }

    function placeCards(root: THREE.Object3D) {
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

      // absolute land: retrieval mouth — convert world → model local properly
      const landWorld = new THREE.Vector3(
        (glassBox.min.x + glassBox.max.x) / 2,
        glassBox.min.y - 0.4,
        glassBox.min.z - 0.05,
      );
      fallLandLocalY = root.worldToLocal(landWorld.clone()).y;

      console.info(
        `[vending] seats=${shelfSeats.map((s) => s.y.toFixed(2)).join(",")} landY=${fallLandLocalY.toFixed(2)}`,
      );

      for (let s = 0; s < shelfSeats.length; s += 1) {
        for (let i = 0; i < CARDS_PER_ROW; i += 1) {
          const front = makeCardPiece(pickTexture());
          const back = makeCardPiece(pickTexture(front.mat.map));

          front.root.userData.clickable = true;
          back.root.userData.clickable = false;
          front.root.userData.role = "front";
          back.root.userData.role = "back";
          front.mesh.renderOrder = 2;
          back.mesh.renderOrder = 1;

          root.add(front.root);
          root.add(back.root);

          const pair: CardPair = {
            front,
            back,
            row: s,
            slot: i,
            frontHome: new THREE.Vector3(),
            backHome: new THREE.Vector3(),
            busy: false,
          };

          front.root.userData.pair = pair;
          back.root.userData.pair = pair;
          front.mesh.userData.pair = pair;
          back.mesh.userData.pair = pair;
          pairs.push(pair);
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

      const prevVis: Array<{ obj: THREE.Object3D; v: boolean }> = [];
      for (const pair of pairs) {
        prevVis.push({ obj: pair.front.root, v: pair.front.root.visible });
        prevVis.push({ obj: pair.back.root, v: pair.back.root.visible });
        pair.front.root.visible = false;
        pair.back.root.visible = false;
      }

      const box = new THREE.Box3().setFromObject(root);

      for (const entry of prevVis) {
        entry.obj.visible = entry.v;
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

    function pickFront(event: PointerEvent): CardPair | null {
      pointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const meshes = pairs.map((p) => p.front.mesh);
      const hits = raycaster.intersectObjects(meshes, false);

      for (const hit of hits) {
        const mesh = hit.object as THREE.Mesh;
        const pair = mesh.userData.pair as CardPair | undefined;

        if (pair && !pair.busy && pair.front.root.userData.clickable) {
          return pair;
        }
      }

      return null;
    }

    function onPointerMove(event: PointerEvent) {
      canvas.style.cursor = pickFront(event) ? "pointer" : "default";
    }

    function startPairVend(pair: CardPair) {
      if (pair.busy) {
        return;
      }

      pair.busy = true;
      pair.front.root.userData.clickable = false;

      const gap = rows[pair.row].depthGap;
      const frontStart = pair.front.root.position.clone();
      const backStart = pair.back.root.position.clone();

      // slide distance == depth gap → back lands on front home
      const slideEndFront = frontStart.clone().addScaledVector(outAxis, gap);
      const slideEndBack = backStart.clone().addScaledVector(outAxis, gap);

      // absolute land Y (retrieval mouth), keep slide X/Z
      const fallEnd = new THREE.Vector3(
        slideEndFront.x,
        fallLandLocalY,
        slideEndFront.z,
      ).addScaledVector(outAxis, 0.04);

      const rotAxis = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 0.6,
      ).normalize();
      const rotAmount = THREE.MathUtils.degToRad(8 + Math.random() * 14);

      animations.push({
        pair,
        phase: "slide",
        t0: performance.now(),
        frontStart,
        backStart,
        slideEndFront,
        slideEndBack,
        fallEnd,
        rotAxis,
        rotAmount,
        baseQuat: pair.front.root.quaternion.clone(),
      });
    }

    function finishPair(anim: PairAnim) {
      const { pair } = anim;
      const fallen = pair.front;
      const revealed = pair.back;

      // revealed already at frontHome from correct slide — leave it
      fallen.root.position.copy(pair.backHome);
      faceCamera(fallen);
      applyCardScale(fallen, rows[pair.row].cardSize);
      applyCardScale(revealed, rows[pair.row].cardSize);

      pair.front = revealed;
      pair.back = fallen;
      revealed.root.userData.role = "front";
      fallen.root.userData.role = "back";
      revealed.root.userData.clickable = true;
      fallen.root.userData.clickable = false;
      revealed.mesh.renderOrder = 2;
      fallen.mesh.renderOrder = 1;

      assignMap(fallen, pickTexture(revealed.mat.map));

      pair.busy = false;
    }

    function onPointerDown(event: PointerEvent) {
      const pair = pickFront(event);

      if (pair) {
        startPairVend(pair);
      }
    }

    function updateAnims(now: number) {
      for (let i = animations.length - 1; i >= 0; i -= 1) {
        const anim = animations[i];

        if (anim.phase === "slide") {
          const u = Math.min(1, (now - anim.t0) / SLIDE_MS);
          const e = easeOutCubic(u);
          anim.pair.front.root.position.lerpVectors(
            anim.frontStart,
            anim.slideEndFront,
            e,
          );
          anim.pair.back.root.position.lerpVectors(
            anim.backStart,
            anim.slideEndBack,
            e,
          );

          if (u >= 1) {
            // snap back exactly onto front home
            anim.pair.back.root.position.copy(anim.pair.frontHome);
            anim.phase = "fall";
            anim.t0 = now;
            anim.frontStart.copy(anim.slideEndFront);
          }

          continue;
        }

        if (anim.phase === "fall") {
          const u = Math.min(1, (now - anim.t0) / FALL_MS);
          const e = easeInQuad(u);
          anim.pair.front.root.position.lerpVectors(
            anim.frontStart,
            anim.fallEnd,
            e,
          );

          const q = new THREE.Quaternion().setFromAxisAngle(
            anim.rotAxis,
            anim.rotAmount * e,
          );
          anim.pair.front.root.quaternion.copy(anim.baseQuat).multiply(q);

          if (u >= 1) {
            finishPair(anim);
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
      pairs,
      modelUrl: MODEL_URL,
      lightTune,
      postTune,
      get fallLandLocalY() {
        return fallLandLocalY;
      },
    };

    const loader = new GLTFLoader();

    void (async () => {
      try {
        const pool = await loadIconPool(ICON_POOL_LIMIT);

        if (disposed) {
          pool.textures.forEach((t) => t.dispose());
          return;
        }

        iconTextures = pool.textures;
        ownedTextures.push(...pool.textures);
      } catch (err) {
        console.error("[vending] icon pool failed", err);
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
            `[vending] loaded url=${MODEL_URL} meshes=${meshCount} icons=${iconTextures.length} rows=${ROW_COUNT}`,
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

          // aim pool at glass front
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

      if (modelRoot) {
        for (const pair of pairs) {
          modelRoot.remove(pair.front.root);
          modelRoot.remove(pair.back.root);
        }

        disposeOwned(modelRoot);
        scene.remove(modelRoot);
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
