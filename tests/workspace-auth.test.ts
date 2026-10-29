import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { authenticatedWorkspace } from "@/lib/supabase/workspace";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
const account = "11111111-1111-4111-8111-111111111111";
const getToken = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(auth).mockResolvedValue({
    userId: "user_clerk_alice",
    getToken,
  } as unknown as Awaited<ReturnType<typeof auth>>);
  getToken.mockResolvedValue("clerk-session-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Clerk-authenticated workspace database client", () => {
  it("passes the Clerk token to Supabase and uses the database UUID for writes", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(account));
    const { db, user } = await authenticatedWorkspace();
    expect(user.id).toBe(account);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://example.supabase.co/rest/v1/rpc/ensure_workspace_profile",
    );
    expect(new Headers(options.headers).get("Authorization")).toBe(
      "Bearer clerk-session-token",
    );
    expect(JSON.parse(options.body)).toEqual({});

    fetchMock.mockResolvedValueOnce(Response.json([]));
    await db.from("learning_goals").insert({ user_id: user.id });
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get("Authorization"),
    ).toBe("Bearer clerk-session-token");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      user_id: account,
    });
  });
  it.each([null, "user_clerk_alice"])(
    "rejects missing user or token before any database request (%s)",
    async (userId) => {
      vi.mocked(auth).mockResolvedValue({
        userId,
        getToken,
      } as unknown as Awaited<ReturnType<typeof auth>>);
      getToken.mockResolvedValue(null);
      await expect(authenticatedWorkspace()).rejects.toMatchObject({
        status: 401,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("reports unapplied migrations with an actionable setup error", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: "PGRST202", message: "RPC missing" },
        { status: 404 },
      ),
    );
    await expect(authenticatedWorkspace()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("005_clerk_workspaces.sql"),
    });
  });
  it("reports a missing Clerk integration without falling back to anonymous access", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: "PGRST301", message: "Invalid JWT" },
        { status: 401 },
      ),
    );
    await expect(authenticatedWorkspace()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("Third-Party Auth"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("identifies the verified Clerk issuer when Supabase rejects its signing key", async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: "user_clerk_alice",
      getToken,
      sessionClaims: { iss: "https://example.clerk.accounts.dev" },
    } as unknown as Awaited<ReturnType<typeof auth>>);
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: "PGRST301", message: "No suitable key or wrong key type" },
        { status: 401 },
      ),
    );
    await expect(authenticatedWorkspace()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining(
        "with domain example.clerk.accounts.dev",
      ),
    });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), {
      code: "PGRST301",
      reason: "No suitable key or wrong key type",
    });
  });
  it("reports an expired token as a session error rather than missing database data", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: "PGRST303", message: "JWT expired" },
        { status: 401 },
      ),
    );
    await expect(authenticatedWorkspace()).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("expired"),
    });
  });
  it("redacts tokens from gateway diagnostics", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          code: "PGRST301",
          message: "Invalid token eyJhbGciOiJSUzI1NiJ9.c2VjcmV0.c2lnbmF0dXJl",
        },
        { status: 401 },
      ),
    );
    await expect(authenticatedWorkspace()).rejects.toMatchObject({
      status: 503,
    });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), {
      code: "PGRST301",
      reason: "Invalid token [redacted token]",
    });
  });
  it("distinguishes a database permission error from a rejected JWT", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          code: "42501",
          message: "permission denied for function ensure_workspace_profile",
        },
        { status: 403 },
      ),
    );
    await expect(authenticatedWorkspace()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("role: authenticated"),
    });
  });
});
