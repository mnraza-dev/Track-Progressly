import { importYouTube, YouTubeError } from "@/lib/youtube/service";
import { serverSupabase } from "@/lib/supabase/server";
import { z } from "zod";
const localLimits = new Map<string, { start: number; count: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") || 0) > 4_000_000)
    return Response.json(
      { error: "This import is too large. Please use a smaller playlist." },
      { status: 413 },
    );
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const db = await serverSupabase();
      const { data } = await db.auth.getUser();
      if (!data.user)
        return Response.json(
          { error: "Please sign in to import a course." },
          { status: 401 },
        );
      const limit = await db.rpc("consume_import_quota");
      if (limit.error) throw new Error("Import rate check failed.");
      if (!limit.data)
        return Response.json(
          {
            error:
              "You’ve made several imports recently. Please try again in a minute.",
          },
          { status: 429 },
        );
    } else {
      if (process.env.NODE_ENV === "production")
        return Response.json(
          {
            error:
              "Connect Supabase before enabling YouTube imports in production.",
          },
          { status: 503 },
        );
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
      const bucket = localLimits.get(ip);
      const current =
        bucket && Date.now() - bucket.start < 60000
          ? bucket
          : { start: Date.now(), count: 0 };
      current.count++;
      localLimits.set(ip, current);
      if (current.count > 10)
        return Response.json(
          { error: "Too many imports. Please try again in a minute." },
          { status: 429 },
        );
    }
    const { input } = z
      .object({ input: z.string().min(1).max(500) })
      .parse(await request.json());
    const preview = await importYouTube(input);
    return Response.json(preview, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import failed." },
      {
        status:
          e instanceof YouTubeError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 500,
      },
    );
  }
}
