import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ImportForm } from "../../features/courses/import-form";
import { CourseWorkspace } from "../../components/courses/course-workspace";
import { useWorkspace } from "../../stores/workspace";

// Exercise the real importer, workspace, store and player without live Clerk credentials.
function Fixture() {
  const loaded = useWorkspace((state) => state.loaded);
  const [path, setPath] = useState(
    new URLSearchParams(location.search).get("path") || "/courses/new",
  );
  useEffect(() => {
    void useWorkspace.getState().load();
  }, []);
  const go = (next: string) => {
    history.replaceState(
      null,
      "",
      `/telegram-test?path=${encodeURIComponent(next)}`,
    );
    setPath(next);
  };
  const router = {
    bfcacheId: path,
    push: go,
    replace: go,
    back: () => {},
    forward: () => {},
    refresh: () => {},
    hmrRefresh: () => {},
    prefetch: async () => {},
  };
  const parts = path.split("/");
  return (
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value={path}>
        <SearchParamsContext.Provider value={new URLSearchParams()}>
          <main>
            {loaded ? (
              parts[2] && parts[2] !== "new" ? (
                <CourseWorkspace courseId={parts[2]} videoId={parts[4]} />
              ) : (
                <ImportForm />
              )
            ) : (
              <p>Loading workspace…</p>
            )}
          </main>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
