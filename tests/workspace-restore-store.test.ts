import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/stores/workspace";
import { emptyWorkspace } from "@/types";
vi.mock("@/lib/supabase/client", () => ({ isConnected: true }));
const fetch = vi.fn();
const original = useWorkspace.getState();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetch);
  useWorkspace.setState({
    ...original,
    data: structuredClone(emptyWorkspace),
    loaded: true,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useWorkspace.setState(original);
});
describe("connected workspace restore", () => {
  it("saves the backup to the account and displays the canonical restored workspace", async () => {
    const canonical = {
      ...emptyWorkspace,
      profile: { ...emptyWorkspace.profile, display_name: "Clerk default" },
    };
    fetch
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(canonical));
    await useWorkspace.getState().restore(structuredClone(emptyWorkspace));
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/restore",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/workspace", {
      cache: "no-store",
    });
    expect(useWorkspace.getState().data).toEqual(canonical);
  });
  it("keeps the current workspace on a failed restore and permits a later retry", async () => {
    const before = useWorkspace.getState().data;
    fetch.mockResolvedValueOnce(
      Response.json({ error: "Invalid backup" }, { status: 400 }),
    );
    await expect(
      useWorkspace.getState().restore(structuredClone(emptyWorkspace)),
    ).rejects.toThrow("Invalid backup");
    expect(useWorkspace.getState().data).toBe(before);
    fetch
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(emptyWorkspace));
    await useWorkspace.getState().restore(structuredClone(emptyWorkspace));
    expect(useWorkspace.getState().error).toBeNull();
  });
});
