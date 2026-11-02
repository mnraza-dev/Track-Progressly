import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { hasAllowedOrigin } from "@/lib/http/origin";
import { readJsonBody, RequestBodyError } from "@/lib/http/body";
import { importTelegramPage } from "@/lib/telegram/service";
import { TelegramError } from "@/lib/telegram/parse";
const limits = new Map<string, { start: number; count: number }>();
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!hasAllowedOrigin(request))
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403, headers },
    );
  try {
    const { userId } = await auth();
    if (!userId)
      return Response.json(
        { error: "Please sign in to import a channel." },
        { status: 401, headers },
      );
    const input = z
      .object({
        input: z.string().trim().min(1).max(500),
        before: z
          .string()
          .regex(/^[1-9]\d{0,15}$/)
          .optional(),
      })
      .parse(await readJsonBody(request, 2000));
    const now = Date.now();
    for (const [key, bucket] of limits)
      if (now - bucket.start >= 60_000) limits.delete(key);
    if (limits.size >= 10000 && !limits.has(userId))
      return Response.json(
        { error: "Import capacity reached. Try again in a minute." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    const bucket = limits.get(userId) || { start: now, count: 0 };
    limits.set(userId, bucket);
    if (++bucket.count > 300)
      return Response.json(
        { error: "Too many channel requests. Wait a minute and try again." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    return Response.json(await importTelegramPage(input.input, input.before), {
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Telegram import failed.",
      },
      {
        status:
          error instanceof TelegramError || error instanceof RequestBodyError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : 500,
        headers:
          error instanceof TelegramError && error.status === 429
            ? { ...headers, "Retry-After": "60" }
            : headers,
      },
    );
  }
}
