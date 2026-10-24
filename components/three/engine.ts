import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildModel, disposeModel } from "./models";
import type { SceneRegistration } from "./types";
type View = SceneRegistration & {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: THREE.Group;
  base: THREE.Euler;
  rotation: number;
  targetRotation: number;
  visible: boolean;
  pointer: THREE.Vector2;
  targetPointer: THREE.Vector2;
};
export class StudioRenderer {
  private renderer: THREE.WebGLRenderer;
  private environment: THREE.WebGLRenderTarget;
  private views = new Map<string, View>();
  private observer: IntersectionObserver;
  private media = window.matchMedia("(prefers-reduced-motion: reduce)");
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private disposed = false;
  private lost = false;
  private dragging: { id: string; x: number } | null = null;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.25 : 1.5),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.autoClear = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const generator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          for (const view of this.views.values())
            if (view.element === entry.target)
              view.visible = entry.isIntersecting;
        });
        this.wake();
      },
      { rootMargin: "40px" },
    );
    window.addEventListener("resize", this.resize);
    window.addEventListener("scroll", this.wake, { passive: true });
    document.addEventListener("visibilitychange", this.visibility);
    document.addEventListener("pointermove", this.pointer, { passive: true });
    document.addEventListener("pointerdown", this.down);
    document.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.canvas.addEventListener("webglcontextrestored", this.contextRestored);
    this.canvas.dataset.engine = "ready";
    this.wake();
  }
  register(id: string, registration: SceneRegistration) {
    const previous = this.views.get(id);
    this.remove(id);
    const scene = new THREE.Scene();
    scene.environment = this.environment.texture;
    const model = buildModel(
      registration.options.kind,
      registration.options.progress,
      registration.options.values,
      registration.options.selected,
    );
    scene.add(model);
    const ambient = new THREE.HemisphereLight("#ffffff", "#78958c", 0.85);
    scene.add(ambient);
    const key = new THREE.DirectionalLight("#fff4e1", 2.1);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#addfd0", 1.0);
    fill.position.set(4, 1, -2);
    scene.add(fill);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    camera.position.set(
      0,
      registration.options.kind === "books" ? 0.24 : 0.08,
      registration.options.kind === "hero"
        ? 6.8
        : ["goal", "focus", "lessons", "practice", "streak"].includes(
              registration.options.kind,
            )
          ? 4.8
          : registration.options.kind === "timeline"
            ? 7.8
            : registration.options.kind === "trophy"
              ? 5.2
              : 6,
    );
    camera.lookAt(0, 0, 0);
    this.views.set(id, {
      ...registration,
      scene,
      model,
      camera,
      base: model.rotation.clone(),
      rotation: previous?.rotation ?? 0,
      targetRotation: previous?.targetRotation ?? 0,
      visible: true,
      pointer: new THREE.Vector2(),
      targetPointer: new THREE.Vector2(),
    });
    this.observer.observe(registration.element);
    registration.element.dataset.threeState = "ready";
    this.wake();
  }
  remove(id: string) {
    const view = this.views.get(id);
    if (view) {
      this.observer.unobserve(view.element);
      disposeModel(view.model);
      delete view.element.dataset.threeState;
      this.views.delete(id);
      this.wake();
    }
  }
  rotate(id: string, amount: number) {
    const view = this.views.get(id);
    if (view) {
      view.targetRotation += amount;
      this.wake();
    }
  }
  reset(id: string) {
    const view = this.views.get(id);
    if (view) {
      view.targetRotation = 0;
      this.wake();
    }
  }
  private resize = () => {
    if (this.disposed) return;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.25 : 1.5),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.wake();
  };
  private wake = () => {
    if (
      !this.frame &&
      !this.disposed &&
      !this.lost &&
      document.visibilityState !== "hidden"
    )
      this.frame = requestAnimationFrame(this.render);
  };
  private visibility = () => {
    if (document.visibilityState === "hidden") {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.last = 0;
    } else this.wake();
  };
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.canvas.dataset.engine = "fallback";
    this.views.forEach((view) => delete view.element.dataset.threeState);
  };
  private contextRestored = () => {
    if (this.disposed) return;
    const generator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment.dispose();
    this.environment = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    this.views.forEach((view) => {
      view.scene.environment = this.environment.texture;
      view.element.dataset.threeState = "ready";
    });
    this.lost = false;
    this.last = 0;
    this.canvas.dataset.engine = "ready";
    this.wake();
  };
  private down = (e: PointerEvent) => {
    if (
      e.pointerType !== "mouse" ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest("a,button,input,select,textarea")
    )
      return;
    for (const [id, view] of this.views) {
      const rect = view.element.getBoundingClientRect();
      if (
        view.options.interactive &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        this.dragging = { id, x: e.clientX };
        view.element.dataset.dragging = "true";
        break;
      }
    }
  };
  private up = () => {
    if (this.dragging) {
      const view = this.views.get(this.dragging.id);
      if (view) delete view.element.dataset.dragging;
      this.dragging = null;
    }
  };
  private pointer = (e: PointerEvent) => {
    for (const view of this.views.values()) {
      if (!view.visible) continue;
      const rect = view.element.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      view.targetPointer.set(
        inside ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0,
        inside ? -(((e.clientY - rect.top) / rect.height) * 2 - 1) : 0,
      );
    }
    if (this.dragging) {
      const view = this.views.get(this.dragging.id);
      if (view) view.targetRotation += (e.clientX - this.dragging.x) * 0.007;
      this.dragging.x = e.clientX;
    }
    this.wake();
  };
  private render = (time: number) => {
    this.frame = 0;
    if (this.disposed) return;
    if (time - this.last < 30) {
      this.wake();
      return;
    }
    const delta = this.last ? Math.min(0.08, (time - this.last) / 1000) : 0;
    this.last = time;
    if (!this.media.matches) this.elapsed += delta;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.setClearColor(0, 0);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);
    let visible = 0;
    let moving = false;
    for (const view of this.views.values()) {
      if (!view.visible || !view.element.isConnected) continue;
      const rect = view.element.getBoundingClientRect();
      if (
        rect.bottom <= 0 ||
        rect.top >= height ||
        rect.right <= 0 ||
        rect.left >= width ||
        rect.width < 1 ||
        rect.height < 1
      )
        continue;

      const left = Math.max(0, rect.left),
        bottom = Math.max(0, height - rect.bottom),
        right = Math.min(width, rect.right),
        top = Math.min(height, height - rect.top);
      if (right - left <= 0 || top - bottom <= 0) continue;
      visible++;
      view.camera.aspect = rect.width / rect.height;
      view.camera.updateProjectionMatrix();
      view.rotation = THREE.MathUtils.damp(
        view.rotation,
        view.targetRotation,
        8,
        delta || 0.03,
      );
      view.pointer.x = THREE.MathUtils.damp(
        view.pointer.x,
        view.targetPointer.x,
        6,
        delta || 0.03,
      );
      view.pointer.y = THREE.MathUtils.damp(
        view.pointer.y,
        view.targetPointer.y,
        6,
        delta || 0.03,
      );
      moving ||=
        Math.abs(view.rotation - view.targetRotation) > 0.001 ||
        view.pointer.distanceTo(view.targetPointer) > 0.002;
      const float = ["goal", "timeline", "rings"].includes(view.options.kind)
        ? 0
        : Math.sin(this.elapsed * 0.6 + rect.left * 0.004) * 0.05;
      view.model.position.y = float;
      view.model.rotation.x = view.base.x + view.pointer.y * 0.08;
      view.model.rotation.y =
        view.base.y +
        view.rotation +
        view.pointer.x * 0.15 +
        (view.options.kind === "orbit" || view.options.kind === "trophy"
          ? this.elapsed * 0.08
          : 0);
      view.model.rotation.z =
        view.base.z +
        (view.options.kind === "hero" || view.options.kind === "trophy"
          ? Math.sin(this.elapsed * 0.24) * 0.015
          : 0);
      this.renderer.setViewport(
        rect.left,
        height - rect.bottom,
        rect.width,
        rect.height,
      );
      this.renderer.setScissor(left, bottom, right - left, top - bottom);
      this.renderer.render(view.scene, view.camera);
    }
    this.canvas.dataset.activeScenes = String(visible);
    if (visible && (!this.media.matches || moving)) this.wake();
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("scroll", this.wake);
    document.removeEventListener("visibilitychange", this.visibility);
    document.removeEventListener("pointermove", this.pointer);
    document.removeEventListener("pointerdown", this.down);
    document.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.contextRestored,
    );
    this.views.forEach((v) => disposeModel(v.model));
    this.views.clear();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
