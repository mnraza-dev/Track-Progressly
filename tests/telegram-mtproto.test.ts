import { describe, expect, it, beforeEach } from "vitest";
import {
  getStoredTelegramCredentials,
  saveStoredTelegramCredentials,
  getStoredTelegramSession,
  saveStoredTelegramSession,
  clearStoredTelegramSession,
  DEFAULT_TELEGRAM_API_ID,
  DEFAULT_TELEGRAM_API_HASH,
} from "@/lib/telegram/mtproto";

describe("Telegram MTProto User Auth & Storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const mockLocalStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: mockLocalStorage },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it("returns default credentials when nothing is stored", () => {
    const creds = getStoredTelegramCredentials();
    expect(creds.apiId).toBe(DEFAULT_TELEGRAM_API_ID);
    expect(creds.apiHash).toBe(DEFAULT_TELEGRAM_API_HASH);
  });

  it("saves and retrieves custom API credentials", () => {
    saveStoredTelegramCredentials(123456, "custom_hash_abc");
    const creds = getStoredTelegramCredentials();
    expect(creds.apiId).toBe(123456);
    expect(creds.apiHash).toBe("custom_hash_abc");
  });

  it("saves and clears session strings", () => {
    expect(getStoredTelegramSession()).toBe("");
    saveStoredTelegramSession("1BA...sample_session");
    expect(getStoredTelegramSession()).toBe("1BA...sample_session");
    clearStoredTelegramSession();
    expect(getStoredTelegramSession()).toBe("");
  });

  it("sanitizes float and string durations in importVideoSchema", async () => {
    const { importVideoSchema } = await import("@/lib/validations");
    const videoWithFloat = {
      source: "telegram",
      telegram_post: "test_channel/123",
      youtube_video_id: "",
      title: "Lesson 123",
      description: "Test description",
      thumbnail_url: "",
      duration_seconds: 23.456, // float from telegram video metadata
      position: 1,
      availability_status: "available",
    };

    const parsed = importVideoSchema.parse(videoWithFloat);
    expect(parsed.duration_seconds).toBe(23);
    expect(Number.isInteger(parsed.duration_seconds)).toBe(true);

    const videoWithString = {
      ...videoWithFloat,
      duration_seconds: "125.8",
    };
    const parsedString = importVideoSchema.parse(videoWithString);
    expect(parsedString.duration_seconds).toBe(126);

    const videoWithNull = {
      ...videoWithFloat,
      duration_seconds: null,
    };
    const parsedNull = importVideoSchema.parse(videoWithNull);
    expect(parsedNull.duration_seconds).toBe(0);
  });
});

