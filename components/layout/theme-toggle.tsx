"use client";
import { useTheme } from "next-themes";
import { SunMoon } from "lucide-react";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      className="icon-button landing-theme-toggle"
      aria-label="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunMoon size={21} aria-hidden="true" />
    </button>
  );
}
