import { afterEach, describe, expect, it, vi } from "vitest";
import { signOut } from "@/features/auth/sign-out";
import { useWorkspace } from "@/stores/workspace";
import { emptyWorkspace } from "@/types";

vi.mock("@clerk/nextjs", () => ({ useAuth: vi.fn(), useClerk: vi.fn() }));
const original = useWorkspace.getState();
afterEach(() => {
  useWorkspace.setState(original);
  vi.unstubAllGlobals();
});

describe("Clerk workspace sign-out", () => {
  it("signs out even when the database is unavailable, clears private state and leaves the protected page", async () => {
    const replace = vi.fn();
    const fetch = vi.fn().mockRejectedValue(new Error("Database unavailable"));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", { location: { replace } });
    useWorkspace.setState({
      loaded: true,
      error: "Workspace unavailable",
      data: {
        ...emptyWorkspace,
        profile: { ...emptyWorkspace.profile, display_name: "Alice" },
      },
    });
    const endSession = vi.fn(async (callback: () => void) => {
      expect(replace).not.toHaveBeenCalled();
      callback();
    });
    await signOut(endSession as unknown as Parameters<typeof signOut>[0]);
    expect(endSession).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(useWorkspace.getState()).toMatchObject({
      data: emptyWorkspace,
      loaded: false,
      error: null,
      toast: null,
      celebration: null,
    });
    expect(replace).toHaveBeenCalledWith("/login");
  });
  it("does not pretend logout succeeded or redirect when Clerk rejects sign-out", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    useWorkspace.setState({ loaded: true });
    const endSession = vi
      .fn()
      .mockRejectedValue(new Error("Clerk unavailable"));
    await expect(signOut(endSession)).rejects.toThrow("Clerk unavailable");
    expect(replace).not.toHaveBeenCalled();
    expect(useWorkspace.getState().loaded).toBe(true);
  });
});
