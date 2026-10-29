import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export class WorkspaceAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function authenticatedWorkspace() {
  const { userId, getToken, sessionClaims } = await auth();
  if (!userId)
    throw new WorkspaceAccessError(
      "Please sign in to access your workspace.",
      401,
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new WorkspaceAccessError(
      "Supabase is not configured for cloud sync.",
      503,
    );

  const token = await getToken();
  if (!token)
    throw new WorkspaceAccessError(
      "Please sign in to access your workspace.",
      401,
    );

  // Clerk owns the session. Supabase Auth cookies do not authenticate Clerk users.
  const db = createClient(url, key, { accessToken: async () => token });
  const { data: id, error } = await db.rpc("ensure_workspace_profile");
  if (error) {
    if (error.code === "PGRST202")
      throw new WorkspaceAccessError(
        "Cloud workspace setup is incomplete. Apply the database migrations through 005_clerk_workspaces.sql.",
        503,
      );
    if (error.code === "PGRST301" || error.code === "PGRST303") {
      // Keep the gateway's diagnostic in the server logs; never log the session token.
      console.error("[workspace] Supabase rejected the Clerk session", {
        code: error.code,
        reason: error.message.replace(
          /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
          "[redacted token]",
        ),
      });
      if (/expired/i.test(error.message))
        throw new WorkspaceAccessError(
          "Your sign-in session has expired. Please sign out and sign in again.",
          401,
        );

      let domain: string | undefined;
      try {
        if (sessionClaims?.iss) domain = new URL(sessionClaims.iss).hostname;
      } catch {
        /* The generic setup message is sufficient without an issuer. */
      }
      throw new WorkspaceAccessError(
        `Supabase rejected your Clerk sign-in token. In Supabase Authentication → Third-Party Auth, enable Clerk${domain ? ` with domain ${domain}` : " using your Clerk instance domain"}. Your workspace profile will be created automatically once authentication succeeds.`,
        503,
      );
    }
    if (error.code === "42501")
      throw new WorkspaceAccessError(
        "Supabase denied workspace access. Ensure Clerk session tokens include role: authenticated, then sign out and sign in again. If the problem persists, check the workspace database migration grants.",
        503,
      );
    throw error;
  }
  if (typeof id !== "string")
    throw new WorkspaceAccessError(
      "Could not initialize your workspace profile.",
      503,
    );
  return { db, user: { id } };
}
