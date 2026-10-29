"use client";

import { useEffect } from "react";
import { CloudUpload, LoaderCircle } from "lucide-react";
import styles from "./workspace-sync-reminder.module.css";

export function WorkspaceSyncReminder({
  dirty,
  syncing,
  syncError,
  syncConflict,
  onSync,
  onOpenSettings,
  shouldWarnOnClose,
}: {
  dirty: boolean;
  syncing: boolean;
  syncError: string | null;
  syncConflict: boolean;
  onSync: () => Promise<void>;
  onOpenSettings: () => void;
  shouldWarnOnClose: () => boolean;
}) {
  const needsSync = dirty || syncing;

  useEffect(() => {
    if (!needsSync) return;
    const warnBeforeClosing = (event: BeforeUnloadEvent) => {
      // Sign-out and completed saves can change the store before effect cleanup.
      if (!shouldWarnOnClose()) return;
      // Browsers control this dialog's wording. Stay on the page to use Sync now;
      // an upload started while the tab is unloading cannot be guaranteed.
      event.preventDefault();
      event.returnValue = "Progress is waiting to sync to your account.";
    };
    window.addEventListener("beforeunload", warnBeforeClosing);
    return () => window.removeEventListener("beforeunload", warnBeforeClosing);
  }, [needsSync, shouldWarnOnClose]);

  if (!needsSync && !syncError) return null;

  return (
    <aside className={styles.reminder} aria-label="Cloud sync">
      <CloudUpload className={styles.icon} size={21} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.title} role="status">
          {syncing
            ? "Syncing progress to your account…"
            : syncError
              ? "Cloud sync needs attention"
              : "Sync progress before closing"}
        </p>
        <p className={styles.description}>
          {syncing
            ? "Keep this tab open until the sync finishes."
            : "Your latest changes are saved on this device. Sync them to your account before closing this tab."}
        </p>
        {syncError && (
          <p className={styles.error} role="alert">
            {syncError}
          </p>
        )}
      </div>
      <div className={styles.actions}>
        {syncConflict ? (
          <button
            type="button"
            className={styles.syncButton}
            onClick={onOpenSettings}
          >
            Review sync settings
          </button>
        ) : (
          <button
            type="button"
            className={styles.syncButton}
            disabled={syncing}
            onClick={() => void onSync()}
          >
            {syncing && (
              <LoaderCircle
                size={16}
                className={styles.spinner}
                aria-hidden="true"
              />
            )}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>
    </aside>
  );
}
