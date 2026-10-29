import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/workspace/sync/route";
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
const requestId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({
    data: { revision: requestId, syncedAt: "2026-10-29T10:00:00Z" },
    error: null,
  });
  vi.mocked(authenticatedWorkspace).mockResolvedValue({
    db: { rpc },
    user: { id: "account" },
  } as unknown as Awaited<ReturnType<typeof authenticatedWorkspace>>);
});
function request(
  body: unknown = { workspace: emptyWorkspace, revision: null, requestId },
  origin = "https://example.com",
) {
  return new Request("https://example.com/api/workspace/sync", {
    method: "POST",
    headers: {
      host: "example.com",
      origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
describe("daily workspace snapshot API", () => {
  it("saves a complete validated workspace in one database RPC", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc.mock.calls).toEqual([
      [
        "sync_workspace_snapshot",
        {
          payload: emptyWorkspace,
          expected_revision: null,
          request_id: requestId,
        },
      ],
    ]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("loads the account's snapshot through one RPC", async () => {
    rpc.mockResolvedValue({
      data: { workspace: emptyWorkspace, revision: requestId },
      error: null,
    });
    const response = await GET();
    expect((await response.json()).workspace).toEqual(emptyWorkspace);
    expect(rpc.mock.calls).toEqual([["get_workspace_snapshot"]]);
  });
  it("rejects malformed data without writing to the database", async () => {
    expect(
      (await POST(request({ workspace: {}, revision: null, requestId })))
        .status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("strips supplied ownership fields and lets the database derive the caller", async () => {
    await POST(
      request({
        workspace: { ...emptyWorkspace, user_id: "someone-else" },
        revision: null,
        requestId,
        accountId: "someone-else",
      }),
    );
    expect(rpc).toHaveBeenCalledWith("sync_workspace_snapshot", {
      payload: emptyWorkspace,
      expected_revision: null,
      request_id: requestId,
    });
  });
  it("rejects a cross-origin upload before authentication", async () => {
    expect(
      (await POST(request(undefined, "https://other.example"))).status,
    ).toBe(403);
    expect(authenticatedWorkspace).not.toHaveBeenCalled();
  });
  it("preserves account authentication failures", async () => {
    vi.mocked(authenticatedWorkspace).mockRejectedValue(
      new WorkspaceAccessError("Sign in", 401),
    );
    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
  });
  it("returns a conflict instead of overwriting newer cloud data", async () => {
    rpc.mockResolvedValue({ error: { code: "PT409" } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).conflict).toBe(true);
  });
  it("identifies a missing migration without claiming local data is lost", async () => {
    rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      setupRequired: true,
      error: expect.stringContaining("007_daily_workspace_sync.sql"),
    });
  });
  it("enforces the streamed request limit before writing", async () => {
    const oversized = request();
    oversized.headers.set("content-length", "25000001");
    expect((await POST(oversized)).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
});
