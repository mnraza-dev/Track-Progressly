import { describe, it, expect, vi, afterEach } from "vitest";
import { parseYouTube, parseDuration } from "@/lib/youtube/parse";
import { completion, streak, localDay } from "@/lib/utils";
import { applyMutation } from "@/features/courses/local-reducer";
import { emptyWorkspace } from "@/types";
import { mutationSchema } from "@/lib/validations";
import { importYouTube } from "@/lib/youtube/service";
const video = "j942wKiXFu8";
const playlist = "PLlearntrack123456";
const input = {
  title: "My course",
  description: "",
  category: "Development",
  channel_name: "",
  thumbnail_url: "",
  youtube_playlist_id: null,
  target_completion_date: null,
  videos: [
    {
      youtube_video_id: video,
      title: "My lesson",
      description: "",
      thumbnail_url: "",
      duration_seconds: 60,
      position: 0,
      availability_status: "available" as const,
    },
  ],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("YouTube URL parsing", () => {
  it.each([
    video,
    `https://youtu.be/${video}`,
    `https://youtube.com/shorts/${video}`,
  ])("parses %s", (value) =>
    expect(parseYouTube(value)).toEqual({ type: "video", id: video }),
  );
  it("parses video URLs with timestamp parameters", () => {
    expect(
      parseYouTube(`https://www.youtube.com/watch?v=${video}&t=18`),
    ).toEqual({
      type: "video",
      id: video,
      startSeconds: 18,
    });
    expect(parseYouTube(`https://youtu.be/${video}?t=2m15s`)).toEqual({
      type: "video",
      id: video,
      startSeconds: 135,
    });
    expect(
      parseYouTube(`https://www.youtube.com/watch?v=${video}&t=1h2m30s`),
    ).toEqual({
      type: "video",
      id: video,
      startSeconds: 3750,
    });
  });
  it("prefers playlist IDs in a watch URL", () =>
    expect(
      parseYouTube(`https://youtube.com/watch?v=${video}&list=${playlist}`)
        .type,
    ).toBe("playlist"));
  it.each([
    "javascript:alert(1)",
    `https://youtube.com.evil.test/watch?v=${video}`,
    `https://example.com/watch?v=${video}`,
    "https://youtube.com/watch?v=bad",
    "file:///etc/passwd",
  ])("rejects unsafe or invalid input %s", (input) =>
    expect(() => parseYouTube(input)).toThrow(),
  );
  it("parses ISO durations", () => {
    expect(parseDuration("PT1H18M42S")).toBe(4722);
    expect(parseDuration("PT35S")).toBe(35);
  });
});
describe("Persistent workspace mutations", () => {
  it("never completes a lesson by opening or saving playback", () => {
    let state = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: input,
    });
    state = applyMutation(state, {
      op: "progress",
      video_id: state.courses[0].videos[0].id,
      position: 20,
      active_seconds: 15,
    });
    expect(completion(state.courses[0])).toBe(0);
    expect(state.courses[0].videos[0].progress.last_position_seconds).toBe(20);
    expect(state.activity[0].active_seconds).toBe(15);
  });
  it("completion and practice remain independent, including undo", () => {
    let state = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: input,
    });
    const id = state.courses[0].videos[0].id;
    state = applyMutation(state, {
      op: "progress",
      video_id: id,
      status: "completed",
      active_seconds: 0,
    });
    expect(completion(state.courses[0])).toBe(100);
    expect(state.courses[0].videos[0].tasks).toHaveLength(0);
    state = applyMutation(state, {
      op: "progress",
      video_id: id,
      status: "in_progress",
      active_seconds: 0,
    });
    expect(completion(state.courses[0])).toBe(0);
    expect(state.activity[0].videos_completed).toBe(0);
    expect(state.activity[0].courses_completed).toBe(0);
  });
  it("calculates progress for a single lesson course based on chapters", () => {
    const singleLessonCourse = {
      ...input,
      videos: [
        {
          ...input.videos[0],
          description:
            "0:00 Intro\n1:00 Step 1\n2:00 Step 2\n3:00 Step 3\n4:00 Finish",
          duration_seconds: 300,
        },
      ],
    };
    let state = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: singleLessonCourse,
    });
    const videoId = state.courses[0].videos[0].id;
    expect(completion(state.courses[0])).toBe(0);

    state = applyMutation(state, {
      op: "progress",
      video_id: videoId,
      position: 70,
      active_seconds: 70,
    });
    expect(completion(state.courses[0])).toBe(20);

    state = applyMutation(state, {
      op: "progress",
      video_id: videoId,
      position: 190,
      active_seconds: 120,
    });
    expect(completion(state.courses[0])).toBe(60);
  });
  it("upserts notes without losing content or making duplicates", () => {
    let state = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: input,
    });
    const note = {
      op: "save_note" as const,
      video_id: state.courses[0].videos[0].id,
      id: crypto.randomUUID(),
      content: "My **idea**",
      timestamp_seconds: 12,
      is_revision_required: false,
    };
    state = applyMutation(state, note);
    state = applyMutation(state, { ...note, content: "Updated note" });
    state = JSON.parse(JSON.stringify(state));
    expect(state.courses[0].videos[0].notes).toHaveLength(1);
    expect(state.courses[0].videos[0].notes[0].content).toBe("Updated note");
  });
  it("prevents duplicate single-video and playlist imports", () => {
    const state = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: input,
    });
    expect(() =>
      applyMutation(state, { op: "create_course", course: input }),
    ).toThrow(/already/);
    const course = { ...input, youtube_playlist_id: playlist };
    const playlists = applyMutation(emptyWorkspace, {
      op: "create_course",
      course,
    });
    expect(() =>
      applyMutation(playlists, { op: "create_course", course }),
    ).toThrow(/already/);
  });
  it("excludes unavailable videos from course progress", () => {
    const state = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: {
        ...input,
        videos: [
          ...input.videos,
          {
            ...input.videos[0],
            youtube_video_id: "dQw4w9WgXcQ",
            availability_status: "unavailable",
            position: 1,
          },
        ],
      },
    });
    state.courses[0].videos[0].progress.is_completed = true;
    expect(completion(state.courses[0])).toBe(100);
  });
  it("rejects excessive activity, missing ownership IDs, and invalid timezones", () => {
    expect(
      mutationSchema.safeParse({
        op: "progress",
        video_id: crypto.randomUUID(),
        active_seconds: 1000,
      }).success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({ op: "save_note", content: "test" }).success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        op: "profile",
        display_name: "Me",
        timezone: "bad",
        daily_minutes: 30,
        auto_complete: false,
      }).success,
    ).toBe(false);
  });
});
describe("Timezone streaks", () => {
  it("uses the selected timezone and tolerates an unfinished today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T19:00:00Z"));
    expect(localDay(new Date(), "Asia/Kolkata")).toBe("2026-10-15");
    expect(
      streak(
        [
          {
            day: "2026-10-14",
            active_seconds: 30,
            videos_completed: 0,
            practice_completed: 0,
            courses_completed: 0,
          },
          {
            day: "2026-10-13",
            active_seconds: 30,
            videos_completed: 0,
            practice_completed: 0,
            courses_completed: 0,
          },
        ],
        "Asia/Kolkata",
      ),
    ).toBe(2);
  });
  it("bridges weekends when weekend rest is enabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T10:00:00.000Z")); // Monday
    const activity = [
      {
        day: "2026-10-16", // Friday
        active_seconds: 60,
        videos_completed: 1,
        practice_completed: 0,
        courses_completed: 0,
      },
      {
        day: "2026-10-15", // Thursday
        active_seconds: 60,
        videos_completed: 1,
        practice_completed: 0,
        courses_completed: 0,
      },
    ];
    // Without weekend rest, streak is 0 because yesterday (Sunday) was missed
    expect(streak(activity, "UTC", false)).toBe(0);
    // With weekend rest enabled, streak bridges over Sat/Sun to Fri/Thu
    expect(streak(activity, "UTC", true)).toBe(2);
  });
});
describe("YouTube service", () => {
  it("paginates, preserves order, batches durations and marks unavailable videos", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test");
    const metadata = {
      id: playlist,
      snippet: { title: "Actual API title", channelTitle: "Actual channel" },
    };
    const item = (id: string, position: number) => ({
      id,
      snippet: {
        title: "Actual lesson",
        position,
        resourceId: { videoId: id },
      },
    });
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith("/playlists"))
        return Response.json({ items: [metadata] });
      if (parsed.pathname.endsWith("/playlistItems"))
        return Response.json(
          parsed.searchParams.has("pageToken")
            ? { items: [item("dQw4w9WgXcQ", 1)] }
            : { items: [item(video, 0)], nextPageToken: "page2" },
        );
      return Response.json({
        items: [
          {
            id: video,
            snippet: { title: "Available lesson" },
            contentDetails: { duration: "PT1M" },
            status: { embeddable: true },
          },
        ],
      });
    });
    const result = await importYouTube(playlist, fetcher as typeof fetch, true);
    expect(result.videos.map((v) => v.position)).toEqual([0, 1]);
    expect(result.videos[0].duration_seconds).toBe(60);
    expect(result.videos[1].availability_status).toBe("unavailable");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("returns an actionable quota error", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test");
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: { errors: [{ reason: "quotaExceeded" }] } },
        { status: 403 },
      ),
    );
    await expect(
      importYouTube(video, fetcher as typeof fetch, true),
    ).rejects.toMatchObject({ status: 429 });
  });
  it("does not invent metadata if no key is available", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    await expect(
      importYouTube("https://youtu.be/dQw4w9WgXcQ", fetch, true),
    ).rejects.toMatchObject({ status: 503 });
  });
});
