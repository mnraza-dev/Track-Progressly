export class TelegramError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const telegramChannelPattern = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
export const telegramPostPattern =
  /^[a-zA-Z][a-zA-Z0-9_]{3,31}\/[1-9]\d{0,15}$/;

/** Accept public channel links only; never use input as a fetch destination. */
export function parseTelegram(input: string): string {
  let value = input.trim();
  if (value.startsWith("@")) value = value.slice(1);
  if (/^(?:https?:\/\/)?(?:www\.)?t\.me\//i.test(value)) {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      throw new TelegramError("Use an HTTPS public Telegram channel link.");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "s") parts.shift();
    if (parts.length !== 1)
      throw new TelegramError(
        "Paste the channel link, rather than an individual post or invite link.",
      );
    value = parts[0];
  }
  if (!telegramChannelPattern.test(value))
    throw new TelegramError(
      "Enter a public Telegram channel link or @username.",
    );
  return value.toLowerCase();
}
