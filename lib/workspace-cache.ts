import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import type { Workspace } from "@/types";
import {
  readWorkspaceStorage,
  writeWorkspaceStorage,
} from "@/lib/workspace-storage";

export const SYNC_INTERVAL = 24 * 60 * 60 * 1000;
export const RETRY_INTERVAL = 15 * 60 * 1000;
export const browserWorkspaceKey = "learntrack-workspace-v1";
export const accountWorkspaceKey = (owner: string) =>
  `learntrack-workspace-v2:${owner}`;
export type CachedWorkspace = {
  version: 2;
  owner: string;
  workspace: Workspace;
  revision: string | null;
  editId: string;
  dirty: boolean;
  baseKnown: boolean;
  lastSyncedAt: number;
  lastAttemptAt: number;
  pendingUpload?: { id: string; editId: string };
};
export async function readAccountCache(
  owner: string,
): Promise<CachedWorkspace | null> {
  const stored = await readWorkspaceStorage(accountWorkspaceKey(owner));
  if (!stored) return null;
  const value = JSON.parse(stored) as CachedWorkspace;
  if (
    value.version !== 2 ||
    value.owner !== owner ||
    typeof value.editId !== "string" ||
    typeof value.dirty !== "boolean" ||
    typeof value.baseKnown !== "boolean" ||
    !Number.isFinite(value.lastSyncedAt) ||
    !Number.isFinite(value.lastAttemptAt) ||
    !(value.revision === null || typeof value.revision === "string")
  )
    throw new Error(
      "Your local workspace cache could not be read. Export a backup before resetting browser storage.",
    );
  return {
    ...value,
    workspace: parseWorkspaceBackup(JSON.stringify(value.workspace)),
  };
}
export async function writeAccountCache(cache: CachedWorkspace) {
  await writeWorkspaceStorage(
    accountWorkspaceKey(cache.owner),
    JSON.stringify(cache),
  );
}
export function syncDue(cache: CachedWorkspace, now = Date.now()) {
  return (
    now - cache.lastSyncedAt >= SYNC_INTERVAL &&
    now - cache.lastAttemptAt >= RETRY_INTERVAL
  );
}
