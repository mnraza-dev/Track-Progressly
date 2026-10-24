"use client";

import { BookOpen, ClipboardCheck, Flame, Hourglass } from "lucide-react";
import { SceneArtwork } from "@/components/three/scene-provider";
import { cn } from "@/lib/utils";

export type StudyIllustrationKind = "focus" | "lessons" | "practice" | "streak";

const fallbackIcons = {
  focus: Hourglass,
  lessons: BookOpen,
  practice: ClipboardCheck,
  streak: Flame,
};

export function StudyIllustration({
  kind,
  className,
}: {
  kind: StudyIllustrationKind;
  className?: string;
}) {
  const FallbackIcon = fallbackIcons[kind];
  return (
    <div className={cn("study-illustration", className)} aria-hidden="true">
      <SceneArtwork
        kind={kind}
        label=""
        fallback={
          <FallbackIcon
            className="study-illustration-fallback"
            strokeWidth={1.25}
          />
        }
      />
    </div>
  );
}
