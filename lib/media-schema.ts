import { z } from "zod";
import {
  telegramChannelPattern,
  telegramPostPattern,
} from "@/lib/telegram/parse";
export const mediaFields = {
  source: z.enum(["youtube", "telegram"]).optional(),
  telegram_post: z.string().regex(telegramPostPattern).optional(),
  youtube_video_id: z.string().max(11),
};
export const telegramChannelSchema = z
  .string()
  .regex(telegramChannelPattern)
  .optional();
export function validateMediaSource(
  value: { source?: string; telegram_post?: string; youtube_video_id: string },
  context: z.RefinementCtx,
) {
  if (value.source === "telegram") {
    if (!value.telegram_post || value.youtube_video_id !== "")
      context.addIssue({
        code: "custom",
        path: ["telegram_post"],
        message: "Telegram lessons require a public post and no YouTube ID.",
      });
  } else if (
    !/^[\w-]{11}$/.test(value.youtube_video_id) ||
    value.telegram_post
  ) {
    context.addIssue({
      code: "custom",
      path: ["youtube_video_id"],
      message: "Enter a valid YouTube video ID.",
    });
  }
}
