import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { SceneKind } from "./types";
const palette = {
  ink: "#20363a",
  teal: "#378f80",
  cream: "#f1e9d8",
  sage: "#a8b991",
  copper: "#c47a50",
  slate: "#7da5aa",
  silver: "#d3dfdb",
};
function material(color: string, metalness = 0, roughness = 0.36) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.9,
  });
}
function box(
  width: number,
  height: number,
  depth: number,
  color: string,
  radius = 0.06,
) {
  return new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 2, radius),
    material(color),
  );
}
function sphere(radius: number, color: string, metalness = 0.7) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    material(color, metalness, 0.16),
  );
}
function ring(
  radius: number,
  tube: number,
  color: string,
  metalness = 0.4,
  arc = Math.PI * 2,
) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 14, 80, arc),
    material(color, metalness, 0.22),
  );
}
function book(color: string, width = 1.7) {
  const group = new THREE.Group();
  const pages = box(width - 0.07, 0.23, 1.07, palette.cream, 0.02);
  group.add(pages);
  for (const y of [-0.16, 0.16]) {
    const cover = box(width, 0.07, 1.18, color, 0.035);
    cover.position.y = y;
    group.add(cover);
  }
  const spine = box(0.09, 0.34, 1.18, color, 0.035);
  spine.position.x = -width / 2 + 0.03;
  group.add(spine);
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.16, 0.006, 0.009),
      new THREE.MeshStandardMaterial({ color: "#ddd5c4", roughness: 0.8 }),
    );
    line.position.set(0.02, -0.08 + i * 0.04, 0.543);
    group.add(line);
  }
  return group;
}
function browserTexture(kind: "video" | "code") {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = kind === "code" ? "#16272b" : "#f6f3e8";
  c.fillRect(0, 0, 768, 512);
  c.fillStyle = kind === "code" ? "#294044" : "#e9e5d9";
  c.fillRect(0, 0, 768, 72);
  ["#ed976f", "#d6d986", "#b0c6c2"].forEach((color, i) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(40 + i * 29, 35, 7, 0, Math.PI * 2);
    c.fill();
  });
  c.font = "500 17px monospace";
  c.fillStyle = kind === "code" ? "#97b4ad" : "#64766d";
  c.fillText(
    kind === "code" ? "a little practice.js" : "progressly / a new perspective",
    242,
    43,
  );
  if (kind === "video") {
    c.fillStyle = "#237e70";
    c.beginPath();
    c.roundRect(288, 165, 182, 142, 25);
    c.fill();
    c.fillStyle = "#f6f3e8";
    c.beginPath();
    c.moveTo(358, 199);
    c.lineTo(413, 236);
    c.lineTo(358, 273);
    c.closePath();
    c.fill();
    c.font = "500 19px monospace";
    c.fillStyle = "#64766d";
    c.fillText("WATCH. THINK. MAKE.", 272, 368);
    c.fillStyle = "#ddd8cc";
    c.fillRect(51, 449, 658, 5);
    c.fillStyle = "#409685";
    c.fillRect(51, 449, 255, 5);
  } else {
    const lines = [
      ["#8bc9a6", "const curiosity = true;"],
      ["#a4d6c5", ""],
      ["#a4d6c5", "function makeProgress() {"],
      ["#d7e1aa", "  learn.somethingNew();"],
      ["#9dc5cc", "  build.somethingReal();"],
      ["#a4d6c5", "}"],
      ["#e2a17c", ""],
      ["#d6cbac", "makeProgress();"],
    ];
    c.font = "24px monospace";
    lines.forEach(([color, line], i) => {
      c.fillStyle = "#7a9996";
      c.fillText(String(i + 1).padStart(2, "0"), 40, 119 + i * 45);
      c.fillStyle = color;
      c.fillText(line, 101, 119 + i * 45);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function browser(kind: "video" | "code") {
  const group = new THREE.Group();
  const frame = box(
    2.05,
    1.39,
    0.16,
    kind === "video" ? palette.teal : palette.ink,
    0.065,
  );
  group.add(frame);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.92, 1.28),
    new THREE.MeshBasicMaterial({ map: browserTexture(kind) }),
  );
  face.position.z = 0.086;
  group.add(face);
  return group;
}
function orbitLine(radius: number, color: string) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
  const geometry = new THREE.BufferGeometry().setFromPoints(
    curve.getPoints(96),
  );
  return new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
  );
}
export function buildModel(
  kind: SceneKind,
  progress = 0,
  values: number[] = [],
  selected = -1,
) {
  const root = new THREE.Group();
  root.name = `progressly-${kind}`;
  if (kind === "hero") {
    const portal = ring(1.48, 0.19, palette.teal, 0.62);
    portal.rotation.set(0.18, 0.27, -0.34);
    portal.position.set(0.12, 0.17, -0.18);
    root.add(portal);
    const orbit = orbitLine(1.98, "#7da99b");
    orbit.rotation.set(0.22, -0.25, 0.35);
    orbit.position.z = -0.6;
    root.add(orbit);
    const orbit2 = ring(1.74, 0.011, palette.silver, 0.9);
    orbit2.rotation.set(0.54, -0.72, 0.42);
    orbit2.position.z = -0.35;
    root.add(orbit2);
    const panel = browser("video");
    panel.rotation.set(-0.06, -0.3, 0.13);
    panel.position.set(0.05, 0.27, 0.64);
    root.add(panel);
    const lower = book(palette.copper, 1.8);
    lower.position.set(-0.25, -1.25, 0.16);
    lower.rotation.y = -0.26;
    root.add(lower);
    const upper = book(palette.sage, 1.65);
    upper.position.set(-0.13, -0.89, 0.32);
    upper.rotation.y = 0.2;
    root.add(upper);
    const chrome = sphere(0.27, palette.silver, 0.96);
    chrome.position.set(1.37, 1.47, 0.36);
    root.add(chrome);
    const pebble = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.23, 1),
      material(palette.sage, 0.14, 0.32),
    );
    pebble.position.set(-1.5, 0.99, 0.6);
    pebble.rotation.set(0.3, 0.5, 0.2);
    root.add(pebble);
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.21, 0.072, 64, 10),
      material(palette.copper, 0.5, 0.24),
    );
    knot.position.set(1.45, -0.96, 0.65);
    root.add(knot);
    const dot = sphere(0.08, palette.cream, 0.3);
    dot.position.set(-1.74, -0.58, 0.26);
    root.add(dot);
    root.rotation.set(0.06, -0.06, -0.06);
  } else if (kind === "books") {
    [palette.ink, palette.teal, palette.sage].forEach((color, i) => {
      const volume = book(color, 1.9 - i * 0.12);
      volume.position.set((i - 1) * 0.05, (i - 1) * 0.37, 0);
      volume.rotation.y = (i - 1) * 0.26;
      root.add(volume);
    });
    root.rotation.set(0.24, -0.47, -0.14);
    const dot = sphere(0.16, palette.copper);
    dot.position.set(1.11, 0.62, 0.1);
    root.add(dot);
  } else if (kind === "code") {
    const panel = browser("code");
    panel.rotation.set(-0.12, -0.2, -0.1);
    panel.position.y = 0.15;
    root.add(panel);
    const foot = box(2.12, 0.12, 1.08, "#87aaa5", 0.045);
    foot.position.set(0, -0.69, 0.41);
    root.add(foot);
    const keyboard = box(1.75, 0.016, 0.56, palette.ink, 0.02);
    keyboard.position.set(0, -0.618, 0.42);
    root.add(keyboard);
    const gem = sphere(0.18, palette.sage, 0.5);
    gem.position.set(1.08, 0.92, 0.35);
    root.add(gem);
    root.rotation.y = 0.12;
  } else if (kind === "data") {
    const base = box(2.0, 0.12, 1.5, "#b59b7a", 0.035);
    base.position.y = -0.7;
    root.add(base);
    const colors = ["#e8ccab", "#bf855d", "#dba573"];
    for (let x = 0; x < 3; x++)
      for (let z = 0; z < 3; z++) {
        const height = 0.3 + ((x * 3 + z * 2) % 5) * 0.18;
        const bar = box(0.39, height, 0.39, colors[(x + z) % 3], 0.035);
        bar.position.set((x - 1) * 0.52, -0.64 + height / 2, (z - 1) * 0.46);
        root.add(bar);
      }
    const loop = ring(0.5, 0.055, palette.ink, 0.45);
    loop.rotation.set(0.25, 0, 0.1);
    loop.position.set(0.66, 0.89, -0.3);
    root.add(loop);
    root.rotation.set(0.23, -0.5, 0.03);
  } else if (kind === "design") {
    const loop = ring(0.75, 0.22, "#ac6949", 0.32);
    loop.rotation.set(0.1, 0.52, 0.52);
    loop.position.set(-0.28, 0.12, 0.16);
    root.add(loop);
    const loop2 = ring(0.65, 0.18, "#dbad86", 0.2);
    loop2.rotation.set(0.8, -0.5, -0.15);
    loop2.position.set(0.36, -0.08, -0.22);
    root.add(loop2);
    const cube = box(0.48, 0.48, 0.48, palette.cream, 0.03);
    cube.rotation.set(0.25, -0.4, 0.2);
    cube.position.set(-0.95, -0.67, 0.12);
    root.add(cube);
    const metal = sphere(0.26, palette.silver, 0.95);
    metal.position.set(0.9, 0.64, 0.27);
    root.add(metal);
    root.rotation.y = -0.1;
  } else if (kind === "timeline") {
    const samples = Array.from({ length: 7 }, (_, i) =>
      Number.isFinite(values[i]) ? Math.max(0, values[i]) : 0,
    );
    const maximum = Math.max(1, ...samples);
    const platform = box(4.6, 0.11, 1.6, "#274244", 0.06);
    platform.position.y = -0.9;
    root.add(platform);
    const points: THREE.Vector3[] = [];
    samples.forEach((value, i) => {
      const x = (i - 3) * 0.59;
      const height = (value / maximum) * 1.75;
      const marker = ring(
        0.14,
        0.018,
        i === selected ? palette.sage : "#70978b",
        0.2,
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, -0.825, 0.43);
      root.add(marker);
      if (height > 0) {
        const pillar = box(
          0.36,
          height,
          0.48,
          i === selected ? palette.sage : palette.teal,
          0.025,
        );
        pillar.position.set(x, -0.84 + height / 2, -0.04);
        root.add(pillar);
      }
      const point = new THREE.Vector3(x, -0.79 + height, -0.05);
      points.push(point);
      const bead = sphere(
        i === selected ? 0.095 : 0.055,
        i === selected ? palette.sage : palette.cream,
        0.35,
      );
      bead.position.copy(point);
      root.add(bead);
    });
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    root.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.014, 6, false),
        material("#c9e5da", 0.25),
      ),
    );
    for (let i = 0; i < 3; i++) {
      const rail = box(4.25, 0.006, 0.006, "#64887e", 0.001);
      rail.position.set(0, -0.837, -0.53 + i * 0.37);
      root.add(rail);
    }
    root.rotation.set(0.24, -0.25, 0);
  } else if (kind === "rings") {
    const colors = [palette.teal, "#78b5a0", palette.copper];
    colors.forEach((color, i) => {
      const radius = 1.18 - i * 0.31;
      const track = ring(radius, 0.075, "#b7b8b3", 0.25);
      track.position.z = i * 0.09;
      root.add(track);
      const value = Number.isFinite(values[i])
        ? Math.max(0, Math.min(1, values[i]))
        : 0;
      if (value > 0) {
        const arc = ring(radius, 0.081, color, 0.35, Math.PI * 2 * value);
        arc.rotation.z = Math.PI / 2;
        arc.position.z = i * 0.09 + 0.02;
        root.add(arc);
        const cap = sphere(0.085, color, 0.3);
        cap.position.set(
          -Math.sin(value * Math.PI * 2) * radius,
          Math.cos(value * Math.PI * 2) * radius,
          i * 0.09 + 0.02,
        );
        root.add(cap);
      }
    });
    root.rotation.set(0.18, -0.3, -0.08);
  } else if (kind === "goal") {
    const base = ring(1.05, 0.09, "#d4d3c2", 0.08);
    root.add(base);
    const tickGeometry = new THREE.BoxGeometry(0.018, 0.065, 0.022);
    const tickMaterial = new THREE.MeshStandardMaterial({
      color: "#a8af96",
      roughness: 0.75,
    });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tick = new THREE.Mesh(tickGeometry, tickMaterial);
      tick.position.set(Math.sin(angle) * 1.27, Math.cos(angle) * 1.27, -0.02);
      tick.rotation.z = -angle;
      root.add(tick);
    }
    if (progress > 0) {
      const arc = ring(
        1.05,
        0.105,
        palette.teal,
        0.25,
        Math.PI * 2 * Math.min(1, progress),
      );
      arc.rotation.z = Math.PI / 2;
      arc.position.z = 0.03;
      root.add(arc);
    }
    const cap = sphere(0.11, palette.teal, 0.3);
    cap.position.set(0, 1.05, 0.05);
    root.add(cap);
    root.rotation.set(0.1, -0.12, 0);
  } else {
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.85, 0.23, 100, 18, 2, 3),
      material(palette.teal, 0.6, 0.24),
    );
    root.add(knot);
    const orbit = orbitLine(1.5, "#7da99b");
    orbit.rotation.x = 0.6;
    root.add(orbit);
    const dot = sphere(0.15, palette.sage);
    dot.position.set(1.3, 0.51, 0.5);
    root.add(dot);
    root.rotation.set(0.1, -0.2, 0.2);
  }
  return root;
}
export function disposeModel(model: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  model.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry);
      const list = Array.isArray(object.material)
        ? object.material
        : [object.material];
      list.forEach((mat) => {
        materials.add(mat);
        Object.values(mat).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
