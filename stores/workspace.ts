"use client";
import { reconcileRewards } from "@/lib/rewards";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import { earnedCelebration, type Celebration } from "@/lib/celebrations";
import { create } from "zustand";
import { emptyWorkspace, emptyProgress, type Workspace } from "@/types";
import { isConnected } from "@/lib/supabase/client";
import { mutationSchema, courseSchema, type Mutation } from "@/lib/validations";
import { applyMutation } from "@/features/courses/local-reducer";
import { createId } from "@/lib/id";
import {
  accountWorkspaceKey,
  browserWorkspaceKey,
  readAccountCache,
  writeAccountCache,
  syncDue,
  type CachedWorkspace,
} from "@/lib/workspace-cache";

import {
  readWorkspaceStorage,
  writeWorkspaceStorage,
} from "@/lib/workspace-storage";

let pending: Promise<unknown> = Promise.resolve();
let epoch = 0;
let loading: { owner: string | null; promise: Promise<void> } | null = null;
let syncing: { owner: string; promise: Promise<void> } | null = null;
async function withLock<T>(name: string, job: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(name, job);
  return job();
}
function edit<T>(owner: string | null, job: () => Promise<T>): Promise<T> {
  const run = pending
    .catch(() => {})
    .then(() => withLock(`progressly-edit:${owner || "browser"}`, job));
  pending = run;
  return run;
}
async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    ...options,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error || "Cloud sync failed. Your local changes are saved.",
    ) as Error & { conflict?: boolean; setupRequired?: boolean };
    error.conflict = response.status === 409;
    error.setupRequired = result.setupRequired === true;
    throw error;
  }
  return result;
}
async function cloudWorkspace() {
  let warning: string | undefined;
  let snapshot;
  try {
    snapshot = await request("/api/workspace/sync");
  } catch (error) {
    if (!(error as { setupRequired?: boolean }).setupRequired) throw error;
    warning = (error as Error).message;
    snapshot = { workspace: null };
  }
  if (snapshot.workspace)
    return {
      workspace: parseWorkspaceBackup(JSON.stringify(snapshot.workspace)),
      revision: snapshot.revision as string | null,
    };
  // One-time import of existing normalized cloud data. Subsequent loads use snapshots.
  const legacy = await request("/api/workspace");
  return {
    workspace: parseWorkspaceBackup(JSON.stringify(legacy)),
    revision: null,
    warning,
  };
}
function cachedState(cache: CachedWorkspace) {
  return {
    data: cache.workspace,
    dirty: cache.dirty,
    lastSyncedAt: cache.lastSyncedAt || null,
    loaded: true,
    error: null,
  };
}
type State = {
  data: Workspace;
  accountId: string | null;
  loaded: boolean;
  error: string | null;
  toast: string | null;
  celebration: Celebration | null;
  dirty: boolean;
  syncing: boolean;
  syncError: string | null;
  syncConflict: boolean;
  lastSyncedAt: number | null;
  load: (accountId?: string, defaultName?: string) => Promise<void>;
  sync: (force?: boolean) => Promise<void>;
  pullCloud: () => Promise<void>;
  refreshCache: () => Promise<void>;
  mutate: (mutation: Mutation) => Promise<void>;
  restore: (data: Workspace) => Promise<void>;
  notify: (message: string) => void;
};
export const useWorkspace = create<State>((set, get) => ({
  data: structuredClone(emptyWorkspace),
  accountId: null,
  loaded: false,
  error: null,
  toast: null,
  celebration: null,
  dirty: false,
  syncing: false,
  syncError: null,
  syncConflict: false,
  lastSyncedAt: null,
  notify: (message) => {
    set({ toast: message });
    setTimeout(() => {
      if (get().toast === message) set({ toast: null });
    }, 4000);
  },
  load: async (accountId, defaultName = "") => {
    const owner = isConnected ? accountId || get().accountId : null;
    if (isConnected && !owner) return;
    if (loading?.owner === owner) return loading.promise;
    if (owner !== get().accountId) {
      epoch++;
      set({
        data: structuredClone(emptyWorkspace),
        accountId: owner,
        loaded: false,
        error: null,
        syncError: null,
        syncConflict: false,
        dirty: false,
        syncing: false,
        lastSyncedAt: null,
        celebration: null,
      });
    }
    const version = epoch;
    const valid = () => version === epoch && get().accountId === owner;
    const run = (async () => {
      try {
        if (!owner) {
          await edit(owner, async () => {
            if (!valid()) return;
            const stored = await readWorkspaceStorage(browserWorkspaceKey);
            const data = stored
              ? parseWorkspaceBackup(stored)
              : structuredClone(emptyWorkspace);
            if (!data.profile.display_name)
              data.profile.display_name = defaultName;
            data.rewards = reconcileRewards(data);
            try {
              await writeWorkspaceStorage(
                browserWorkspaceKey,
                JSON.stringify(data),
              );
            } catch (error) {
              // A failed metadata refresh must not hide an existing local backup.
              if (!stored) throw error;
              if (valid()) {
                set({ data, loaded: true, error: null });
                get().notify(
                  error instanceof Error
                    ? error.message
                    : "Could not save locally.",
                );
              }
              return;
            }
            if (valid()) set({ data, loaded: true, error: null });
          });
          return;
        }
        let cache = await readAccountCache(owner);
        if (!cache) {
          let workspace = structuredClone(emptyWorkspace);
          workspace.profile.display_name = defaultName;
          let revision: string | null = null;
          let baseKnown = false;
          let syncError: string | null = null;
          try {
            const cloud = await cloudWorkspace();
            workspace = cloud.workspace;
            revision = cloud.revision;
            baseKnown = true;
            syncError = "warning" in cloud ? cloud.warning || null : null;
          } catch (error) {
            syncError =
              error instanceof Error
                ? error.message
                : "Cloud sync is unavailable. You can keep working locally.";
          }
          if (!valid()) return;
          const namedLocally = !workspace.profile.display_name && !!defaultName;
          if (namedLocally) workspace.profile.display_name = defaultName;
          workspace.rewards = reconcileRewards(workspace);
          cache = {
            version: 2,
            owner,
            workspace,
            revision,
            editId: createId(),
            dirty: baseKnown && (revision === null || namedLocally),
            baseKnown,
            lastSyncedAt: baseKnown ? Date.now() : 0,
            lastAttemptAt: Date.now(),
          };
          // A second tab may have initialized or edited while the network request ran.
          await edit(owner, async () => {
            if (!valid()) return;
            cache = (await readAccountCache(owner)) || cache;
            await writeAccountCache(cache!);
            if (valid()) set({ ...cachedState(cache!), syncError });
          });
        } else if (valid()) {
          if (!cache.workspace.profile.display_name && defaultName) {
            await edit(owner, async () => {
              if (!valid()) return;
              const latest = (await readAccountCache(owner))!;
              if (!latest.workspace.profile.display_name) {
                latest.workspace.profile.display_name = defaultName;
                latest.dirty = true;
                latest.editId = createId();
                await writeAccountCache(latest);
              }
              if (valid()) set(cachedState(latest));
            });
          } else set(cachedState(cache));
          void get().sync(false);
        }
      } catch (error) {
        if (valid())
          set({
            loaded: true,
            error:
              error instanceof Error
                ? error.message
                : "Could not load local workspace.",
          });
      }
    })();
    loading = { owner, promise: run };
    try {
      await run;
    } finally {
      if (loading?.promise === run) loading = null;
    }
  },
  refreshCache: async () => {
    const version = epoch;
    const owner = get().accountId;
    if (!owner) return;
    try {
      await edit(owner, async () => {
        const cache = await readAccountCache(owner);
        if (cache && version === epoch && get().accountId === owner)
          set(cachedState(cache));
      });
    } catch (error) {
      if (version === epoch && get().accountId === owner)
        set({
          syncError:
            error instanceof Error
              ? error.message
              : "Could not read local changes.",
        });
    }
  },
  sync: async (force = true) => {
    const owner = get().accountId;
    if (!isConnected || !owner || !get().loaded) return;
    const version = epoch;
    const valid = () => version === epoch && get().accountId === owner;
    if (!force) {
      try {
        const cached = await readAccountCache(owner);
        if (!cached || !syncDue(cached)) return;
      } catch (error) {
        if (valid())
          set({
            syncError:
              error instanceof Error
                ? error.message
                : "Could not read the local workspace.",
          });
        return;
      }
    }
    if (!valid()) return;
    if (syncing?.owner === owner) return syncing.promise;
    if (
      !force &&
      (get().syncConflict ||
        (typeof navigator !== "undefined" && navigator.onLine === false))
    )
      return;
    const run = withLock(`progressly-sync:${owner}`, async () => {
      let source = await readAccountCache(owner);
      if (!source || (!force && !syncDue(source))) return;
      if (!valid()) return;
      set({ syncing: true, syncError: null });
      try {
        await edit(owner, async () => {
          source = (await readAccountCache(owner))!;
          source.lastAttemptAt = Date.now();
          await writeAccountCache(source);
        });
        if (!source) return;
        // Reconcile an upload whose response was lost before sending any newer edits.
        if (source.pendingUpload) {
          const remote = await request("/api/workspace/sync");
          if (!valid()) return;
          if (remote.revision === source.pendingUpload.id) {
            await edit(owner, async () => {
              const latest = (await readAccountCache(owner))!;
              latest.revision = remote.revision;
              latest.baseKnown = true;
              latest.lastSyncedAt = Date.now();
              latest.dirty = latest.editId !== source!.pendingUpload!.editId;
              delete latest.pendingUpload;
              await writeAccountCache(latest);
              source = latest;
              if (valid()) set(cachedState(latest));
            });
            if (!source.dirty) return;
          } else if (remote.revision !== source.revision) {
            throw Object.assign(
              new Error(
                "Another device has newer cloud data. Export your local backup before loading the cloud version.",
              ),
              { conflict: true },
            );
          }
        }
        if (!source.baseKnown) {
          const remote = await cloudWorkspace();
          if (!valid()) return;
          if (source.dirty)
            throw Object.assign(
              new Error(
                "Cloud data was unavailable when this local workspace was created. Export a local backup before loading the cloud version to avoid replacing existing data.",
              ),
              { conflict: true },
            );
          await edit(owner, async () => {
            const latest = (await readAccountCache(owner))!;
            if (latest.editId !== source!.editId)
              throw Object.assign(
                new Error(
                  "Local changes were made while cloud data was loading. Export a backup before loading the cloud version.",
                ),
                { conflict: true },
              );
            const next = {
              ...latest,
              workspace: remote.workspace,
              revision: remote.revision,
              baseKnown: true,
              dirty: remote.revision === null,
              lastSyncedAt: Date.now(),
            };
            await writeAccountCache(next);
            source = next;
            if (valid()) set(cachedState(next));
          });
        }
        if (!source.dirty) {
          const remote = await request("/api/workspace/sync");
          if (!valid()) return;
          await edit(owner, async () => {
            const latest = (await readAccountCache(owner))!;
            // Edits made during a download are never replaced by that download.
            if (latest.editId !== source!.editId || latest.dirty) return;
            if (remote.workspace) {
              latest.workspace = parseWorkspaceBackup(
                JSON.stringify(remote.workspace),
              );
              latest.revision = remote.revision;
            } else if (latest.revision)
              throw Object.assign(
                new Error(
                  "The cloud snapshot was removed. Your local copy is safe; export a backup before resetting cloud sync.",
                ),
                { conflict: true },
              );
            latest.lastSyncedAt = Date.now();
            await writeAccountCache(latest);
            if (valid()) set({ ...cachedState(latest), syncConflict: false });
          });
          return;
        }
        const upload = {
          id:
            source.pendingUpload?.editId === source.editId
              ? source.pendingUpload.id
              : createId(),
          editId: source.editId,
        };
        const sent = source;
        await edit(owner, async () => {
          const latest = (await readAccountCache(owner))!;
          latest.pendingUpload = upload;
          await writeAccountCache(latest);
        });
        const result = await request("/api/workspace/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace: sent.workspace,
            revision: sent.revision,
            requestId: upload.id,
          }),
        });
        if (!valid()) return;
        await edit(owner, async () => {
          const latest = (await readAccountCache(owner))!;
          latest.revision = result.revision;
          latest.lastSyncedAt = Date.now();
          latest.baseKnown = true;
          latest.dirty = latest.editId !== upload.editId;
          delete latest.pendingUpload;
          await writeAccountCache(latest);
          if (valid())
            set({
              ...cachedState(latest),
              syncConflict: false,
              syncError: null,
            });
        });
      } catch (error) {
        if (valid())
          set({
            syncError:
              error instanceof Error
                ? error.message
                : "Sync failed. Your local changes are saved.",
            syncConflict: !!(error as { conflict?: boolean }).conflict,
          });
      } finally {
        if (valid()) set({ syncing: false });
      }
    });
    syncing = { owner, promise: run };
    try {
      await run;
    } catch (error) {
      if (valid())
        set({
          syncing: false,
          syncError:
            error instanceof Error
              ? error.message
              : "Cloud sync is unavailable. Your local changes are saved.",
        });
    } finally {
      if (syncing?.promise === run) syncing = null;
    }
  },
  pullCloud: async () => {
    const owner = get().accountId;
    if (!owner || get().syncing) return;
    const version = epoch;
    set({ syncing: true });
    try {
      await edit(owner, async () => {
        const remote = await cloudWorkspace();
        if (version !== epoch || get().accountId !== owner) return;
        const next: CachedWorkspace = {
          version: 2,
          owner,
          workspace: remote.workspace,
          revision: remote.revision,
          editId: createId(),
          dirty: remote.revision === null,
          baseKnown: true,
          lastSyncedAt: Date.now(),
          lastAttemptAt: Date.now(),
        };
        await writeAccountCache(next);
        if (version !== epoch || get().accountId !== owner) return;
        set({
          ...cachedState(next),
          syncError: null,
          syncConflict: false,
          celebration: null,
        });
      });
    } catch (error) {
      if (version === epoch)
        set({
          syncError:
            error instanceof Error
              ? error.message
              : "Could not load cloud version.",
        });
    } finally {
      if (version === epoch) set({ syncing: false });
    }
  },
  restore: async (data) => {
    const validated = parseWorkspaceBackup(JSON.stringify(data));
    const owner = get().accountId;
    const version = epoch;
    const valid = () => version === epoch && get().accountId === owner;
    if (isConnected && !owner)
      throw new Error(
        "Wait for your signed-in workspace to load before restoring.",
      );
    await edit(owner, async () => {
      if (!valid())
        throw new Error("Your signed-in account changed. Please try again.");
      validated.rewards = reconcileRewards(validated);
      if (owner) {
        const cache = await readAccountCache(owner);
        if (!cache)
          throw new Error("Load your workspace before restoring a backup.");
        const next = {
          ...cache,
          workspace: validated,
          editId: createId(),
          dirty: true,
        };
        await writeAccountCache(next);
        if (valid()) set({ ...cachedState(next), celebration: null });
      } else {
        await writeWorkspaceStorage(
          browserWorkspaceKey,
          JSON.stringify(validated),
        );
        if (valid())
          set({
            data: validated,
            loaded: true,
            error: null,
            celebration: null,
          });
      }
    });
  },
  mutate: async (input) => {
    const parsed = mutationSchema.parse(input);
    const owner = get().accountId;
    const version = epoch;
    const valid = () => version === epoch && get().accountId === owner;
    if (isConnected && !owner)
      throw new Error(
        "Wait for your signed-in workspace to load before editing.",
      );
    try {
      let refresh: Awaited<ReturnType<typeof request>> | null = null;
      if (parsed.op === "refresh_course") {
        const course = get().data.courses.find(
          (course) => course.id === parsed.id,
        );
        if (!course?.youtube_playlist_id)
          throw new Error("Only imported playlists can be refreshed.");
        refresh = await request("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: course.youtube_playlist_id }),
        });
      }
      await edit(owner, async () => {
        if (!valid())
          throw new Error("Your signed-in account changed. Please try again.");
        const cache = owner ? await readAccountCache(owner) : null;
        if (owner && !cache)
          throw new Error("Load your workspace before editing.");
        const before = cache?.workspace || get().data;
        let data: Workspace;
        if (parsed.op === "refresh_course") {
          data = structuredClone(before);
          const course = data.courses.find(
            (course) => course.id === parsed.id,
          )!;
          const { videos } = courseSchema.parse(refresh);
          course.videos.forEach((video) => {
            video.availability_status = "unavailable";
          });
          for (const metadata of videos) {
            const existing = course.videos.find(
              (video) => video.youtube_video_id === metadata.youtube_video_id,
            );
            if (existing) Object.assign(existing, metadata);
            else
              course.videos.push({
                ...metadata,
                id: createId(),
                progress: structuredClone(emptyProgress),
                notes: [],
                tasks: [],
                bookmarks: [],
              });
          }
          course.videos.sort((a, b) => a.position - b.position);
          course.updated_at = new Date().toISOString();
          if (!["archived", "paused"].includes(course.status)) {
            const available = course.videos.filter(
              (video) => video.availability_status === "available",
            );
            course.status =
              available.length &&
              available.every((video) => video.progress.is_completed)
                ? "completed"
                : "in_progress";
            course.completed_at =
              course.status === "completed"
                ? course.completed_at || new Date().toISOString()
                : null;
          }
          data = applyMutation(data, {
            op: "update_course",
            id: course.id,
            patch: {},
          });
        } else data = applyMutation(before, parsed);
        if (owner && cache) {
          const next = {
            ...cache,
            workspace: data,
            editId: createId(),
            dirty: true,
          };
          await writeAccountCache(next);
          if (valid())
            set({
              ...cachedState(next),
              celebration: earnedCelebration(before, data),
            });
        } else {
          await writeWorkspaceStorage(
            browserWorkspaceKey,
            JSON.stringify(data),
          );
          if (valid())
            set({ data, celebration: earnedCelebration(before, data) });
        }
      });
      if (valid()) void get().sync(false);
    } catch (error) {
      if (valid())
        get().notify(
          error instanceof Error
            ? error.message
            : "Could not save your change locally.",
        );
      throw error;
    }
  },
}));

export function resetWorkspaceSession() {
  epoch++;
  useWorkspace.setState({
    data: structuredClone(emptyWorkspace),
    accountId: null,
    loaded: false,
    error: null,
    toast: null,
    celebration: null,
    dirty: false,
    syncing: false,
    syncError: null,
    syncConflict: false,
    lastSyncedAt: null,
  });
}
export function currentWorkspaceCacheKey() {
  const owner = useWorkspace.getState().accountId;
  return owner ? accountWorkspaceKey(owner) : browserWorkspaceKey;
}
