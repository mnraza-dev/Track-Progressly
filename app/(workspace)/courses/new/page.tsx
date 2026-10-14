import { Suspense } from "react";
import { ImportForm } from "@/features/courses/import-form";
// Workspace data is loaded in the browser; navigation waits for its private state.
export const instant = false;
export default function Page() {
  return (
    <Suspense fallback={<p>Preparing your next chapter...</p>}>
      <ImportForm />
    </Suspense>
  );
}
