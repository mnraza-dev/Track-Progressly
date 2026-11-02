import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTelegram } from "@/lib/telegram/parse";
import { parseTelegramPage, importTelegramPage } from "@/lib/telegram/service";
import { importTelegramChannel } from "@/lib/telegram/client";
import { courseSchema } from "@/lib/validations";
import { applyMutation } from "@/features/courses/local-reducer";
import { emptyWorkspace } from "@/types";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import { lessonKey, lessonUrl } from "@/lib/media";
import { createExport } from "@/lib/exports";

const channel = "telusko_courses";
function post(id: number, body: string, name = channel) {
  return `<div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="${name}/${id}">${body}</div>`;
}
const header = `<div class="tgme_channel_info"><div class="tgme_channel_info_header_title"><span>Learning &amp; courses</span></div><div class="tgme_channel_info_description">A channel<br>for lessons</div></div>`;
const page = (posts: string, before?: number) =>
  header +
  posts +
  (before
    ? `<a href="/s/${channel}?before=${before}" class="tme_messages_more js-messages_more" data-before="${before}">More</a>`
    : "");
const video = (id: number) =>
  post(
    id,
    `<a class="tgme_widget_message_video_player"><video></video></a><span class="tgme_widget_message_video_duration">1:02:03</span><div class="tgme_widget_message_text js-message_text">Lesson ${id} &lt;idea&gt;<br>Details &#128640;</div>`,
  );
const first = parseTelegramPage(page(video(30), 20), channel);
const last = parseTelegramPage(page(video(10)), channel, "20");
const courseInput = () =>
  courseSchema.parse({
    ...first,
    videos: [...last.videos, ...first.videos],
    category: "Development",
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("public Telegram channels", () => {
  it.each([
    channel,
    `@${channel}`,
    `https://t.me/${channel}`,
    `https://t.me/s/${channel}`,
    `t.me/${channel}`,
  ])("parses %s", (input) => expect(parseTelegram(input)).toBe(channel));
  it.each([
    "https://t.me.evil.test/x",
    "https://evil.test",
    "https://t.me/+invite",
    "https://t.me/c/123/456",
    "https://t.me/telusko_courses/123",
    "https://t.me/telusko_courses/extra",
    "http://t.me/telusko_courses",
    "javascript:alert(1)",
    "https://t.me:4430/telusko_courses",
    "../telegram",
    "https://user@t.me/telusko_courses",
  ])("rejects %s", (input) => expect(() => parseTelegram(input)).toThrow());
  it("extracts safe video metadata, video documents and older-page cursors", () => {
    const html = page(
      video(30) +
        video(30) +
        post(
          21,
          `<div class="tgme_widget_message_document_title">02. Variables.mp4</div>`,
        ) +
        post(
          22,
          `<div class="tgme_widget_message_document_title">Notes.pdf</div>`,
        ) +
        post(
          23,
          `<div class="tgme_widget_message_text">A text announcement</div>`,
        ) +
        post(
          24,
          `<div class="tgme_widget_message_video_thumb"></div>`,
          "another_channel",
        ),
      20,
    );
    const parsed = parseTelegramPage(html, channel);
    expect(parsed.title).toBe("Learning & courses");
    expect(parsed.description).toBe("A channel\nfor lessons");
    expect(parsed.next_before).toBe("20");
    expect(parsed.videos.map((v) => v.telegram_post)).toEqual([
      `${channel}/21`,
      `${channel}/30`,
    ]);
    expect(parsed.videos[1]).toMatchObject({
      title: "Lesson 30 <idea>",
      description: "Lesson 30 <idea>\nDetails 🚀",
      duration_seconds: 3723,
      youtube_video_id: "",
      source: "telegram",
    });
    expect(JSON.stringify(parsed)).not.toContain("<video>");
  });
  it("does not mistake links inside captions for history pagination", () => {
    const html = page(
      video(30) +
        post(
          31,
          `<div class="tgme_widget_message_text"><a href="/s/${channel}?before=1">Old post</a></div>`,
        ),
      20,
    );
    expect(parseTelegramPage(html, channel).next_before).toBe("20");
  });
  it("reports repeated upstream pagination rather than silently ending history", () => {
    expect(() => parseTelegramPage(page(video(30), 20), channel, "20")).toThrow(
      "repeated history cursor",
    );
  });
  it("rejects missing web previews instead of silently importing an empty course", () => {
    expect(() =>
      parseTelegramPage("<html>Join Telegram</html>", channel),
    ).toThrow("no public web preview");
  });
  it("fetches a fixed origin without following redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(page(video(10))));
    const result = await importTelegramPage(
      "@safe_channel",
      undefined,
      fetcher,
    );
    expect(result.videos).toEqual([]); // foreign-channel posts are ignored
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://t.me/s/safe_channel",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });
  it("reports upstream rate limits and network failures", async () => {
    await expect(
      importTelegramPage(
        "rate_channel",
        undefined,
        vi.fn().mockResolvedValue(new Response("", { status: 429 })),
      ),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      importTelegramPage(
        "offline_channel",
        undefined,
        vi.fn().mockRejectedValue(new Error("offline")),
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("bounds streamed upstream response sizes", async () => {
    await expect(
      importTelegramPage(
        "large_channel",
        undefined,
        vi.fn().mockResolvedValue(new Response("x".repeat(4_000_001))),
      ),
    ).rejects.toThrow("too large");
  });
});

describe("automatic channel discovery", () => {
  it("waits for rate limits and continues automatically without losing progress", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: "Wait" },
          { status: 429, headers: { "Retry-After": "1" } },
        ),
      )
      .mockResolvedValueOnce(Response.json(last));
    vi.stubGlobal("fetch", fetcher);
    const progress = vi.fn();
    const importing = importTelegramChannel(channel, { onProgress: progress });
    await vi.advanceTimersByTimeAsync(1000);
    expect((await importing).videos).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(progress.mock.calls[0][2]).toContain("Retrying in 1 seconds");
  });
  it("can cancel while waiting for Telegram to permit more requests", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ error: "Wait" }, { status: 429 })),
    );
    await expect(
      importTelegramChannel(channel, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("follows all pages, deduplicates posts and orders lessons oldest first", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(first))
      .mockResolvedValueOnce(Response.json(last));
    vi.stubGlobal("fetch", fetcher);
    const progress = vi.fn();
    const result = await importTelegramChannel(channel, {
      onProgress: progress,
    });
    expect(result.videos.map((v) => v.telegram_post)).toEqual([
      `${channel}/10`,
      `${channel}/30`,
    ]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      input: channel,
      before: "20",
    });
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });
  it("rejects a repeated history cursor instead of looping or returning a partial course", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(Response.json(first))),
    );
    await expect(importTelegramChannel(channel)).rejects.toThrow(
      "repeated history page",
    );
  });
  it("fails the full import if an older page cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(first))
        .mockResolvedValueOnce(
          Response.json({ error: "Unavailable" }, { status: 502 }),
        ),
    );
    await expect(importTelegramChannel(channel)).rejects.toThrow("Unavailable");
  });
  it("reports channels with no publicly discoverable videos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ...last, videos: [] })),
    );
    await expect(importTelegramChannel(channel)).rejects.toThrow(
      "No video posts",
    );
  });
  it("propagates cancellation to the page request", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
          controller.abort();
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      importTelegramChannel(channel, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("Telegram lesson persistence", () => {
  it("round trips metadata, completion and notes through a workspace backup", () => {
    let workspace = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: courseInput(),
    });
    const lesson = workspace.courses[0].videos[0];
    workspace = applyMutation(workspace, {
      op: "progress",
      video_id: lesson.id,
      status: "completed",
      active_seconds: 0,
    });
    workspace = applyMutation(workspace, {
      op: "save_note",
      video_id: lesson.id,
      id: crypto.randomUUID(),
      content: "An idea",
      timestamp_seconds: 0,
      is_revision_required: false,
    });
    const restored = parseWorkspaceBackup(JSON.stringify(workspace));
    expect(restored).toEqual(workspace);
    expect(restored.courses[0].telegram_channel).toBe(channel);
    expect(restored.courses[0].videos[0].progress.watched_seconds).toBe(0);
    expect(lessonKey(lesson)).toBe(`telegram:${channel}/10`);
    expect(lessonUrl(lesson, 30)).toBe(`https://t.me/${channel}/10`);
    expect(() =>
      applyMutation(workspace, { op: "create_course", course: courseInput() }),
    ).toThrow("already in your library");
  });
  it("rejects unsafe and inconsistent provider records", () => {
    const input = courseInput();
    expect(
      courseSchema.safeParse({
        ...input,
        videos: [{ ...input.videos[0], telegram_post: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({
        ...input,
        videos: [{ ...input.videos[0], youtube_video_id: "j942wKiXFu8" }],
      }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({
        ...input,
        videos: [{ ...input.videos[0], source: undefined }],
      }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({
        ...input,
        videos: [{ ...input.videos[0], telegram_post: "another_channel/10" }],
      }).success,
    ).toBe(false);
  });
  it("exports original Telegram links instead of broken YouTube links", () => {
    const workspace = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: courseInput(),
    });
    const csv = createExport(workspace, "progress", "all");
    expect(csv.content).toContain(`https://t.me/${channel}/10`);
    expect(csv.content).not.toContain("youtube.com");
  });
});
