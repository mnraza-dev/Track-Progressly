import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/workspace/restore/route";
import {
  authenticatedWorkspace,
  WorkspaceAccessError,
} from "@/lib/supabase/workspace";
import { emptyWorkspace } from "@/types";
vi.mock("@/lib/supabase/workspace", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/workspace")>()),
  authenticatedWorkspace: vi.fn(),
}));
const rpc = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
  vi.mocked(authenticatedWorkspace).mockResolvedValue({
    db: { rpc },
    user: { id: "account" },
  } as unknown as Awaited<ReturnType<typeof authenticatedWorkspace>>);
});
afterEach(() => vi.restoreAllMocks());
function request(
  body: unknown = emptyWorkspace,
  origin = "https://example.com",
) {
  return new Request("https://example.com/api/workspace/restore", {
    method: "POST",
    headers: {
      origin,
      host: "example.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
describe("account JSON restore API", () => {
  it("validates backups and sends only workspace data to the atomic RPC", async () => {
    const response = await POST(
      request({
        app: "progressly",
        version: 1,
        workspace: { ...emptyWorkspace, user_id: "someone-else" },
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("restore_workspace", {
      payload: emptyWorkspace,
    });
  });
  it("rejects invalid JSON data before any destructive database operation", async () => {
    expect((await POST(request({ courses: [] }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("blocks cross-origin restore requests before authentication", async () => {
    expect(
      (await POST(request(emptyWorkspace, "https://other.example"))).status,
    ).toBe(403);
    expect(authenticatedWorkspace).not.toHaveBeenCalled();
  });
  it("requires a signed-in account", async () => {
    vi.mocked(authenticatedWorkspace).mockRejectedValue(
      new WorkspaceAccessError("Sign in", 401),
    );
    expect((await POST(request())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports the missing restore migration", async () => {
    rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain(
      "006_workspace_restore.sql",
    );
  });
  it("rejects oversized backups before the restore RPC", async () => {
    const oversized = request();
    oversized.headers.set("content-length", "25000001");
    expect((await POST(oversized)).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not claim a network interruption rolled back a potentially completed restore", async () => {
    rpc
      .mockResolvedValueOnce({ data: { revision: null }, error: null })
      .mockResolvedValueOnce({
        error: { code: "", message: "Failed to fetch" },
      });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("could not be confirmed");
  });
  it("does not start a restore if the current cloud state could not be checked", async () => {
    rpc.mockResolvedValueOnce({
      error: { code: "", message: "Network unavailable" },
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("No restore was started");
    expect(rpc.mock.calls).toEqual([["get_workspace_snapshot"]]);
  });
  it("updates the current snapshot for an older restore client instead of stale relational data", async () => {
    const revision = "11111111-1111-4111-8111-111111111111";
    rpc
      .mockResolvedValueOnce({ data: { revision }, error: null })
      .mockResolvedValueOnce({ data: {}, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("sync_workspace_snapshot", {
      payload: emptyWorkspace,
      expected_revision: revision,
      request_id: expect.any(String),
    });
    expect(rpc).not.toHaveBeenCalledWith(
      "restore_workspace",
      expect.anything(),
    );
  });
});
