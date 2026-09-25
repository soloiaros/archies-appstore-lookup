"use client";

import { useEffect, useRef } from "react";

import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SITE_BG = 0x0b0b0c;

const SHELF_PARENT_NAMES = [
  "polySurface263",
  "polySurface256",
  "polySurface266",
  "polySurface265",
  "polySurface264",
] as const;

const FLAP_NAMES = [
  "polySurface310",
  "polySurface311",
  "polySurface312",
] as const;

const PLANE_SIZE = 0.72;

const SLIDE_DISTANCE = 0.38;

const SLIDE_MS = 280;

const FALL_MS = 580;

const PLANE_COLOR = 0xe8e8ea;

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

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    if (mesh.userData.ownsGeometry && mesh.geometry) {
      mesh.geometry.dispose();
    }

    const mat = mesh.material;

    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else if (mat) {
      mat.dispose();
    }
  });
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
    renderer.toneMappingExposure = 0.85;
    renderer.setClearColor(SITE_BG, 1);
    mount.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ambient = new THREE.AmbientLight(0xc4c8d0, 0.55);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xb0b6c0, 0x2a2a2e, 0.55);
    hemi.position.set(0, 20, 0);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xf2f4f8, 0.7);
    key.position.set(3, 14, 16);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x9aa0a8, 0.28);
    fill.position.set(-7, 5, 10);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x6a7078, 0.15);
    rim.position.set(0, 8, -12);
    scene.add(rim);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickables: THREE.Mesh[] = [];
    const animations: PlaneAnim[] = [];
    const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const sharedMats: THREE.Material[] = [];

    let modelRoot: THREE.Object3D | null = null;
    let fitted = false;
    let outAxis = new THREE.Vector3(0, 0, 1);
    let binBase = new THREE.Vector3();

    function centerModel(root: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.updateMatrixWorld(true);
    }

    function fitCamera(root: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const margin = 1.38;
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

      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.near = 0.1;
      camera.far = 80;
      camera.position.set(center.x, center.y, box.max.z + 18);
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
      const shelves: THREE.Box3[] = [];

      for (const name of SHELF_PARENT_NAMES) {
        const node = root.getObjectByName(name);

        if (!node) {
          continue;
        }

        shelves.push(new THREE.Box3().setFromObject(node));
      }

      const flapBox = new THREE.Box3();

      for (const name of FLAP_NAMES) {
        const node = root.getObjectByName(name);

        if (node) {
          flapBox.expandByObject(node);
        }
      }

      // retrieval flaps mark the front face
      if (!flapBox.isEmpty() && shelves.length > 0) {
        const shelfMidZ = (shelves[0].min.z + shelves[0].max.z) * 0.5;
        const flapZ = flapBox.getCenter(new THREE.Vector3()).z;
        outAxis =
          flapZ >= shelfMidZ
            ? new THREE.Vector3(0, 0, 1)
            : new THREE.Vector3(0, 0, -1);
      } else {
        outAxis = new THREE.Vector3(0, 0, 1);
      }

      const toLocal = (world: THREE.Vector3) => {
        return root.worldToLocal(world.clone());
      };

      if (!flapBox.isEmpty()) {
        // interior of retrieval well, behind flap
        binBase.copy(
          toLocal(
            new THREE.Vector3(
              flapBox.getCenter(new THREE.Vector3()).x,
              flapBox.min.y + 0.14,
              flapBox.min.z - outAxis.z * 0.32,
            ),
          ),
        );
      } else {
        const mb = new THREE.Box3().setFromObject(root);
        binBase.copy(
          toLocal(
            new THREE.Vector3(
              0,
              mb.min.y + 0.5,
              (outAxis.z >= 0 ? mb.max.z : mb.min.z) - outAxis.z * 0.6,
            ),
          ),
        );
      }

      for (let s = 0; s < shelves.length; s += 1) {
        const shelf = shelves[s];
        const inset = (shelf.max.x - shelf.min.x) * 0.14;
        const usable = shelf.max.x - shelf.min.x - inset * 2;
        const step = usable / 4;
        const worldXs = [
          shelf.min.x + inset + step,
          shelf.min.x + inset + step * 2,
          shelf.min.x + inset + step * 3,
        ];
        // sit on shelf, near glass lip
        const shelfFrontZ = outAxis.z >= 0 ? shelf.max.z : shelf.min.z;
        const seatZ = shelfFrontZ - outAxis.z * 0.08;
        const seatY = shelf.max.y + 0.02;

        for (let i = 0; i < 3; i += 1) {
          const mat = new THREE.MeshBasicMaterial({
            color: PLANE_COLOR,
            side: THREE.DoubleSide,
            // see through opaque glass mesh
            depthTest: false,
            depthWrite: false,
          });

          sharedMats.push(mat);

          const mesh = new THREE.Mesh(planeGeo, mat);
          const local = toLocal(
            new THREE.Vector3(
              worldXs[i],
              seatY + PLANE_SIZE / 2,
              seatZ,
            ),
          );
          mesh.position.copy(local);
          mesh.frustumCulled = false;
          mesh.renderOrder = 3;
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
      const hit = pickPlane(event);
      canvas.style.cursor = hit ? "pointer" : "default";
    }

    function onPointerDown(event: PointerEvent) {
      const mesh = pickPlane(event);

      if (!mesh) {
        return;
      }

      const existing = animations.find((a) => a.mesh === mesh);

      if (existing && existing.phase !== "idle") {
        return;
      }

      if (mesh.userData.busy) {
        return;
      }

      mesh.userData.busy = true;
      mesh.userData.clickable = false;

      const start = mesh.position.clone();
      const slideEnd = start
        .clone()
        .addScaledVector(outAxis, SLIDE_DISTANCE);

      const offsetX = ((binLanded % 3) - 1) * 0.22;
      const offsetZ = Math.floor(binLanded / 3) * -0.12 * outAxis.z;
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
          anim.mesh.rotation.x = e * 0.18;

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
          disposeObject(gltf.scene);
          return;
        }

        modelRoot = gltf.scene;

        modelRoot.traverse((obj) => {
          const mesh = obj as THREE.Mesh;

          if (!mesh.isMesh) {
            return;
          }

          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          for (const mat of mats) {
            if (!mat) {
              continue;
            }

            if (mat.transparent || mat.opacity < 0.99) {
              mat.depthWrite = false;
            }

            // glass-like
            if (
              "transmission" in mat &&
              typeof (mat as { transmission?: number }).transmission ===
                "number" &&
              ((mat as { transmission: number }).transmission > 0)
            ) {
              mat.transparent = true;
              mat.depthWrite = false;
            }
          }
        });

        scene.add(modelRoot);
        centerModel(modelRoot);
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

      for (const mat of sharedMats) {
        mat.dispose();
      }

      if (modelRoot) {
        for (const mesh of clickables) {
          modelRoot.remove(mesh);
        }

        disposeObject(modelRoot);
        scene.remove(modelRoot);
      }

      rim.dispose();
      renderer.dispose();

      if (canvas.parentNode === mount) {
        mount.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={hostRef} className="vending-scene" aria-hidden />;
}
