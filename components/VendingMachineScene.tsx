"use client";

import { useEffect, useRef } from "react";

import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SITE_BG = 0x0b0b0c;

/** Product shelves, bottom → top (pre-center names). */
const SHELF_NAMES = [
  "polySurface263",
  "polySurface256",
  "polySurface266",
  "polySurface265",
  "polySurface264",
] as const;

/** Thin front window pane (min-Z face). */
const GLASS_MESH = "pCube413_lambert1_0";

/** Front base lip — customer mouth sits just above this. */
const FRONT_LIP = "polySurface362";

/**
 * Front face is min-Z (glass pCube413). Camera looks from −Z.
 * Keypad is on +X (screen-right) in that view.
 */

/** Tightest inter-shelf gap is ~0.40 — size planes to clear it. */
const PLANE_SIZE = 0.30;

const SLIDE_DISTANCE = 0.26;

const SLIDE_MS = 280;

const FALL_MS = 560;

const PLANE_COLOR = 0xe8e8ea;

/** Sticky header + nav pills; shift frustum so cabinet clears them. */
const HEADER_NUDGE_FRAC = 0.18;

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
      std.color.setHex(0xc8d0da);
    }

    if ("roughness" in std) {
      std.roughness = 0.12;
      std.metalness = 0.02;
    }

    cloned.push(glass);
    return glass;
  });

  mesh.material = next.length === 1 ? next[0] : next;
  mesh.renderOrder = 3;

  return cloned;
}

export function VendingMachineScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const mount = host;

    let disposed = false;
    let frameId = 0;
    let binLanded = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SITE_BG);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(SITE_BG, 1);
    host.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ambient = new THREE.AmbientLight(0xd8dce4, 0.78);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xe4e8f0, 0x3a3a42, 0.55);
    hemi.position.set(0, 20, 0);
    scene.add(hemi);

    // soft front key (from −Z)
    const key = new THREE.DirectionalLight(0xf4f6fa, 1.05);
    key.position.set(2, 10, -16);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xb0b8c4, 0.55);
    fill.position.set(-8, 4, -10);
    scene.add(fill);

    // keypad / right fascia
    const panel = new THREE.DirectionalLight(0xf0f4fa, 0.85);
    panel.position.set(12, 6, -8);
    scene.add(panel);

    const rim = new THREE.DirectionalLight(0x8a909a, 0.32);
    rim.position.set(0, 6, 12);
    scene.add(rim);

    const bay = new THREE.PointLight(0xf0f4ff, 1.15, 18, 2);
    bay.position.set(0, 4, -1.5);
    scene.add(bay);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickables: THREE.Mesh[] = [];
    const animations: PlaneAnim[] = [];
    const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const ownedMats: THREE.Material[] = [];

    let modelRoot: THREE.Object3D | null = null;
    let fitted = false;

    // out of compartment toward the front camera (−Z)
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

      // generous but large — reference-like framing
      const margin = 1.28;
      const viewH = size.y * margin;
      const viewW = size.x * margin;
      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);

      let halfH = viewH / 2;
      let halfW = viewW / 2;

      if (halfW / halfH < aspect) {
        halfW = halfH * aspect;
      } else {
        halfH = halfW / aspect;
      }

      // shift frustum up in world → machine sits lower under sticky header
      const nudge = halfH * HEADER_NUDGE_FRAC;

      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH + nudge;
      camera.bottom = -halfH + nudge;
      camera.near = 0.1;
      camera.far = 80;

      // FRONT: look from min-Z
      const frontZ = box.min.z - 18;
      camera.position.set(center.x, center.y, frontZ);
      camera.lookAt(center.x, center.y, center.z);
      camera.updateProjectionMatrix();
    }

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;

      if (w < 1 || h < 1) {
        return;
      }

      renderer.setSize(w, h, false);

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

      const lip = root.getObjectByName(FRONT_LIP);
      const lipBox = lip ? new THREE.Box3().setFromObject(lip) : null;

      const toLocal = (world: THREE.Vector3) => root.worldToLocal(world.clone());

      // retrieval mouth: below glass, front fascia — not rear flaps (310–312)
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
      } else if (lipBox && !lipBox.isEmpty()) {
        binBase.copy(
          toLocal(
            new THREE.Vector3(
              lipBox.getCenter(new THREE.Vector3()).x,
              lipBox.max.y + 0.55,
              lipBox.max.z + 0.12,
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

        // on deck, toward glass (min Z), still inside compartment
        const seatZ = shelf.min.z + 0.22;
        const seatY = shelf.max.y + 0.04;

        for (let i = 0; i < 3; i += 1) {
          const mat = new THREE.MeshBasicMaterial({
            color: PLANE_COLOR,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true,
          });

          ownedMats.push(mat);

          const mesh = new THREE.Mesh(planeGeo, mat);

          // face the front camera (−Z)
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

    function animate() {
      if (disposed) {
        return;
      }

      frameId = requestAnimationFrame(animate);
      updateAnims(performance.now());
      renderer.render(scene, camera);
    }

    const loader = new GLTFLoader();

    loader.load(
      "/vending_machine.glb",
      (gltf) => {
        if (disposed) {
          disposeOwned(gltf.scene);
          return;
        }

        modelRoot = gltf.scene;

        scene.add(modelRoot);
        centerModel(modelRoot);

        ownedMats.push(...openFrontGlass(modelRoot));
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
    animate();

    const ro = new ResizeObserver(() => resize());
    ro.observe(host);

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

      ambient.dispose();
      hemi.dispose();
      key.dispose();
      fill.dispose();
      panel.dispose();
      rim.dispose();
      bay.dispose();
      renderer.dispose();

      if (canvas.parentNode === host) {
        host.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={hostRef} className="vending-scene" aria-hidden />;
}
