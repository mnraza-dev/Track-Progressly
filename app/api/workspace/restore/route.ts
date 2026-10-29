import {
  authenticatedWorkspace,
  WorkspaceAccessError,
} from "@/lib/supabase/workspace";
import { hasAllowedOrigin } from "@/lib/http/origin";
import { readJsonBody, RequestBodyError } from "@/lib/http/body";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request))
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  try {
    const { db } = await authenticatedWorkspace();
    const input = await readJsonBody(request, 25_000_000);
    let workspace;
    try {
      workspace = parseWorkspaceBackup(JSON.stringify(input));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid backup." },
        { status: 400 },
      );
    }
    const snapshot = await db.rpc("get_workspace_snapshot");
    if (snapshot.error && snapshot.error.code !== "PGRST202")
      return Response.json(
        {
          error:
            "The current cloud workspace could not be checked. No restore was started; please try again when cloud storage is available.",
        },
        { status: 503 },
      );
    // Compatibility for older clients: a cloud restore must update the current
    // snapshot once the account has migrated, rather than its bootstrap tables.
    const result = snapshot.data?.revision
      ? await db.rpc("sync_workspace_snapshot", {
          payload: workspace,
          expected_revision: snapshot.data.revision,
          request_id: crypto.randomUUID(),
        })
      : await db.rpc("restore_workspace", { payload: workspace });
    const { error } = result;
    if (error) {
      if (error.code === "PT409")
        return Response.json(
          {
            error:
              "The cloud workspace changed during restore. Reload it before retrying.",
          },
          { status: 409 },
        );
      if (error.code === "PGRST202")
        return Response.json(
          {
            error:
              "Account restore needs the 006_workspace_restore.sql database migration.",
          },
          { status: 503 },
        );
      if (
        !error.code ||
        error.code.startsWith("08") ||
        error.code.startsWith("PGRST0")
      )
        return Response.json(
          {
            error:
              "The restore response could not be confirmed. Reload your workspace to check its current state before retrying.",
          },
          { status: 503 },
        );
      return Response.json(
        {
          error:
            "Could not restore this backup. Your existing workspace has not been changed.",
        },
        { status: 400 },
      );
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not restore workspace.",
      },
      {
        status:
          error instanceof WorkspaceAccessError ||
          error instanceof RequestBodyError
            ? error.status
            : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
