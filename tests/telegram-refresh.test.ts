import { afterEach, expect, it, vi } from "vitest";
import { useWorkspace, resetWorkspaceSession } from "@/stores/workspace";
import { courseSchema } from "@/lib/validations";
vi.mock("@/lib/supabase/client", () => ({ isConnected: false }));
afterEach(() => {
  resetWorkspaceSession();
  vi.unstubAllGlobals();
});
it("refreshes channel posts without duplicate lessons, lost notes, or unavailable old posts", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  await useWorkspace.getState().load();
  const video = (id: number, title = `Lesson ${id}`) => ({
    source: "telegram" as const,
    telegram_post: `telusko_courses/${id}`,
    youtube_video_id: "",
    title,
    description: "",
    thumbnail_url: "",
    duration_seconds: 0,
    position: id,
    availability_status: "available" as const,
  });
  const course = courseSchema.parse({
    title: "Channel",
    telegram_channel: "telusko_courses",
    videos: [video(10), video(20)],
  });
  await useWorkspace.getState().mutate({ op: "create_course", course });
  const added = useWorkspace.getState().data.courses[0];
  const lesson = added.videos[0];
  await useWorkspace
    .getState()
    .mutate({
      op: "progress",
      video_id: lesson.id,
      status: "completed",
      active_seconds: 0,
    });
  await useWorkspace
    .getState()
    .mutate({
      op: "save_note",
      video_id: lesson.id,
      id: crypto.randomUUID(),
      content: "Keep this note",
      timestamp_seconds: 0,
      is_revision_required: false,
    });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            ...course,
            videos: [video(10, "Updated lesson"), video(30)],
            next_before: null,
          }),
        ),
      ),
  );
  await useWorkspace.getState().mutate({ op: "refresh_course", id: added.id });
  const refreshed = useWorkspace.getState().data.courses[0];
  expect(refreshed.videos.map((v) => v.telegram_post)).toEqual([
    "telusko_courses/10",
    "telusko_courses/20",
    "telusko_courses/30",
  ]);
  expect(refreshed.videos[0]).toMatchObject({
    id: lesson.id,
    title: "Updated lesson",
    progress: { is_completed: true },
    notes: [{ content: "Keep this note" }],
  });
  expect(refreshed.videos[1].availability_status).toBe("available");
  await useWorkspace.getState().mutate({ op: "refresh_course", id: added.id });
  expect(useWorkspace.getState().data.courses[0].videos).toHaveLength(3);
});
