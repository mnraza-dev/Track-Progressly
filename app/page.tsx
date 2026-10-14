import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Landing } from "@/components/layout/landing";
// Workspace data is loaded in the browser; navigation waits for its private state.
export const instant = false;
export default function Home() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return <Landing />;
  return (
    <Suspense
      fallback={<div className="large-empty">A good day to learn...</div>}
    >
      <AppShell>
        <Dashboard />
      </AppShell>
    </Suspense>
  );
}
