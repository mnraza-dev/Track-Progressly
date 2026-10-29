import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/youtube/route";
import { importYouTube, YouTubeError } from "@/lib/youtube/service";
import { authenticatedWorkspace } from "@/lib/supabase/workspace";
import { auth } from "@clerk/nextjs/server";

vi.mock("@/lib/youtube/service", async (original) => ({
  ...(await original<typeof import("@/lib/youtube/service")>()),
  importYouTube: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/workspace", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/workspace")>()),
  authenticatedWorkspace: vi.fn(),
}));

const preview = {
  title: "A public lesson",
  description: "",
  channel_name: "Example channel",
  thumbnail_url: "",
  youtube_playlist_id: null,
  videos: [
    {
      youtube_video_id: "j942wKiXFu8",
      title: "A public lesson",
      description: "",
      thumbnail_url: "",
      duration_seconds: 600,
      position: 0,
      availability_status: "available" as const,
    },
  ],
};
let sequence = 0;
let clientIp: string;
function request(
  input: unknown = "j942wKiXFu8",
  origin = "https://progressly.example",
) {
  return new Request("https://progressly.example/api/youtube", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": clientIp,
      origin,
    },
    body: JSON.stringify({ input }),
  });
}
function cloud(user: { id: string } | null, allowed = true) {
  const rpc = vi.fn().mockResolvedValue({ data: allowed, error: null });
  vi.mocked(auth).mockResolvedValue({ userId: user?.id ?? null } as Awaited<
    ReturnType<typeof auth>
  >);
  vi.mocked(authenticatedWorkspace).mockResolvedValue({
    user,
    db: { rpc },
  } as unknown as Awaited<ReturnType<typeof authenticatedWorkspace>>);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  return rpc;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "user_test" } as Awaited<
    ReturnType<typeof auth>
  >);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  clientIp = `198.51.100.${++sequence}`;
  vi.mocked(importYouTube).mockResolvedValue(preview);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("deployed YouTube imports", () => {
  it("imports in production without Supabase and keeps metadata private", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(preview);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(importYouTube).toHaveBeenCalledWith("j942wKiXFu8");
    expect(authenticatedWorkspace).not.toHaveBeenCalled();
  });

  it.each([
    ["https://example.supabase.co", ""],
    ["", "test-publishable-key"],
  ])(
    "uses browser mode with incomplete cloud configuration (%s, %s)",
    async (url, key) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
      expect((await POST(request())).status).toBe(200);
      expect(authenticatedWorkspace).not.toHaveBeenCalled();
    },
  );

  it("reports missing YouTube configuration without requiring Supabase", async () => {
    vi.mocked(importYouTube).mockRejectedValue(
      new YouTubeError("YouTube import isn’t connected yet.", 503),
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "YouTube import isn’t connected yet.",
    });
  });

  it("limits browser workspace imports per client and permits retries after a minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
    for (let i = 0; i < 10; i++)
      expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(429);
    expect(importYouTube).toHaveBeenCalledTimes(10);
    vi.advanceTimersByTime(60_000);
    expect((await POST(request())).status).toBe(200);
  });

  it("requires sign-in when cloud mode is configured", async () => {
    cloud(null);
    expect((await POST(request())).status).toBe(401);
    expect(importYouTube).not.toHaveBeenCalled();
  });

  it("uses the account quota for signed-in imports", async () => {
    const rpc = cloud({ id: "test-user" });
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_import_quota");
  });

  it("blocks imports when the account quota is exhausted", async () => {
    cloud({ id: "test-user" }, false);
    expect((await POST(request())).status).toBe(429);
    expect(importYouTube).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before importing", async () => {
    expect(
      (await POST(request("j942wKiXFu8", "https://another.example"))).status,
    ).toBe(403);
    expect(importYouTube).not.toHaveBeenCalled();
  });

  it("imports through a reverse proxy with a public host and an internal request URL", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": clientIp,
          "x-forwarded-host": "progressly.example",
          host: "localhost:3000",
          origin: "https://progressly.example",
        },
        body: JSON.stringify({ input: "j942wKiXFu8" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(importYouTube).toHaveBeenCalledWith("j942wKiXFu8");
  });

  it("rejects invalid import input", async () => {
    expect((await POST(request(123))).status).toBe(400);
    expect(importYouTube).not.toHaveBeenCalled();
  });
});
