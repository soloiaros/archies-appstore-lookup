"use client";

import { useEffect, useRef } from "react";

import GUI from "lil-gui";
import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { ColorCorrectionShader } from "three/addons/shaders/ColorCorrectionShader.js";

/**
 * Served asset: public/vending_machine_optimized.glb
 * (copy of vending_machine_optimized._lights_full.glb).
 */
const MODEL_URL = "/vending_machine_optimized.glb";

const SHELF_NAMES = [
  "polySurface263",
  "polySurface256",
  "polySurface266",
  "polySurface265",
  "polySurface264",
] as const;

const GLASS_MESH = "pCube413_lambert1_0";

const CARDS_PER_ROW = 4;

const ICON_TEX_SIZE = 128;

/** Superellipse exponent — iOS continuous-corner feel. */
const SQUIRCLE_N = 5;

const CARD_DEPTH = 0.032;

const BASE_CARD_SIZE = 0.52;

const SLIDE_MS = 900;

const FALL_MS = 720;

const SLIDE_DISTANCE = 0.32;

/** ~50mm full-frame equivalent. */
const FOCAL_LENGTH_MM = 50;

const FILM_GAUGE_MM = 36;

const ICON_POOL_LIMIT = 40;

type AnimPhase = "slide" | "fall";

type RowTune = {
  spacing: number;
  x: number;
  y: number;
  z: number;
  cardSize: number;
  depthGap: number;
};

type CardPair = {
  front: THREE.Mesh;
  back: THREE.Mesh;
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
  geo.computeVertexNormals();
  return geo;
}

function squircleAlphaMask(ctx: CanvasRenderingContext2D, size: number) {
  const half = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  const segments = 64;

  ctx.beginPath();

  for (let i = 0; i <= segments; i += 1) {
    const p = squirclePoint(half, i / segments, SQUIRCLE_N);

    if (i === 0) {
      ctx.moveTo(cx + p.x, cy - p.y);
    } else {
      ctx.lineTo(cx + p.x, cy - p.y);
    }
  }

  ctx.closePath();
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

async function bakeIconTexture(
  url: string,
  size: number,
): Promise<THREE.CanvasTexture> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("2d context unavailable");
  }

  ctx.clearRect(0, 0, size, size);
  squircleAlphaMask(ctx, size);
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tex.userData.ownsTexture = true;
  tex.userData.canvas = canvas;

  return tex;
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
    `[vending] loading ${body.icons.length} popular icons (api count=${body.count})`,
  );

  const settled = await Promise.allSettled(
    body.icons.map((icon) => bakeIconTexture(icon.src, ICON_TEX_SIZE)),
  );

  const textures: THREE.Texture[] = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];

    if (result.status === "fulfilled") {
      textures.push(result.value);
    } else {
      console.warn("[vending] skip icon", body.icons[i].trackId, result.reason);
    }
  }

  console.info(`[vending] baked ${textures.length} icon textures`);

  return { textures, count: textures.length };
}

function disposeOwned(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (obj instanceof THREE.Light) {
      obj.dispose?.();
    }

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
    glass.opacity = 0.12;
    glass.depthWrite = false;
    glass.side = THREE.DoubleSide;

    const std = glass as THREE.MeshStandardMaterial;

    if (std.color) {
      std.color.setHex(0xb8c0ca);
    }

    if ("roughness" in std) {
      std.roughness = 0.12;
      std.metalness = 0.04;
    }

    cloned.push(glass);
    return glass;
  });

  mesh.material = next.length === 1 ? next[0] : next;
  mesh.renderOrder = 3;

  return cloned;
}

/** Cap face: Basic so icons stay readable under soft global light. */
function makeCardFaceMaterial(
  map: THREE.Texture | null,
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: map ?? null,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  mat.userData.ownsClone = true;
  return mat;
}

export function VendingMachineScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hostEl = hostRef.current;

    if (!hostEl) {
      return;
    }

    const mount = hostEl;

    let disposed = false;
    let frameId = 0;

    const scene = new THREE.Scene();
    scene.background = null;

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
    renderer.toneMappingExposure = 1.2;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.background = "transparent";

    // soft global fill — even, readable, page-blend
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    const hemiLight = new THREE.HemisphereLight(0xf0f2f5, 0x2c2c30, 0.95);
    hemiLight.position.set(0, 14, 0);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(-2.5, 8, -14);
    scene.add(ambientLight, hemiLight, keyLight);

    const composer = new EffectComposer(renderer);
    // EffectComposer flips autoClear — restore for the direct-render path
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);

    const renderPass = new RenderPass(scene, camera);
    renderPass.clear = true;
    renderPass.clearAlpha = 0;
    composer.addPass(renderPass);

    // mild / off by default so alpha stays clean
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0,
      0.4,
      0.9,
    );
    bloomPass.enabled = false;
    composer.addPass(bloomPass);

    const bokehPass = new BokehPass(scene, camera, {
      focus: 14,
      aperture: 0.00004,
      maxblur: 0,
    });
    bokehPass.enabled = false;
    composer.addPass(bokehPass);

    const colorPass = new ShaderPass(ColorCorrectionShader);
    colorPass.uniforms.powRGB.value = new THREE.Vector3(1.0, 1.0, 1.0);
    colorPass.uniforms.mulRGB.value = new THREE.Vector3(1.0, 1.0, 1.0);
    colorPass.enabled = false;
    composer.addPass(colorPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = 1.0;
    vignettePass.uniforms.darkness.value = 0;
    vignettePass.enabled = false;
    composer.addPass(vignettePass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pairs: CardPair[] = [];
    const animations: PairAnim[] = [];
    const ownedMats: THREE.Material[] = [];
    const ownedTextures: THREE.Texture[] = [];

    let cardGeo = makeCardGeometry(BASE_CARD_SIZE);
    let modelRoot: THREE.Object3D | null = null;
    let fitted = false;
    let cameraLocked = false;
    let iconTextures: THREE.Texture[] = [];
    let shelfSeats: Array<{ y: number; z: number }> = [];
    let bayMinX = 0;
    let bayMaxX = 0;
    let gui: GUI | null = null;

    const outAxis = new THREE.Vector3(0, 0, -1);
    const lookTarget = new THREE.Vector3();

    const rows: RowTune[] = SHELF_NAMES.map(() => ({
      spacing: 0,
      x: 0,
      y: 0,
      z: 0,
      cardSize: BASE_CARD_SIZE,
      depthGap: 0.07,
    }));

    function shelfSeat(
      index: number,
      count: number,
      glassBox: THREE.Box3,
    ): { y: number; z: number } {
      // empty Maya transforms sit at bogus world X — seat from glass bay
      const top = glassBox.max.y - 0.42;
      const bottom = glassBox.min.y + 0.78;
      const t = count <= 1 ? 0 : index / (count - 1);
      const y = top - t * (top - bottom);
      const z = glassBox.min.z + 0.1;
      return { y, z };
    }

    const camTune = {
      x: 0,
      y: 0,
      z: 0,
      tx: 0,
      ty: 0,
      tz: 0,
      focalLength: FOCAL_LENGTH_MM,
      yaw: 9,
      pitch: -6,
    };

    const postTune = {
      bloomStrength: 0,
      bloomRadius: 0.4,
      bloomThreshold: 0.9,
      vignetteOffset: 1.0,
      vignetteDarkness: 0,
      colorPow: 1.0,
      colorMul: 1.0,
      focus: 14,
      aperture: 0.00004,
      maxblur: 0,
      exposure: 1.2,
    };

    const lightTune = {
      ambient: 0.85,
      hemi: 0.95,
      key: 1.35,
      ambientColor: "#ffffff",
      hemiSky: "#f0f2f5",
      hemiGround: "#2c2c30",
      keyColor: "#ffffff",
    };

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

    function assignMap(mesh: THREE.Mesh, tex: THREE.Texture | null) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.map = tex;
      mat.needsUpdate = true;
    }

    function applyCardScale(mesh: THREE.Mesh, size: number) {
      const s = size / BASE_CARD_SIZE;
      mesh.scale.set(s, s, 1);
    }

    // Extrude cap faces +Z; rotate so icon faces machine front (−Z).
    function faceCamera(mesh: THREE.Mesh) {
      mesh.rotation.set(0, Math.PI, 0);
      mesh.quaternion.setFromEuler(mesh.rotation);
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
        const backWorld = new THREE.Vector3(wx, seatY, seatZ + row.depthGap);

        pair.frontHome.copy(toLocal(frontWorld));
        pair.backHome.copy(toLocal(backWorld));

        if (!pair.busy) {
          pair.front.position.copy(pair.frontHome);
          pair.back.position.copy(pair.backHome);
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

      const count = SHELF_NAMES.length;
      shelfSeats = [];

      for (let i = 0; i < count; i += 1) {
        shelfSeats.push(shelfSeat(i, count, glassBox));
      }

      bayMinX = Number.isFinite(glassBox.min.x)
        ? glassBox.min.x + 0.32
        : -1.2;
      bayMaxX = Number.isFinite(glassBox.max.x)
        ? glassBox.max.x - 0.55
        : 1.2;

      if (![bayMinX, bayMaxX].every(Number.isFinite) || bayMaxX <= bayMinX) {
        bayMinX = -1.2;
        bayMaxX = 1.2;
      }

      console.info(
        `[vending] seats=${shelfSeats.map((s) => s.y.toFixed(2)).join(",")}`,
      );

      for (let s = 0; s < shelfSeats.length; s += 1) {
        for (let i = 0; i < CARDS_PER_ROW; i += 1) {
          const frontTex = pickTexture();
          const backTex = pickTexture(frontTex);
          const faceA = makeCardFaceMaterial(frontTex);
          const faceB = makeCardFaceMaterial(backTex);
          ownedMats.push(faceA, faceB);

          // one material — ExtrudeGeometry multi-material UVs hide the icon on caps
          const front = new THREE.Mesh(cardGeo, faceA);
          const back = new THREE.Mesh(cardGeo, faceB);

          front.renderOrder = 2;
          back.renderOrder = 1;
          front.userData.clickable = true;
          back.userData.clickable = false;
          front.userData.role = "front";
          back.userData.role = "back";

          root.add(front);
          root.add(back);

          const pair: CardPair = {
            front,
            back,
            row: s,
            slot: i,
            frontHome: new THREE.Vector3(),
            backHome: new THREE.Vector3(),
            busy: false,
          };

          front.userData.pair = pair;
          back.userData.pair = pair;
          pairs.push(pair);
        }
      }

      layoutCards();
    }

    function applyCameraFromTune() {
      camera.filmGauge = FILM_GAUGE_MM;
      camera.setFocalLength(camTune.focalLength);
      camera.updateProjectionMatrix();
      camera.position.set(camTune.x, camTune.y, camTune.z);
      lookTarget.set(camTune.tx, camTune.ty, camTune.tz);
      camera.lookAt(lookTarget);

      const focusUniform = bokehPass.uniforms as {
        focus: { value: number };
      };
      focusUniform.focus.value = postTune.focus;
    }

    function fitCamera(root: THREE.Object3D) {
      if (cameraLocked) {
        applyCameraFromTune();
        return;
      }

      // exclude cards from framing so NaN seats never poison the camera
      const prevVis: Array<{ obj: THREE.Object3D; v: boolean }> = [];
      for (const pair of pairs) {
        prevVis.push({ obj: pair.front, v: pair.front.visible });
        prevVis.push({ obj: pair.back, v: pair.back.visible });
        pair.front.visible = false;
        pair.back.visible = false;
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
      // slight overscan so feet + flap stay in frame; leave headroom for sticky header
      const fitH = size.y * 1.18;
      const fitW = size.x * 1.22;
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
      camTune.tx = center.x + size.x * 0.03;
      camTune.ty = center.y - size.y * 0.04;
      camTune.tz = center.z;

      camera.position.set(camTune.x, camTune.y, camTune.z);
      const focusDist = camera.position.distanceTo(
        new THREE.Vector3(
          center.x,
          center.y + size.y * 0.05,
          center.z + box.min.z,
        ),
      );

      postTune.focus = Number.isFinite(focusDist) ? focusDist : dist;
      applyCameraFromTune();
      cameraLocked = true;
    }

    function postActive(): boolean {
      return (
        bloomPass.enabled ||
        bokehPass.enabled ||
        vignettePass.enabled ||
        colorPass.enabled
      );
    }

    function applyPostTune() {
      bloomPass.strength = postTune.bloomStrength;
      bloomPass.radius = postTune.bloomRadius;
      bloomPass.threshold = postTune.bloomThreshold;
      bloomPass.enabled = postTune.bloomStrength > 0.001;
      vignettePass.uniforms.offset.value = postTune.vignetteOffset;
      vignettePass.uniforms.darkness.value = postTune.vignetteDarkness;
      vignettePass.enabled = postTune.vignetteDarkness > 0.001;
      colorPass.uniforms.powRGB.value.set(
        postTune.colorPow,
        postTune.colorPow * 0.98,
        postTune.colorPow * 1.02,
      );
      colorPass.uniforms.mulRGB.value.set(
        postTune.colorMul,
        postTune.colorMul * 1.01,
        postTune.colorMul * 1.03,
      );
      colorPass.enabled =
        Math.abs(postTune.colorPow - 1) > 0.001 ||
        Math.abs(postTune.colorMul - 1) > 0.001;

      const bokehUniforms = bokehPass.uniforms as {
        focus: { value: number };
        aperture: { value: number };
        maxblur: { value: number };
      };
      bokehUniforms.focus.value = postTune.focus;
      bokehUniforms.aperture.value = postTune.aperture;
      bokehUniforms.maxblur.value = postTune.maxblur;
      bokehPass.enabled = postTune.maxblur > 0.0005;
      renderer.toneMappingExposure = postTune.exposure;
    }

    function buildGui() {
      gui = new GUI({ title: "Vending tune" });
      gui.domElement.style.zIndex = "40";

      const camFolder = gui.addFolder("Camera");
      camFolder.add(camTune, "x", -20, 20, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "y", -20, 20, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "z", -30, 30, 0.01).onChange(applyCameraFromTune);
      camFolder.add(camTune, "tx", -10, 10, 0.01).onChange(applyCameraFromTune);
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
        .add(postTune, "bloomStrength", 0, 2, 0.01)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "bloomRadius", 0, 1.5, 0.01)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "bloomThreshold", 0, 1, 0.01)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "vignetteOffset", 0, 2, 0.01)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "vignetteDarkness", 0, 2, 0.01)
        .onChange(applyPostTune);
      postFolder.add(postTune, "colorPow", 0.5, 2, 0.01).onChange(applyPostTune);
      postFolder.add(postTune, "colorMul", 0.4, 1.5, 0.01).onChange(applyPostTune);
      postFolder.add(postTune, "focus", 1, 40, 0.01).onChange(applyPostTune);
      postFolder
        .add(postTune, "aperture", 0.00001, 0.001, 0.00001)
        .onChange(applyPostTune);
      postFolder
        .add(postTune, "maxblur", 0, 0.02, 0.0001)
        .onChange(applyPostTune);
      postFolder.add(postTune, "exposure", 0.2, 2, 0.01).onChange(applyPostTune);

      rows.forEach((row, i) => {
        const f = gui!.addFolder(`Row ${i + 1}`);
        f.add(row, "spacing", 0, 1.2, 0.005).onChange(layoutCards);
        f.add(row, "x", -1.5, 1.5, 0.005).onChange(layoutCards);
        f.add(row, "y", -1.5, 1.5, 0.005).onChange(layoutCards);
        f.add(row, "z", -1.5, 1.5, 0.005).onChange(layoutCards);
        f.add(row, "cardSize", 0.2, 2, 0.01).onChange(layoutCards);
        f.add(row, "depthGap", 0.02, 0.25, 0.005).onChange(layoutCards);
      });

      const lightFolder = gui.addFolder("Lights");
      lightFolder
        .add(lightTune, "ambient", 0, 2.5, 0.01)
        .onChange((v: number) => {
          ambientLight.intensity = v;
        });
      lightFolder.add(lightTune, "hemi", 0, 2.5, 0.01).onChange((v: number) => {
        hemiLight.intensity = v;
      });
      lightFolder.add(lightTune, "key", 0, 3, 0.01).onChange((v: number) => {
        keyLight.intensity = v;
      });
      lightFolder.addColor(lightTune, "ambientColor").onChange((v: string) => {
        ambientLight.color.set(v);
      });
      lightFolder.addColor(lightTune, "hemiSky").onChange((v: string) => {
        hemiLight.color.set(v);
      });
      lightFolder.addColor(lightTune, "hemiGround").onChange((v: string) => {
        hemiLight.groundColor.set(v);
      });
      lightFolder.addColor(lightTune, "keyColor").onChange((v: string) => {
        keyLight.color.set(v);
      });

      applyPostTune();
    }

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;

      if (w < 1 || h < 1) {
        return;
      }

      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
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
      const fronts = pairs.map((p) => p.front);
      const hits = raycaster.intersectObjects(fronts, false);

      for (const hit of hits) {
        const mesh = hit.object as THREE.Mesh;
        const pair = mesh.userData.pair as CardPair | undefined;

        if (pair && !pair.busy && mesh.userData.clickable) {
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
      pair.front.userData.clickable = false;

      const frontStart = pair.front.position.clone();
      const backStart = pair.back.position.clone();
      const slideEndFront = frontStart
        .clone()
        .addScaledVector(outAxis, SLIDE_DISTANCE);
      const slideEndBack = backStart
        .clone()
        .addScaledVector(outAxis, SLIDE_DISTANCE);
      const fallEnd = slideEndFront
        .clone()
        .add(new THREE.Vector3(0, -0.55, 0))
        .addScaledVector(outAxis, 0.08);

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
        baseQuat: pair.front.quaternion.clone(),
      });
    }

    function finishPair(anim: PairAnim) {
      const { pair } = anim;
      const fallen = pair.front;
      const revealed = pair.back;
      const revealedMat = revealed.material as THREE.MeshBasicMaterial;
      const keepMap = revealedMat.map ?? null;

      fallen.position.copy(pair.backHome);
      revealed.position.copy(pair.frontHome);
      faceCamera(fallen);
      faceCamera(revealed);
      applyCardScale(fallen, rows[pair.row].cardSize);
      applyCardScale(revealed, rows[pair.row].cardSize);

      pair.front = revealed;
      pair.back = fallen;
      revealed.userData.role = "front";
      fallen.userData.role = "back";
      revealed.userData.clickable = true;
      fallen.userData.clickable = false;

      assignMap(fallen, pickTexture(keepMap));

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
          anim.pair.front.position.lerpVectors(
            anim.frontStart,
            anim.slideEndFront,
            e,
          );
          anim.pair.back.position.lerpVectors(
            anim.backStart,
            anim.slideEndBack,
            e,
          );

          if (u >= 1) {
            anim.phase = "fall";
            anim.t0 = now;
            anim.frontStart.copy(anim.slideEndFront);
          }

          continue;
        }

        if (anim.phase === "fall") {
          const u = Math.min(1, (now - anim.t0) / FALL_MS);
          const e = easeInQuad(u);
          anim.pair.front.position.lerpVectors(
            anim.frontStart,
            anim.fallEnd,
            e,
          );

          const q = new THREE.Quaternion().setFromAxisAngle(
            anim.rotAxis,
            anim.rotAmount * e,
          );
          anim.pair.front.quaternion.copy(anim.baseQuat).multiply(q);

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

      // composer passes destroy canvas alpha — direct path when post is off
      if (postActive()) {
        composer.render();
      } else {
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
      }
    }

    // debug hook for verification
    (window as unknown as { __vending?: object }).__vending = {
      scene,
      camera,
      composer,
      pairs,
      modelUrl: MODEL_URL,
      lightTune,
      postTune,
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
            }
          });
          console.info(
            `[vending] loaded url=${MODEL_URL} meshes=${meshCount} icons=${iconTextures.length}`,
          );

          const box = new THREE.Box3().setFromObject(modelRoot);
          const center = box.getCenter(new THREE.Vector3());
          modelRoot.position.sub(center);
          modelRoot.updateMatrixWorld(true);

          // front = glass min-Z side (keypad on −X / camera-right after yaw)
          const glass = modelRoot.getObjectByName(GLASS_MESH);
          const glassBox = glass
            ? new THREE.Box3().setFromObject(glass)
            : new THREE.Box3().setFromObject(modelRoot);

          const glassDepth = glassBox.max.z - glassBox.min.z;
          const glassWidth = glassBox.max.x - glassBox.min.x;
          const glassHeight = glassBox.max.y - glassBox.min.y;
          console.info(
            `[vending] glass size w=${glassWidth.toFixed(2)} h=${glassHeight.toFixed(2)} d=${glassDepth.toFixed(2)} minZ=${glassBox.min.z.toFixed(2)}`,
          );

          ownedMats.push(...openFrontGlass(modelRoot));

          placeCards(modelRoot);
          fitCamera(modelRoot);
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

      cardGeo.dispose();

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
          modelRoot.remove(pair.front);
          modelRoot.remove(pair.back);
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
