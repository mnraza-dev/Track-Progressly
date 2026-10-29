import { z } from "zod";
import {
  authenticatedWorkspace,
  WorkspaceAccessError,
} from "@/lib/supabase/workspace";
import { readJsonBody, RequestBodyError } from "@/lib/http/body";
import { hasAllowedOrigin } from "@/lib/http/origin";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Cloud sync failed. Your local changes are still saved.",
    },
    {
      status:
        error instanceof WorkspaceAccessError ||
        error instanceof RequestBodyError
          ? error.status
          : 500,
      headers,
    },
  );
}
function databaseFailure(code: string) {
  if (code === "PT409")
    return Response.json(
      {
        error:
          "Another device has newer cloud data. Your local changes are safe. Export a backup before choosing which version to keep.",
        conflict: true,
      },
      { status: 409, headers },
    );
  return Response.json(
    {
      error:
        code === "PGRST202"
          ? "Daily cloud sync needs the 007_daily_workspace_sync.sql database migration. Your changes are saved locally."
          : "Cloud sync is unavailable. Your changes are saved locally.",
      setupRequired: code === "PGRST202",
    },
    { status: 503, headers },
  );
}
export async function GET() {
  try {
    const { db } = await authenticatedWorkspace();
    const { data, error } = await db.rpc("get_workspace_snapshot");
    if (error) return databaseFailure(error.code);
    return Response.json(
      data || { workspace: null, revision: null, syncedAt: null },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!hasAllowedOrigin(request))
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403, headers },
    );
  try {
    const { db } = await authenticatedWorkspace();
    const input = await readJsonBody(request, 25_000_000);
    const parsed = z
      .object({
        workspace: z.unknown(),
        revision: z.uuid().nullable(),
        requestId: z.uuid(),
      })
      .safeParse(input);
    if (!parsed.success)
      return Response.json(
        { error: "Invalid sync request." },
        { status: 400, headers },
      );
    let workspace;
    try {
      workspace = parseWorkspaceBackup(JSON.stringify(parsed.data.workspace));
    } catch {
      return Response.json(
        { error: "Invalid workspace. Your local data has not been changed." },
        { status: 400, headers },
      );
    }
    const { data, error } = await db.rpc("sync_workspace_snapshot", {
      payload: workspace,
      expected_revision: parsed.data.revision,
      request_id: parsed.data.requestId,
    });
    if (error) return databaseFailure(error.code);
    return Response.json(data, { headers });
  } catch (error) {
    return failure(error);
  }
}
