import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/telegram/route";
import { auth } from "@clerk/nextjs/server";
import { importTelegramPage } from "@/lib/telegram/service";
import { TelegramError } from "@/lib/telegram/parse";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/telegram/service", () => ({ importTelegramPage: vi.fn() }));
let sequence = 0;
function request(
  body: unknown = { input: "telusko_courses" },
  origin = "https://progressly.example",
) {
  return new Request("https://progressly.example/api/telegram", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: `user_${++sequence}` } as Awaited<
    ReturnType<typeof auth>
  >);
  vi.mocked(importTelegramPage).mockResolvedValue({
    title: "Course",
    channel_name: "telusko_courses",
    telegram_channel: "telusko_courses",
    description: "",
    thumbnail_url: "",
    youtube_playlist_id: null,
    videos: [],
    next_before: "10",
  });
});
afterEach(() => vi.useRealTimers());
describe("Telegram channel API", () => {
  it("requires sign-in before any upstream fetch", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);
    expect((await POST(request())).status).toBe(401);
    expect(importTelegramPage).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before authentication", async () => {
    expect((await POST(request(undefined, "https://evil.test"))).status).toBe(
      403,
    );
    expect(auth).not.toHaveBeenCalled();
  });
  it("forwards page cursors and disables response caching", async () => {
    const response = await POST(
      request({ input: "telusko_courses", before: "20" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(importTelegramPage).toHaveBeenCalledWith("telusko_courses", "20");
    expect((await response.json()).next_before).toBe("10");
  });
  it.each([
    { input: 123 },
    { input: "telusko_courses", before: "../../etc" },
    { input: "telusko_courses", before: "0" },
  ])("rejects invalid input %j", async (input) => {
    expect((await POST(request(input))).status).toBe(400);
    expect(importTelegramPage).not.toHaveBeenCalled();
  });
  it("bounds request body size", async () => {
    expect((await POST(request({ input: "x".repeat(3000) }))).status).toBe(413);
    expect(importTelegramPage).not.toHaveBeenCalled();
  });
  it("preserves actionable upstream errors", async () => {
    vi.mocked(importTelegramPage).mockRejectedValue(
      new TelegramError("No public preview", 422),
    );
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "No public preview" });
  });
  it("rate limits by authenticated account and permits later retries", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 300; i++)
      expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(429);
    vi.advanceTimersByTime(60000);
    expect((await POST(request())).status).toBe(200);
  });
});
