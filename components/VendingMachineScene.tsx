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

/** Shell meshes that include the front window pane. */
const GLASS_MESH_NAMES = [
  "polySurface322_kor2lambert4_0",
  "polySurface322_kor2lambert2_0",
] as const;

/** Product-bay X from coil upright span (world, after center). */
const BAY_X_MIN = -1.62;
const BAY_X_MAX = 1.78;

const PLANE_SIZE = 0.48;

const SLIDE_DISTANCE = 0.22;

const SLIDE_MS = 280;

const FALL_MS = 560;

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

type WindowBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
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

function softenCoilUprights(root: THREE.Object3D) {
  const cloned: THREE.Material[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    const match = /^polySurface(2[6-8]\d)_/.exec(mesh.name);

    if (!match) {
      return;
    }

    const id = Number(match[1]);

    if (id < 267 || id > 286) {
      return;
    }

    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    const next = mats.map((m) => {
      if (!m) {
        return m;
      }

      const soft = m.clone();
      soft.userData.ownsClone = true;
      soft.transparent = true;
      soft.opacity = 0.28;
      soft.depthWrite = false;
      cloned.push(soft);
      return soft;
    });

    mesh.material = next.length === 1 ? next[0] : next;
    mesh.renderOrder = 3;
  });

  return cloned;
}

function punchWindowHole(source: THREE.Material, win: WindowBounds): THREE.Material {
  const mat = source.clone();
  mat.userData.ownsClone = true;
  mat.transparent = false;
  mat.depthWrite = true;
  mat.side = THREE.FrontSide;

  const winUniform = {
    uWinMin: { value: new THREE.Vector3(win.minX, win.minY, win.minZ) },
    uWinMax: { value: new THREE.Vector3(win.maxX, win.maxY, win.minZ + 4) },
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWinMin = winUniform.uWinMin;
    shader.uniforms.uWinMax = winUniform.uWinMax;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWinWorldPos;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
         vWinWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWinWorldPos;
         uniform vec3 uWinMin;
         uniform vec3 uWinMax;`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         if (
           vWinWorldPos.x > uWinMin.x && vWinWorldPos.x < uWinMax.x &&
           vWinWorldPos.y > uWinMin.y && vWinWorldPos.y < uWinMax.y &&
           vWinWorldPos.z > uWinMin.z
         ) discard;`,
      );
  };

  mat.needsUpdate = true;
  return mat;
}

function applyFrontGlass(root: THREE.Object3D, win: WindowBounds) {
  const cloned: THREE.Material[] = [];

  for (const name of GLASS_MESH_NAMES) {
    const obj = root.getObjectByName(name);

    if (!obj) {
      continue;
    }

    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;

      if (!mesh.isMesh) {
        return;
      }

      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      const next = mats.map((m) => {
        if (!m) {
          return m;
        }

        const punched = punchWindowHole(m, win);
        cloned.push(punched);
        return punched;
      });

      mesh.material = next.length === 1 ? next[0] : next;
      mesh.renderOrder = 0;
    });
  }

  const glassW = win.maxX - win.minX;
  const glassH = win.maxY - win.minY;
  const glassGeo = new THREE.PlaneGeometry(glassW, glassH);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xc5ccd6,
    transparent: true,
    opacity: 0.18,
    roughness: 0.12,
    metalness: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  glassMat.userData.ownsClone = true;
  cloned.push(glassMat);

  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(
    (win.minX + win.maxX) * 0.5,
    (win.minY + win.maxY) * 0.5,
    win.minZ + 0.62,
  );
  glassMesh.renderOrder = 4;
  glassMesh.userData.frontGlass = true;
  glassMesh.userData.ownsGeometry = true;
  root.add(glassMesh);

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
    renderer.toneMappingExposure = 1.18;
    renderer.setClearColor(SITE_BG, 1);
    mount.appendChild(renderer.domElement);

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ambient = new THREE.AmbientLight(0xd8dce4, 0.92);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xe0e4ec, 0x4a4a52, 0.72);
    hemi.position.set(0, 20, 0);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xf6f8fc, 1.28);
    key.position.set(2.5, 12, 18);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xb8c0cc, 0.62);
    fill.position.set(-10, 6, 12);
    scene.add(fill);

    const panel = new THREE.DirectionalLight(0xf4f7fc, 1.25);
    panel.position.set(-12, 5, 14);
    scene.add(panel);

    const rim = new THREE.DirectionalLight(0x9aa0aa, 0.35);
    rim.position.set(-2, 8, -12);
    scene.add(rim);

    const interior = new THREE.PointLight(0xf2f6ff, 1.8, 22, 2);
    interior.position.set(0.2, 3.2, 2.8);
    scene.add(interior);

    const bayFill = new THREE.PointLight(0xe8eef8, 1.1, 16, 2);
    bayFill.position.set(0.2, -0.4, 2.4);
    scene.add(bayFill);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickables: THREE.Mesh[] = [];
    const animations: PlaneAnim[] = [];
    const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
    const sharedMats: THREE.Material[] = [];
    let glassMats: THREE.Material[] = [];

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

      const margin = 1.36;
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

    function measureWindow(root: THREE.Object3D): WindowBounds {
      const shelfBox = new THREE.Box3();

      for (const name of SHELF_PARENT_NAMES) {
        const node = root.getObjectByName(name);

        if (node) {
          shelfBox.expandByObject(node);
        }
      }

      return {
        minX: BAY_X_MIN,
        maxX: BAY_X_MAX,
        minY: shelfBox.min.y - 0.2,
        maxY: shelfBox.max.y + 0.35,
        // front shell faces forward of shelf decks
        minZ: shelfBox.max.z + 0.05,
      };
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
        binBase.copy(
          toLocal(
            new THREE.Vector3(
              flapBox.getCenter(new THREE.Vector3()).x,
              flapBox.min.y + 0.42,
              flapBox.min.z - outAxis.z * 0.1,
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

      const bayW = BAY_X_MAX - BAY_X_MIN;
      const slot = bayW / 3;
      const worldXs = [
        BAY_X_MIN + slot * 0.5,
        BAY_X_MIN + slot * 1.5,
        BAY_X_MIN + slot * 2.5,
      ];

      for (let s = 0; s < shelves.length; s += 1) {
        const shelf = shelves[s];

        // top face of shelf tray (AABB max.y)
        const seatZ = shelf.max.z + 0.14;
        const seatY = shelf.max.y + 0.05;

        for (let i = 0; i < 3; i += 1) {
          const mat = new THREE.MeshBasicMaterial({
            color: PLANE_COLOR,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true,
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
      const hit = pickPlane(event);
      canvas.style.cursor = hit ? "pointer" : "default";
    }

    function startVend(mesh: THREE.Mesh) {
      const existing = animations.find((a) => a.mesh === mesh);

      if (existing && existing.phase !== "idle") {
        return false;
      }

      if (mesh.userData.busy) {
        return false;
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

      return true;
    }

    function onPointerDown(event: PointerEvent) {
      const mesh = pickPlane(event);

      if (!mesh) {
        return;
      }

      startVend(mesh);
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

        scene.add(modelRoot);
        centerModel(modelRoot);

        const win = measureWindow(modelRoot);
        glassMats = [
          ...applyFrontGlass(modelRoot, win),
          ...softenCoilUprights(modelRoot),
        ];

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

      for (const mat of glassMats) {
        mat.dispose();
      }

      if (modelRoot) {
        for (const mesh of clickables) {
          modelRoot.remove(mesh);
        }

        modelRoot.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && mesh.userData.ownsGeometry) {
            mesh.geometry.dispose();
          }
        });

        disposeObject(modelRoot);
        scene.remove(modelRoot);
      }

      ambient.dispose();
      hemi.dispose();
      key.dispose();
      fill.dispose();
      panel.dispose();
      rim.dispose();
      interior.dispose();
      bayFill.dispose();
      renderer.dispose();

      if (canvas.parentNode === mount) {
        mount.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={hostRef} className="vending-scene" aria-hidden />;
}
