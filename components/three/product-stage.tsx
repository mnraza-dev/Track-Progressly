"use client";
import { useState } from "react";
import { Play, Code2, Bookmark, MoveUpRight } from "lucide-react";
import { SceneArtwork } from "./scene-provider";

const chapters = [
  {
    name: "Watch",
    kind: "hero" as const,
    icon: Play,
    tag: "MAKE A LITTLE SPACE",
    title: "Stay with the idea.",
    detail: "Your place in the video. Right where you left it.",
    annotation: "PICK UP WHERE YOU LEFT OFF",
  },
  {
    name: "Practice",
    kind: "code" as const,
    icon: Code2,
    tag: "TURN AN IDEA INTO SOMETHING",
    title: "Make it click.",
    detail: "Small practice tasks. A skill you can actually use.",
    annotation: "A LITTLE LESS WATCHING. A LITTLE MORE DOING.",
  },
  {
    name: "Remember",
    kind: "books" as const,
    icon: Bookmark,
    tag: "LEAVE A NOTE FOR FUTURE YOU",
    title: "Keep the good bits.",
    detail: "Notes and bookmarks, connected to the lesson.",
    annotation: "YOUR THINKING, IN ONE GOOD PLACE",
  },
];

export function ProductStage({ compact = false }: { compact?: boolean }) {
  const [chapter, setChapter] = useState(0);
  const current = chapters[chapter];
  return (
    <div
      className={`product-stage${compact ? " stage-compact" : ""}`}
      data-stage-chapter={chapter}
    >
      <div className="stage-heading">
        <span>THE LEARNING PROCESS</span>
        <span>
          0{chapter + 1} / 03 <MoveUpRight size={13} />
        </span>
      </div>
      <div className="stage-object">
        <span className="stage-watermark" aria-hidden="true">
          0{chapter + 1}
        </span>
        <SceneArtwork
          kind={current.kind}
          interactive
          label={`Interactive ${current.name.toLowerCase()} sculpture. Drag or use the arrow keys to rotate.`}
        />
        <span className="stage-annotation">{current.annotation}</span>
      </div>
      <div className="stage-caption" aria-live="polite">
        <span>{current.tag}</span>
        <strong>{current.title}</strong>
        <p>{current.detail}</p>
      </div>
      <div className="stage-chapters" aria-label="Explore the learning process">
        {chapters.map((item, index) => (
          <button
            key={item.name}
            aria-pressed={chapter === index}
            onClick={() => setChapter(index)}
          >
            <item.icon size={14} />
            <span>{item.name}</span>
            <small>0{index + 1}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
