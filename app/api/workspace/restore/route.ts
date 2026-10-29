import { authenticatedWorkspace, WorkspaceAccessError } from "@/lib/supabase/workspace";
import { hasAllowedOrigin } from "@/lib/http/origin";
import { readJsonBody, RequestBodyError } from "@/lib/http/body";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request))
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  try {
    const { db } = await authenticatedWorkspace();
    const input = await readJsonBody(request, 25_000_000);
    let workspace;
    try {
      workspace = parseWorkspaceBackup(JSON.stringify(input));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid backup." }, { status: 400 });
    }
    const { error } = await db.rpc("restore_workspace", { payload: workspace });
    if (error) {
      if (error.code === "PGRST202")
        return Response.json({ error: "Account restore needs the 006_workspace_restore.sql database migration." }, { status: 503 });
      return Response.json({ error: "Could not restore this backup. Your existing workspace has not been changed." }, { status: 400 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not restore workspace." }, {
      status: error instanceof WorkspaceAccessError || error instanceof RequestBodyError ? error.status : 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
