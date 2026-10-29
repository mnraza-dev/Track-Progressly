import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/workspace/route";
import { currentUser } from "@clerk/nextjs/server";
vi.mock("@clerk/nextjs/server", () => ({ currentUser: vi.fn() }));
import {
  authenticatedWorkspace,
  WorkspaceAccessError,
} from "@/lib/supabase/workspace";

vi.mock("@/lib/supabase/workspace", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/workspace")>()),
  authenticatedWorkspace: vi.fn(),
}));
const account = "11111111-1111-4111-8111-111111111111";
const profile = {
  display_name: "Alice",
  timezone: "Asia/Kolkata",
  daily_minutes: 30,
  auto_complete: false,
  weekend_rest: false,
};
const rewards = { version: 1, events: {} };
const select = vi.fn();
const eq = vi.fn();
const upsert = vi.fn();
const single = vi.fn();
const update = vi.fn();
const maybeSingle = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  const query = {
    select,
    eq,
    upsert,
    update,
    maybeSingle,
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
    single,
  };
  select.mockReturnValue(query);
  eq.mockReturnValue(query);
  upsert.mockResolvedValue({ error: null });
  single.mockResolvedValue({ data: { ...profile }, error: null });
  update.mockReturnValue(query);
  maybeSingle.mockResolvedValue({
    data: { ...profile, display_name: "Clerk Name" },
    error: null,
  });
  vi.mocked(currentUser).mockResolvedValue({
    fullName: "Clerk Name",
  } as Awaited<ReturnType<typeof currentUser>>);
  vi.mocked(authenticatedWorkspace).mockResolvedValue({
    user: { id: account },
    db: {
      from: vi.fn().mockReturnValue(query),
      rpc: vi.fn(async (name) => ({
        data: name === "learning_analytics" ? [] : rewards,
        error: null,
      })),
    },
  } as unknown as Awaited<ReturnType<typeof authenticatedWorkspace>>);
});

describe("workspace API", () => {
  it("loads a Clerk user's workspace through their mapped UUID profile", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      courses: [],
      goals: [],
      profile,
      activity: [],
      rewards,
    });
    expect(eq).toHaveBeenCalledWith("id", account);
    expect(select).toHaveBeenCalledWith(
      "display_name, timezone, daily_minutes, auto_complete, weekend_rest",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(currentUser).not.toHaveBeenCalled();
  });
  it("persists the Clerk name for a blank profile without overwriting a custom name", async () => {
    single.mockResolvedValue({
      data: { ...profile, display_name: "" },
      error: null,
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).profile.display_name).toBe("Clerk Name");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Clerk Name" }),
    );
    expect(eq).toHaveBeenCalledWith("display_name", "");
  });
  it("saves records with the UUID instead of the Clerk subject", async () => {
    const response = await POST(
      new Request("https://example.com/api/workspace", {
        method: "POST",
        headers: {
          origin: "https://example.com",
          host: "example.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          op: "goal",
          id: "22222222-2222-4222-8222-222222222222",
          goal_type: "daily_minutes",
          target_value: 30,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: account }),
      { onConflict: "user_id,goal_type" },
    );
  });
  it.each([401, 503])(
    "preserves authentication/setup error status %i",
    async (status) => {
      vi.mocked(authenticatedWorkspace).mockRejectedValue(
        new WorkspaceAccessError("Setup error", status),
      );
      const response = await GET();
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: "Setup error" });
    },
  );
});
