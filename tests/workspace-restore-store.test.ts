import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace, resetWorkspaceSession } from "@/stores/workspace";
import { emptyWorkspace } from "@/types";
import * as workspaceStorage from "@/lib/workspace-storage";
import {
  readAccountCache,
  writeAccountCache,
  accountWorkspaceKey,
  browserWorkspaceKey,
  SYNC_INTERVAL,
  type CachedWorkspace,
} from "@/lib/workspace-cache";
vi.mock("@/lib/supabase/client", () => ({ isConnected: true }));
const fetch = vi.fn();
const storage = new Map<string, string>();
const owner = "user_alice";
const revision = "11111111-1111-4111-8111-111111111111";
const nextRevision = "22222222-2222-4222-8222-222222222222";
async function seed(account = owner, overrides: Partial<CachedWorkspace> = {}) {
  await writeAccountCache({
    version: 2,
    owner: account,
    workspace: structuredClone(emptyWorkspace),
    revision,
    editId: "33333333-3333-4333-8333-333333333333",
    dirty: false,
    baseKnown: true,
    lastSyncedAt: Date.now(),
    lastAttemptAt: 0,
    ...overrides,
  });
}
const profile = (name: string) => ({
  op: "profile" as const,
  ...emptyWorkspace.profile,
  display_name: name,
});
function acceptUploads() {
  fetch.mockImplementation(async (_url: string, options: RequestInit) =>
    Response.json({
      revision: JSON.parse(options.body as string).requestId,
      syncedAt: new Date().toISOString(),
    }),
  );
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
  vi.resetAllMocks();
  storage.clear();
  resetWorkspaceSession();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  await seed();
  await useWorkspace.getState().load(owner);
  await useWorkspace.getState().sync(false);
  fetch.mockClear();
});
afterEach(() => {
  resetWorkspaceSession();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("local-first daily account sync", () => {
  it("saves many edits locally with no database calls", async () => {
    for (let i = 0; i < 25; i++)
      await useWorkspace.getState().mutate(profile(`Edit ${i}`));
    await useWorkspace.getState().sync(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Edit 24");
    expect(useWorkspace.getState().dirty).toBe(true);
  });
  it("uses the persisted account cache across reloads without reading the cloud", async () => {
    await useWorkspace.getState().mutate(profile("Saved locally"));
    resetWorkspaceSession();
    await useWorkspace.getState().load(owner);
    await useWorkspace.getState().load(owner);
    expect(useWorkspace.getState().data.profile.display_name).toBe(
      "Saved locally",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("restores a JSON backup locally and marks it for the next sync", async () => {
    const backup = structuredClone(emptyWorkspace);
    backup.profile.display_name = "Restored";
    await useWorkspace.getState().restore(backup);
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Restored");
    expect(useWorkspace.getState().dirty).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uploads one complete snapshot on Sync now and keeps the acknowledged revision", async () => {
    await useWorkspace.getState().mutate(profile("Upload"));
    acceptUploads();
    await Promise.all([
      useWorkspace.getState().sync(),
      useWorkspace.getState().sync(),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.workspace.profile.display_name).toBe("Upload");
    expect(body.revision).toBe(revision);
    expect((await readAccountCache(owner))?.revision).toBe(body.requestId);
    expect(useWorkspace.getState().dirty).toBe(false);
  });
  it("waits 24 hours for automatic sync and does not upload on every timer check", async () => {
    await useWorkspace.getState().mutate(profile("Daily"));
    acceptUploads();
    vi.setSystemTime(Date.now() + SYNC_INTERVAL - 1);
    await useWorkspace.getState().sync(false);
    expect(fetch).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 1);
    await useWorkspace.getState().sync(false);
    await useWorkspace.getState().sync(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("downloads newer cloud data once daily when there are no local changes", async () => {
    const remote = structuredClone(emptyWorkspace);
    remote.profile.display_name = "Other device";
    fetch.mockResolvedValueOnce(
      Response.json({ workspace: remote, revision: nextRevision }),
    );
    vi.setSystemTime(Date.now() + SYNC_INTERVAL);
    await useWorkspace.getState().sync(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
    expect(useWorkspace.getState().data.profile.display_name).toBe(
      "Other device",
    );
  });
  it("keeps unsynced changes on cloud conflict and stops automatic retries", async () => {
    await useWorkspace.getState().mutate(profile("Keep local"));
    fetch.mockResolvedValueOnce(
      Response.json({ error: "Other device is newer" }, { status: 409 }),
    );
    await useWorkspace.getState().sync();
    expect(useWorkspace.getState()).toMatchObject({
      dirty: true,
      syncConflict: true,
    });
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Keep local");
    vi.setSystemTime(Date.now() + SYNC_INTERVAL);
    await useWorkspace.getState().sync(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("backs off failed automatic syncs while retaining local changes", async () => {
    await useWorkspace.getState().mutate(profile("Offline"));
    vi.setSystemTime(Date.now() + SYNC_INTERVAL);
    fetch.mockRejectedValue(new Error("Network unavailable"));
    await useWorkspace.getState().sync(false);
    await useWorkspace.getState().sync(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useWorkspace.getState().dirty).toBe(true);
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Offline");
    expect((await readAccountCache(owner))?.pendingUpload).toBeDefined();
  });
  it("recovers a lost upload acknowledgement without writing the same snapshot again", async () => {
    await useWorkspace.getState().mutate(profile("Uploaded"));
    fetch.mockRejectedValueOnce(new Error("Lost response"));
    await useWorkspace.getState().sync();
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    fetch.mockResolvedValueOnce(
      Response.json({
        workspace: (await readAccountCache(owner))?.workspace,
        revision: sent.requestId,
      }),
    );
    await useWorkspace.getState().sync();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(useWorkspace.getState().dirty).toBe(false);
    expect((await readAccountCache(owner))?.pendingUpload).toBeUndefined();
  });
  it("retains edits made during an upload for a later sync", async () => {
    await useWorkspace.getState().mutate(profile("Sent version"));
    let finish!: (response: Response) => void;
    fetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const upload = useWorkspace.getState().sync();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    await useWorkspace.getState().mutate(profile("Newer local version"));
    finish(Response.json({ revision: sent.requestId }));
    await upload;
    expect(useWorkspace.getState().dirty).toBe(true);
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Newer local version");
    expect((await readAccountCache(owner))?.revision).toBe(sent.requestId);
  });
  it("does not apply a previous account's in-flight response after switching users", async () => {
    await useWorkspace.getState().mutate(profile("Alice"));
    let finish!: (response: Response) => void;
    fetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const upload = useWorkspace.getState().sync();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await seed("user_bob");
    await useWorkspace.getState().load("user_bob");
    finish(Response.json({ revision: nextRevision }));
    await upload;
    expect(useWorkspace.getState().accountId).toBe("user_bob");
    expect(useWorkspace.getState().data.profile.display_name).toBe("");
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Alice");
  });
  it("does not display a previous account's asynchronous save after switching users", async () => {
    await seed("user_bob");
    const write = workspaceStorage.writeWorkspaceStorage;
    let finish!: () => void;
    const paused = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const saved = vi
      .spyOn(workspaceStorage, "writeWorkspaceStorage")
      .mockImplementationOnce(async (key, value) => {
        await paused;
        await write(key, value);
      });
    const mutation = useWorkspace
      .getState()
      .mutate(profile("Alice's saved edit"));
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    await useWorkspace.getState().load("user_bob");
    finish();
    await mutation;
    expect(useWorkspace.getState().accountId).toBe("user_bob");
    expect(useWorkspace.getState().data.profile.display_name).toBe("");
    expect(
      (await readAccountCache(owner))?.workspace.profile.display_name,
    ).toBe("Alice's saved edit");
  });
  it("keeps accounts separate and never automatically imports an unscoped browser workspace", async () => {
    const local = structuredClone(emptyWorkspace);
    local.profile.display_name = "Private browser data";
    storage.set(browserWorkspaceKey, JSON.stringify(local));
    await seed("user_bob");
    await useWorkspace.getState().load("user_bob");
    expect(useWorkspace.getState().data.profile.display_name).toBe("");
    expect(storage.has(accountWorkspaceKey(owner))).toBe(true);
    expect(storage.has(accountWorkspaceKey("user_bob"))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("loads from cloud only when this account has no local cache", async () => {
    const remote = structuredClone(emptyWorkspace);
    remote.profile.display_name = "Cloud";
    fetch.mockResolvedValueOnce(
      Response.json({ workspace: remote, revision: nextRevision }),
    );
    await useWorkspace.getState().load("user_new");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useWorkspace.getState().data.profile.display_name).toBe("Cloud");
    await useWorkspace.getState().load("user_new");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("permits local work during an initial cloud outage without blindly overwriting the cloud later", async () => {
    fetch.mockRejectedValueOnce(new Error("Cloud offline"));
    await useWorkspace.getState().load("user_new");
    expect(useWorkspace.getState()).toMatchObject({
      loaded: true,
      error: null,
    });
    await useWorkspace.getState().mutate(profile("Unsynced new work"));
    fetch.mockResolvedValueOnce(
      Response.json({ workspace: emptyWorkspace, revision: nextRevision }),
    );
    await useWorkspace.getState().sync();
    expect(useWorkspace.getState().syncConflict).toBe(true);
    expect(useWorkspace.getState().data.profile.display_name).toBe(
      "Unsynced new work",
    );
    expect(fetch.mock.calls.every((call) => !call[1]?.method)).toBe(true);
  });
  it("does not replace local state when browser storage is full", async () => {
    const before = useWorkspace.getState().data;
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: () => {
        throw new Error("Storage full");
      },
    });
    await expect(
      useWorkspace.getState().mutate(profile("Not persisted")),
    ).rejects.toThrow("browser storage is full or unavailable");
    expect(useWorkspace.getState().data).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reads the newest local cache before editing so another tab's completed changes survive", async () => {
    const other = (await readAccountCache(owner))!;
    other.workspace.profile.timezone = "UTC";
    other.editId = nextRevision;
    other.dirty = true;
    await writeAccountCache(other);
    await useWorkspace.getState().mutate({
      op: "goal",
      id: nextRevision,
      goal_type: "daily_minutes",
      target_value: 45,
    });
    expect(useWorkspace.getState().data.profile.timezone).toBe("UTC");
    expect(useWorkspace.getState().data.goals[0].target_value).toBe(45);
  });
  it("keeps edits made after a lost response and uploads them against the recovered revision", async () => {
    await useWorkspace.getState().mutate(profile("First upload"));
    fetch.mockRejectedValueOnce(new Error("Lost acknowledgement"));
    await useWorkspace.getState().sync();
    const first = JSON.parse(fetch.mock.calls[0][1].body);
    await useWorkspace.getState().mutate(profile("More recent edit"));
    fetch.mockResolvedValueOnce(
      Response.json({ workspace: first.workspace, revision: first.requestId }),
    );
    fetch.mockImplementationOnce(async (_url: string, options: RequestInit) =>
      Response.json({ revision: JSON.parse(options.body as string).requestId }),
    );
    await useWorkspace.getState().sync();
    const second = JSON.parse(fetch.mock.calls[2][1].body);
    expect(second.workspace.profile.display_name).toBe("More recent edit");
    expect(second.revision).toBe(first.requestId);
    expect(second.requestId).not.toBe(first.requestId);
    expect(useWorkspace.getState().dirty).toBe(false);
  });
  it("refreshes playlist metadata locally while preserving lesson IDs and study work", async () => {
    await useWorkspace.getState().mutate({
      op: "create_course",
      course: {
        title: "Playlist",
        youtube_playlist_id: "PLexample123456789",
        description: "",
        category: "Development",
        channel_name: "",
        thumbnail_url: "",
        target_completion_date: null,
        videos: [
          {
            youtube_video_id: "j942wKiXFu8",
            title: "First lesson",
            description: "",
            thumbnail_url: "",
            duration_seconds: 60,
            position: 0,
            availability_status: "available",
          },
        ],
      },
    });
    const course = useWorkspace.getState().data.courses[0];
    const videoId = course.videos[0].id;
    await useWorkspace.getState().mutate({
      op: "save_note",
      id: nextRevision,
      video_id: videoId,
      content: "Keep these notes",
      timestamp_seconds: 0,
      is_revision_required: false,
    });
    await useWorkspace.getState().mutate({
      op: "progress",
      video_id: videoId,
      status: "completed",
      active_seconds: 0,
    });
    fetch.mockResolvedValueOnce(
      Response.json({
        title: "Playlist",
        youtube_playlist_id: course.youtube_playlist_id,
        videos: [
          {
            youtube_video_id: "j942wKiXFu8",
            title: "Updated title",
            duration_seconds: 120,
            position: 0,
          },
          {
            youtube_video_id: "Ke90Tje7VS0",
            title: "New lesson",
            duration_seconds: 60,
            position: 1,
          },
        ],
      }),
    );
    await useWorkspace
      .getState()
      .mutate({ op: "refresh_course", id: course.id });
    const updated = useWorkspace.getState().data.courses[0];
    expect(updated.status).toBe("in_progress");
    expect(updated.videos).toHaveLength(2);
    expect(updated.videos[0]).toMatchObject({
      id: videoId,
      title: "Updated title",
      progress: { is_completed: true },
    });
    expect(updated.videos[0].notes[0].content).toBe("Keep these notes");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/youtube");
    expect((await readAccountCache(owner))?.dirty).toBe(true);
  });
});
