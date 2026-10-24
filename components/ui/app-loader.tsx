"use client";

import { Sparkles } from "lucide-react";
import { Logo } from "@/components/layout/app-shell";

export function AppLoader({ message = "Opening your learning studio..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center gap-6 animate-in fade-in-50 duration-300">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 rounded-full bg-primary/10 animate-ping" />
        <div className="relative w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
          <Sparkles size={24} className="animate-spin" style={{ animationDuration: "3s" }} />
        </div>
      </div>
      <div className="space-y-1">
        <Logo />
        <p className="text-sm text-muted-foreground font-medium pt-2">{message}</p>
      </div>
    </div>
  );
}
