import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppLoader } from "@/components/ui/app-loader";

// Workspace data is loaded in the browser; navigation waits for its private state.
export const instant = false;
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppLoader message="Opening your learning studio..." />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

