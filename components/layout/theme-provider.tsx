"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function ThemeState() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme) document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey="learntrack-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeState />
      {children}
    </NextThemesProvider>
  );
}
