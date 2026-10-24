import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StudyIllustrationKind = "focus" | "lessons" | "practice" | "streak";

const ink = "var(--illustration-ink)";
const paper = "var(--illustration-paper)";
const tint = "var(--illustration-tint)";

const artwork: Record<StudyIllustrationKind, ReactNode> = {
  focus: (
    <>
      <circle cx="59" cy="45" r="30" fill={tint} />
      <path d="M26 79h61M32 84h11" stroke={ink} opacity=".35" />
      <path d="M41 24h31c0 14-4 17-13 24 9 7 13 12 13 26H41c0-14 4-19 13-26-9-7-13-10-13-24Z" fill={paper} stroke={ink} />
      <path d="m44 31 12 12 13-12H44ZM44 69l12-13 13 13H44Z" fill={ink} />
      <path d="M56 46v12" stroke={ink} strokeDasharray="2 4" />
      <rect x="36" y="18" width="41" height="7" rx="3" fill={ink} />
      <rect x="36" y="73" width="41" height="7" rx="3" fill={ink} />
      <path d="m85 29 3 5 5 2-5 2-3 5-2-5-5-2 5-2 2-5Z" fill={ink} opacity=".7" stroke="none" />
      <circle cx="26" cy="54" r="3" fill={ink} opacity=".4" stroke="none" />
    </>
  ),
  lessons: (
    <>
      <circle cx="56" cy="48" r="31" fill={tint} />
      <g transform="rotate(-7 55 69)">
        <rect x="23" y="65" width="65" height="15" rx="4" fill={ink} />
        <path d="M30 69h53v7H30" fill={paper} stroke="none" />
        <path d="M34 72h44" stroke={ink} opacity=".3" />
      </g>
      <g transform="rotate(5 56 56)">
        <rect x="26" y="50" width="61" height="14" rx="4" fill={tint} stroke={ink} />
        <path d="M33 54h48v6H33" fill={paper} stroke="none" />
      </g>
      <path d="M21 22c15-4 25-1 35 6 10-7 21-10 35-6v29c-14-4-25-1-35 6-10-7-20-10-35-6V22Z" fill={paper} stroke={ink} />
      <path d="M56 28v29M29 30c7-1 13 0 19 3M29 38c7-1 13 0 19 3M64 33c6-3 12-4 19-3M64 41c6-3 12-4 19-3" stroke={ink} opacity=".6" />
      <path d="M73 23v18l4-3 4 3V21" fill={ink} stroke="none" />
      <path d="m91 65 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill={ink} opacity=".6" stroke="none" />
    </>
  ),
  practice: (
    <>
      <circle cx="55" cy="48" r="31" fill={tint} />
      <g transform="rotate(-8 56 48)">
        <rect x="30" y="17" width="53" height="66" rx="7" fill={tint} stroke={ink} />
        <rect x="35" y="22" width="43" height="55" rx="3" fill={paper} />
        <rect x="45" y="12" width="23" height="13" rx="4" fill={ink} stroke="none" />
        {[35, 49, 63].map((y, index) => (
          <g key={y}>
            <rect x="41" y={y} width="8" height="8" rx="2" fill={index < 2 ? ink : tint} stroke={ink} strokeWidth="1.4" />
            {index < 2 && <path d={`m43 ${y + 4} 2 2 3-4`} stroke={paper} strokeWidth="1.4" />}
            <path d={`M55 ${y + 2}h15m-15 5h10`} stroke={ink} opacity=".5" strokeWidth="1.4" />
          </g>
        ))}
      </g>
      <circle cx="83" cy="74" r="12" fill={ink} stroke={paper} strokeWidth="3" />
      <path d="m78 74 3 3 6-7" stroke={paper} />
      <path d="M18 37h7m-3-4v8" stroke={ink} opacity=".7" />
    </>
  ),
  streak: (
    <>
      <circle cx="57" cy="49" r="30" fill={tint} />
      <path d="M37 78c-16-12-14-28-5-39-1 10 4 12 8 6 8-10 9-20 7-30 19 11 23 24 22 33 6-2 8-8 8-12 15 20 11 37-1 44-11 7-28 6-39-2Z" fill={ink} stroke="none" />
      <path d="M47 76c-8-10-2-17 7-27 0 8 6 11 9 16 3-1 4-3 5-5 6 12 2 21-7 22-6 1-10-1-14-6Z" fill={paper} stroke="none" />
      <path d="M29 86h54M86 22v8m-4-4h8M20 56h5" stroke={ink} opacity=".55" />
      <circle cx="32" cy="22" r="2" fill={ink} stroke="none" opacity=".6" />
    </>
  ),
};

export function StudyIllustration({ kind, className }: {
  kind: StudyIllustrationKind;
  className?: string;
}) {
  return (
    <div className={cn("study-illustration", className)} data-illustration={kind} aria-hidden="true">
      <svg viewBox="0 0 112 96" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {artwork[kind]}
      </svg>
    </div>
  );
}
