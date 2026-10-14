import { cn } from "@/lib/utils";
export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn("progress-track", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
