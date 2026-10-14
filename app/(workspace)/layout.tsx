import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
// Workspace data is loaded in the browser; navigation waits for its private state.
export const instant = false;
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="large-empty">Opening your learning workspace...</div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
