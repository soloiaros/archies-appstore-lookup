"use client";

import { useEffect, useRef } from "react";

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

const SITE_BG = 0x0b0b0c;

/**
 * Served asset: public/vending_machine.glb (5.36 MB, 55 meshes).
 * Root vending_machine_optimized*.glb are still empty Blender stubs
 * (236 / 132 bytes, no meshes) — cannot be the scene source.
 */
const MODEL_URL = "/vending_machine.glb";

const SHELF_NAMES = [
  "polySurface263",
  "polySurface256",
  "polySurface266",
  "polySurface265",
  "polySurface264",
] as const;

const GLASS_MESH = "pCube413_lambert1_0";

const PLANE_SIZE = 0.3;

const SLIDE_DISTANCE = 0.26;

const SLIDE_MS = 280;

const FALL_MS = 560;

const PLANE_COLOR = 0x9a9aa0;

/** ~50mm full-frame equivalent. */
const FOCAL_LENGTH_MM = 50;

const FILM_GAUGE_MM = 36;

/** Green blinker pulse (Hz). */
const BLINK_HZ = 1.35;

type AnimPhase = "idle" | "slide" | "fall" | "done";

type PlaneAnim = {
  mesh: THREE.Mesh;
  phase: AnimPhase;
  t0: number;
  start: THREE.Vector3;
  slideEnd: THREE.Vector3;
  fallEnd: THREE.Vector3;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInQuad(t: number): number {
  return t * t;
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
    glass.opacity = 0.18;
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

function isLightMeshName(name: string): boolean {
  return /light/i.test(name);
}

function isBlinkMeshName(name: string): boolean {
  return /blink/i.test(name);
}

function makeNeonMaterial(
  color: number,
  intensity: number,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
    toneMapped: false,
  });
  mat.userData.ownsClone = true;
  mat.userData.isNeon = true;
  return mat;
}

/** Fixture-owned point light — same color/position as its neon mesh. */
function attachFixtureLight(
  mesh: THREE.Mesh,
  color: number,
  intensity: number,
): THREE.PointLight {
  const light = new THREE.PointLight(color, intensity, 5.5, 2);
  light.name = `${mesh.name}_pt`;
  light.castShadow = false;
  mesh.add(light);
  mesh.userData.fixtureLight = light;
  return light;
}

/**
 * Optimized lights GLB is empty — install neon fixtures along the
 * glass bay to match the reference interior LED frame + blinker.
 */
function installNeonFixtures(
  root: THREE.Object3D,
  glassBox: THREE.Box3,
): { whites: THREE.Mesh[]; blink: THREE.Mesh | null; owned: THREE.Material[] } {
  const owned: THREE.Material[] = [];
  const whites: THREE.Mesh[] = [];
  const group = new THREE.Group();
  group.name = "lights";

  const toLocal = (x: number, y: number, z: number) =>
    root.worldToLocal(new THREE.Vector3(x, y, z));

  const gx0 = glassBox.min.x + 0.06;
  const gx1 = glassBox.max.x - 0.06;
  const gy0 = glassBox.min.y + 0.08;
  const gy1 = glassBox.max.y - 0.06;
  const gz = glassBox.min.z + 0.04;
  const spanX = gx1 - gx0;
  const spanY = gy1 - gy0;
  const tube = 0.04;

  const specs: {
    name: string;
    w: number;
    h: number;
    d: number;
    x: number;
    y: number;
    z: number;
  }[] = [
    {
      name: "light",
      w: spanX,
      h: tube,
      d: tube,
      x: (gx0 + gx1) / 2,
      y: gy1,
      z: gz,
    },
    {
      name: "light.001",
      w: tube,
      h: spanY,
      d: tube,
      x: gx0,
      y: (gy0 + gy1) / 2,
      z: gz,
    },
    {
      name: "light.002",
      w: tube,
      h: spanY,
      d: tube,
      x: gx1,
      y: (gy0 + gy1) / 2,
      z: gz,
    },
    {
      name: "light.003",
      w: spanX * 0.92,
      h: tube,
      d: tube,
      x: (gx0 + gx1) / 2,
      y: gy0 + 0.12,
      z: gz,
    },
  ];

  for (const s of specs) {
    const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
    const mat = makeNeonMaterial(0xffffff, 1.8);
    owned.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = s.name;
    mesh.position.copy(toLocal(s.x, s.y, s.z));
    mesh.userData.ownsGeometry = true;
    mesh.userData.isNeon = true;
    attachFixtureLight(mesh, 0xfff5e6, 3.6);
    group.add(mesh);
    whites.push(mesh);
  }

  const blinkMat = makeNeonMaterial(0x39ff14, 2.8);
  owned.push(blinkMat);
  const blinkGeo = new THREE.SphereGeometry(0.05, 12, 12);
  const blink = new THREE.Mesh(blinkGeo, blinkMat);
  blink.name = "light_blink";

  // status LED on the control fascia (model −X of glass)
  blink.position.copy(
    toLocal(
      glassBox.min.x - 0.42,
      glassBox.min.y + spanY * 0.18,
      glassBox.min.z - 0.02,
    ),
  );

  blink.userData.ownsGeometry = true;
  blink.userData.isNeon = true;
  blink.userData.isBlink = true;
  attachFixtureLight(blink, 0x39ff14, 2.2);
  group.add(blink);

  root.add(group);

  return { whites, blink, owned };
}

function collectOrInstallLights(
  root: THREE.Object3D,
  glassBox: THREE.Box3,
): {
  whites: THREE.Mesh[];
  blink: THREE.Mesh | null;
  owned: THREE.Material[];
  source: "model" | "fixtures";
} {
  const whites: THREE.Mesh[] = [];
  const blinkFound: THREE.Mesh[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    if (isBlinkMeshName(mesh.name)) {
      blinkFound.push(mesh);
      return;
    }

    if (isLightMeshName(mesh.name)) {
      whites.push(mesh);
    }
  });

  const blink = blinkFound[0] ?? null;

  if (whites.length === 0 && !blink) {
    const installed = installNeonFixtures(root, glassBox);
    return { ...installed, source: "fixtures" };
  }

  const owned: THREE.Material[] = [];

  for (const mesh of whites) {
    const mat = makeNeonMaterial(0xffffff, 1.8);
    owned.push(mat);
    mesh.material = mat;
    mesh.userData.isNeon = true;
    attachFixtureLight(mesh, 0xfff5e6, 3.6);
  }

  if (blink) {
    const mat = makeNeonMaterial(0x39ff14, 2.8);
    owned.push(mat);
    blink.material = mat;
    blink.userData.isNeon = true;
    blink.userData.isBlink = true;
    attachFixtureLight(blink, 0x39ff14, 2.2);
  }

  return { whites, blink, owned, source: "model" };
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
    let binLanded = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SITE_BG);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
    camera.filmGauge = FILM_GAUGE_MM;
    camera.setFocalLength(FOCAL_LENGTH_MM);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(SITE_BG, 1);
    mount.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // illumination only from fixture-owned PointLights (no Ambient/Hemi/Dir)

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.35,
      0.6,
      0.85,
    );
    composer.addPass(bloomPass);

    const bokehPass = new BokehPass(scene, camera, {
      focus: 14,
      aperture: 0.00008,
      maxblur: 0.002,
    });
    composer.addPass(bokehPass);

    const colorPass = new ShaderPass(ColorCorrectionShader);
    colorPass.uniforms.powRGB.value = new THREE.Vector3(1.08, 1.06, 1.1);
    colorPass.uniforms.mulRGB.value = new THREE.Vector3(0.92, 0.93, 0.96);
    composer.addPass(colorPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = 0.95;
    vignettePass.uniforms.darkness.value = 0.85;
    composer.addPass(vignettePass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickables: THREE.Mesh[] = [];
    const animations: PlaneAnim[] = [];
    const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const ownedMats: THREE.Material[] = [];

    let modelRoot: THREE.Object3D | null = null;
    let fitted = false;
    let blinkMesh: THREE.Mesh | null = null;
    let blinkBaseIntensity = 2.8;
    let blinkLightBase = 2.2;

    const outAxis = new THREE.Vector3(0, 0, -1);
    const binBase = new THREE.Vector3();

    function centerModel(root: THREE.Object3D) {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.updateMatrixWorld(true);
    }

    function fitCamera(root: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.aspect = aspect;
      camera.filmGauge = FILM_GAUGE_MM;
      camera.setFocalLength(FOCAL_LENGTH_MM);
      camera.updateProjectionMatrix();

      // distance from vertical FOV to frame machine with margin
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const fitH = size.y * 1.18;
      const fitW = size.x * 1.28;
      const distH = fitH / (2 * Math.tan(vFov / 2));
      const distW = fitW / (2 * Math.tan(vFov / 2) * aspect);
      const dist = Math.max(distH, distW);

      // composed front: slight yaw + downward look, still −Z hemisphere
      const yaw = THREE.MathUtils.degToRad(9);
      const pitch = THREE.MathUtils.degToRad(-6);
      const front = new THREE.Vector3(
        Math.sin(yaw) * dist * 0.35,
        Math.sin(-pitch) * dist * 0.25 + size.y * 0.06,
        -Math.cos(yaw) * dist,
      );

      camera.position.set(
        center.x + front.x,
        center.y + front.y,
        center.z + front.z,
      );

      // look below center so sticky header clears the crown
      camera.lookAt(
        center.x + size.x * 0.04,
        center.y - size.y * 0.08,
        center.z,
      );

      const focusDist = camera.position.distanceTo(
        new THREE.Vector3(center.x, center.y + size.y * 0.05, center.z + box.min.z),
      );
      const focusUniform = bokehPass.uniforms as {
        focus: { value: number };
      };
      focusUniform.focus.value = focusDist;
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

      if (modelRoot && fitted) {
        fitCamera(modelRoot);
      }
    }

    function placePlanes(root: THREE.Object3D) {
      const glass = root.getObjectByName(GLASS_MESH);
      const glassBox = glass
        ? new THREE.Box3().setFromObject(glass)
        : new THREE.Box3();

      const shelves: THREE.Box3[] = [];

      for (const name of SHELF_NAMES) {
        const node = root.getObjectByName(name);

        if (node) {
          shelves.push(new THREE.Box3().setFromObject(node));
        }
      }

      const toLocal = (world: THREE.Vector3) => root.worldToLocal(world.clone());

      if (!glassBox.isEmpty()) {
        const gx = glassBox.getCenter(new THREE.Vector3()).x;
        binBase.copy(
          toLocal(
            new THREE.Vector3(
              gx,
              glassBox.min.y - 0.95,
              glassBox.min.z + 0.28,
            ),
          ),
        );
      } else {
        binBase.set(0, -3.5, -1.2);
      }

      const bayMin = !glassBox.isEmpty()
        ? glassBox.min.x + 0.2
        : shelves[0].min.x + 0.25;
      const bayMax = !glassBox.isEmpty()
        ? glassBox.max.x - 0.2
        : shelves[0].max.x - 0.25;
      const bayW = bayMax - bayMin;
      const slot = bayW / 3;
      const worldXs = [
        bayMin + slot * 0.5,
        bayMin + slot * 1.5,
        bayMin + slot * 2.5,
      ];

      for (let s = 0; s < shelves.length; s += 1) {
        const shelf = shelves[s];
        const seatZ = shelf.min.z + 0.22;
        const seatY = shelf.max.y + 0.04;

        for (let i = 0; i < 3; i += 1) {
          const mat = new THREE.MeshBasicMaterial({
            color: PLANE_COLOR,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true,
            toneMapped: false,
          });

          ownedMats.push(mat);

          const mesh = new THREE.Mesh(planeGeo, mat);
          mesh.rotation.y = Math.PI;

          const local = toLocal(
            new THREE.Vector3(
              worldXs[i],
              seatY + PLANE_SIZE / 2,
              seatZ,
            ),
          );

          mesh.position.copy(local);
          mesh.renderOrder = 1;
          mesh.userData.shelfIndex = s;
          mesh.userData.slotIndex = i;
          mesh.userData.clickable = true;
          root.add(mesh);
          clickables.push(mesh);
        }
      }
    }

    function pointerFromEvent(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickPlane(event: PointerEvent): THREE.Mesh | null {
      pointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);

      for (const hit of hits) {
        const mesh = hit.object as THREE.Mesh;

        if (mesh.userData.clickable) {
          return mesh;
        }
      }

      return null;
    }

    function onPointerMove(event: PointerEvent) {
      canvas.style.cursor = pickPlane(event) ? "pointer" : "default";
    }

    function startVend(mesh: THREE.Mesh) {
      const existing = animations.find((a) => a.mesh === mesh);

      if (existing && existing.phase !== "idle" && existing.phase !== "done") {
        return;
      }

      if (mesh.userData.busy) {
        return;
      }

      mesh.userData.busy = true;
      mesh.userData.clickable = false;

      const start = mesh.position.clone();
      const slideEnd = start.clone().addScaledVector(outAxis, SLIDE_DISTANCE);

      const offsetX = ((binLanded % 3) - 1) * 0.18;
      const offsetZ = Math.floor(binLanded / 3) * 0.1 * outAxis.z;
      binLanded += 1;

      const fallEnd = new THREE.Vector3(
        binBase.x + offsetX,
        binBase.y + PLANE_SIZE / 2,
        binBase.z + offsetZ,
      );

      animations.push({
        mesh,
        phase: "slide",
        t0: performance.now(),
        start,
        slideEnd,
        fallEnd,
      });
    }

    function onPointerDown(event: PointerEvent) {
      const mesh = pickPlane(event);

      if (mesh) {
        startVend(mesh);
      }
    }

    function updateAnims(now: number) {
      for (const anim of animations) {
        if (anim.phase === "done" || anim.phase === "idle") {
          continue;
        }

        if (anim.phase === "slide") {
          const u = Math.min(1, (now - anim.t0) / SLIDE_MS);
          const e = easeOutCubic(u);
          anim.mesh.position.lerpVectors(anim.start, anim.slideEnd, e);

          if (u >= 1) {
            anim.phase = "fall";
            anim.t0 = now;
            anim.start.copy(anim.slideEnd);
          }

          continue;
        }

        if (anim.phase === "fall") {
          const u = Math.min(1, (now - anim.t0) / FALL_MS);
          const e = easeInQuad(u);
          anim.mesh.position.lerpVectors(anim.start, anim.fallEnd, e);
          anim.mesh.rotation.x = e * 0.2;

          if (u >= 1) {
            anim.mesh.position.copy(anim.fallEnd);
            anim.phase = "done";
          }
        }
      }
    }

    function updateBlink(now: number) {
      if (!blinkMesh) {
        return;
      }

      const mat = blinkMesh.material as THREE.MeshStandardMaterial;
      const pulse =
        0.08 +
        0.92 * (0.5 + 0.5 * Math.sin(now * 0.001 * Math.PI * 2 * BLINK_HZ));
      mat.emissiveIntensity = blinkBaseIntensity * pulse;

      const pt = blinkMesh.userData.fixtureLight as THREE.PointLight | undefined;

      if (pt) {
        pt.intensity = blinkLightBase * pulse;
      }
    }

    function animate(now: number) {
      if (disposed) {
        return;
      }

      frameId = requestAnimationFrame(animate);
      updateAnims(now);
      updateBlink(now);
      composer.render();
    }

    const loader = new GLTFLoader();

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) {
          disposeOwned(gltf.scene);
          return;
        }

        modelRoot = gltf.scene;
        scene.add(modelRoot);
        centerModel(modelRoot);

        ownedMats.push(...openFrontGlass(modelRoot));

        const glass = modelRoot.getObjectByName(GLASS_MESH);
        const glassBox = glass
          ? new THREE.Box3().setFromObject(glass)
          : new THREE.Box3().setFromObject(modelRoot);

        const lights = collectOrInstallLights(modelRoot, glassBox);
        ownedMats.push(...lights.owned);
        blinkMesh = lights.blink;

        if (blinkMesh) {
          const m = blinkMesh.material as THREE.MeshStandardMaterial;
          blinkBaseIntensity = m.emissiveIntensity || 2.8;
          const pt = blinkMesh.userData.fixtureLight as
            | THREE.PointLight
            | undefined;
          blinkLightBase = pt?.intensity ?? 2.2;
        }

        placePlanes(modelRoot);
        fitCamera(modelRoot);
        fitted = true;
        resize();
      },
      undefined,
      (err) => {
        console.error("GLB load failed", err);
      },
    );

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

      planeGeo.dispose();

      for (const mat of ownedMats) {
        mat.dispose();
      }

      if (modelRoot) {
        for (const mesh of clickables) {
          modelRoot.remove(mesh);
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
