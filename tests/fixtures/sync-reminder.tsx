import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceSyncReminder } from "../../components/layout/workspace-sync-reminder";

function Fixture() {
  const [state, setState] = useState({
    dirty: false,
    syncing: false,
    syncError: null as string | null,
    syncConflict: false,
  });
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const edits = useRef(0);
  return (
    <main>
      <WorkspaceSyncReminder
        {...state}
        shouldWarnOnClose={() => latest.current.dirty || latest.current.syncing}
        onOpenSettings={() => {
          document.title = "Sync settings opened";
        }}
        onSync={async () => {
          const sent = edits.current;
          setState((current) => ({
            ...current,
            syncing: true,
            syncError: null,
          }));
          try {
            const response = await fetch("/sync-test", { method: "POST" });
            if (!response.ok) {
              setState((current) => ({
                ...current,
                syncing: false,
                syncConflict: response.status === 409,
                syncError:
                  response.status === 409
                    ? "Another device has newer cloud data."
                    : "Cloud sync is unavailable. Your changes are saved locally.",
              }));
              return;
            }
            setState({
              dirty: edits.current !== sent,
              syncing: false,
              syncError: null,
              syncConflict: false,
            });
          } catch {
            setState((current) => ({
              ...current,
              syncing: false,
              syncError: "Network unavailable. Your changes are saved locally.",
            }));
          }
        }}
      />
      <h1>Learning workspace</h1>
      <button
        onClick={() => {
          edits.current++;
          setState((current) => ({ ...current, dirty: true }));
        }}
      >
        Save learning progress
      </button>
      <button
        onClick={() => {
          // Match the store's synchronous reset immediately before sign-out navigates.
          latest.current = {
            dirty: false,
            syncing: false,
            syncError: null,
            syncConflict: false,
          };
          window.location.assign(
            new URL("/signed-out-test", window.location.origin),
          );
        }}
      >
        Sign out
      </button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
