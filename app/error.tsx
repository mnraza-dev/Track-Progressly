"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="large-empty">
      <h1>A small detour.</h1>
      <p>Something interrupted your workspace. Try loading it again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
