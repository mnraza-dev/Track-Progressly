"use client";
import { useFeedback } from "@/stores/feedback";

// High-performance canvas confetti particle system with zero external dependencies.
// Designed with Progressly's artisanal color palette.

const PALETTE = [
  "#e39a55", // teal
  "#c47a50", // copper
  "#d9bc8e", // sage
  "#10b981", // emerald
  "#f59e0b", // amber
  "#e8ccab", // cream
  "#c4b2ea", // slate
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
  shape: "rect" | "circle";
};

let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
const particles: Particle[] = [];
let animFrame = 0;

function ensureCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null {
  if (typeof window === "undefined") return null;

  if (!activeCanvas) {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "999999";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    activeCanvas = canvas;
    activeCtx = ctx;

    const resize = () => {
      if (activeCanvas) {
        activeCanvas.width = window.innerWidth;
        activeCanvas.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);
  }

  return { canvas: activeCanvas, ctx: activeCtx! };
}

export function fireConfetti(origin?: { x: number; y: number }) {
  if (
    typeof window === "undefined" ||
    !useFeedback.getState().celebrationsEnabled
  )
    return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const instance = ensureCanvas();
  if (!instance) return;

  const startX = origin?.x ?? window.innerWidth / 2;
  const startY = origin?.y ?? window.innerHeight * 0.45;

  const count = 48;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.5,
      size: 4 + Math.random() * 5,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      alpha: 1,
      shape: Math.random() > 0.4 ? "rect" : "circle",
    });
  }

  if (!animFrame) {
    animFrame = requestAnimationFrame(loop);
  }
}

function loop() {
  if (!activeCanvas || !activeCtx) {
    animFrame = 0;
    return;
  }

  activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.22; // gravity
    p.vx *= 0.98; // air drag
    p.rotation += p.vRot;
    p.alpha -= 0.016; // fade

    if (p.alpha <= 0 || p.y > activeCanvas.height + 20) {
      particles.splice(i, 1);
      continue;
    }

    activeCtx.save();
    activeCtx.globalAlpha = Math.max(0, p.alpha);
    activeCtx.translate(p.x, p.y);
    activeCtx.rotate(p.rotation);
    activeCtx.fillStyle = p.color;

    if (p.shape === "rect") {
      activeCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
    } else {
      activeCtx.beginPath();
      activeCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      activeCtx.fill();
    }

    activeCtx.restore();
  }

  if (particles.length > 0) {
    animFrame = requestAnimationFrame(loop);
  } else {
    animFrame = 0;
    activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
  }
}
