import { cn } from "@/lib/utils";
import { LEVEL_TIERS } from "@/lib/gamification";

export const LEVEL_BADGES = [
  { name: "The First Spark", material: "Copper", story: "Every skill starts with curiosity." },
  { name: "Open to Possibility", material: "Silver", story: "You showed up and put the first ideas to work." },
  { name: "Keep the Flame", material: "Bronze", story: "Small sessions are becoming a real practice." },
  { name: "Cut from Curiosity", material: "Amber", story: "Your effort is taking a shape of its own." },
  { name: "Made by Doing", material: "Gold", story: "You are building the things you used to only watch." },
  { name: "A New Perspective", material: "Platinum", story: "The connections are becoming your own insights." },
  { name: "Across Disciplines", material: "Starlight", story: "You bring ideas together and keep reaching further." },
  { name: "The Crown of Craft", material: "Obsidian & gold", story: "A collection of small efforts. An extraordinary journey." },
] as const;

export function LevelBadge({ level, locked = false, className, decorative = false }: { level: number; locked?: boolean; className?: string; decorative?: boolean }) {
  const index = Math.min(7, Math.max(0, level - 1));
  return <span className={cn("level-art-badge", locked && "level-art-locked", className)}
    role={decorative ? undefined : "img"} aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : `${locked ? "Locked" : "Earned"} level ${index + 1}: ${LEVEL_TIERS[index].title} — ${LEVEL_BADGES[index].name}`}
    style={{ backgroundPosition: `${index % 4 * 100 / 3}% ${index < 4 ? 0 : 100}%` }} />;
}
