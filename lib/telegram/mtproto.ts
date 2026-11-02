import type { ImportPreview } from "@/types";
import QRCode from "qrcode";

function toBase64Url(buf: Uint8Array | Buffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const SESSION_STORAGE_KEY = "progressly:tg_session";
const API_ID_KEY = "progressly:tg_api_id";
const API_HASH_KEY = "progressly:tg_api_hash";

// Default public Telegram Web credentials (can be overridden via env or user settings)
export const DEFAULT_TELEGRAM_API_ID =
  Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID) || 2496;
export const DEFAULT_TELEGRAM_API_HASH =
  process.env.NEXT_PUBLIC_TELEGRAM_API_HASH ||
  "8da85b0d5bfe62527e5b244c209159c3";

export interface TelegramUserInfo {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

export interface TelegramDialogItem {
  id: string;
  title: string;
  isChannel: boolean;
  isGroup: boolean;
  username?: string;
  unreadCount: number;
}

let activeClient: any = null;

async function loadGramJS() {
  const [clientMod, tlMod, sessionMod] = await Promise.all([
    import("telegram/client/TelegramClient"),
    import("telegram/tl"),
    import("telegram/sessions/StringSession"),
  ]);
  return {
    TelegramClient: clientMod.TelegramClient,
    Api: tlMod.Api,
    StringSession: sessionMod.StringSession,
  };
}

export function getStoredTelegramCredentials(): {
  apiId: number;
  apiHash: string;
} {
  if (typeof window === "undefined") {
    return {
      apiId: DEFAULT_TELEGRAM_API_ID,
      apiHash: DEFAULT_TELEGRAM_API_HASH,
    };
  }
  const storedId = localStorage.getItem(API_ID_KEY);
  const storedHash = localStorage.getItem(API_HASH_KEY);
  return {
    apiId: storedId ? Number(storedId) : DEFAULT_TELEGRAM_API_ID,
    apiHash: storedHash || DEFAULT_TELEGRAM_API_HASH,
  };
}

export function saveStoredTelegramCredentials(apiId: number, apiHash: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_ID_KEY, String(apiId));
  localStorage.setItem(API_HASH_KEY, apiHash);
}

export function getStoredTelegramSession(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SESSION_STORAGE_KEY) || "";
}

export function saveStoredTelegramSession(session: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, session);
}

export function clearStoredTelegramSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  if (activeClient) {
    try {
      activeClient.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    activeClient = null;
  }
}

export async function getTelegramClient(
  sessionString?: string,
): Promise<any> {
  const session = sessionString ?? getStoredTelegramSession();
  const { apiId, apiHash } = getStoredTelegramCredentials();

  if (activeClient && String(activeClient.session?.save?.()) === session) {
    if (!activeClient.connected) {
      await activeClient.connect();
    }
    return activeClient;
  }

  if (activeClient) {
    try {
      await activeClient.disconnect();
    } catch {
      // Ignore
    }
  }

  const { TelegramClient, StringSession } = await loadGramJS();
  const stringSession = new StringSession(session);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });

  await client.connect();
  activeClient = client;
  return client;
}

export async function sendTelegramLoginCode(
  phoneNumber: string,
  customApiId?: number,
  customApiHash?: string,
): Promise<{ phoneCodeHash: string; isCodeViaApp?: boolean }> {
  const { apiId: defaultId, apiHash: defaultHash } =
    getStoredTelegramCredentials();
  const apiId = customApiId || defaultId;
  const apiHash = customApiHash || defaultHash;

  if (customApiId && customApiHash) {
    saveStoredTelegramCredentials(customApiId, customApiHash);
  }

  const { TelegramClient, StringSession } = await loadGramJS();
  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });

  await client.connect();
  activeClient = client;

  const result = await client.sendCode(
    {
      apiId,
      apiHash,
    },
    phoneNumber,
  );

  return {
    phoneCodeHash: result.phoneCodeHash,
    isCodeViaApp: result.isCodeViaApp,
  };
}

export async function completeTelegramLogin(params: {
  phoneNumber: string;
  phoneCode: string;
  phoneCodeHash: string;
  password?: string;
}): Promise<TelegramUserInfo> {
  const { apiId, apiHash } = getStoredTelegramCredentials();
  const client = await getTelegramClient();
  const { Api } = await loadGramJS();

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: params.phoneNumber,
        phoneCodeHash: params.phoneCodeHash,
        phoneCode: params.phoneCode,
      }),
    );
  } catch (error: any) {
    if (
      error?.errorMessage === "SESSION_PASSWORD_NEEDED" ||
      error?.message?.includes("SESSION_PASSWORD_NEEDED")
    ) {
      if (!params.password) {
        throw new Error("2FA_PASSWORD_NEEDED");
      }
      await client.signInWithPassword(
        {
          apiId,
          apiHash,
        },
        {
          password: async () => params.password!,
          onError: (err: Error) => {
            throw err;
          },
        },
      );
    } else {
      throw error;
    }
  }

  const sessionString = client.session.save();
  if (typeof sessionString === "string") {
    saveStoredTelegramSession(sessionString);
  }

  const me = await client.getMe();
  return {
    id: String(me.id),
    firstName: me.firstName || "Telegram User",
    lastName: me.lastName,
    username: me.username,
    phone: me.phone,
  };
}

export async function loginWithTelegramQrCode(
  onQrCode: (qrUrl: string, expires: number) => void,
  customApiId?: number,
  customApiHash?: string,
): Promise<TelegramUserInfo> {
  const { apiId: defaultId, apiHash: defaultHash } =
    getStoredTelegramCredentials();
  const apiId = customApiId || defaultId;
  const apiHash = customApiHash || defaultHash;

  if (customApiId && customApiHash) {
    saveStoredTelegramCredentials(customApiId, customApiHash);
  }

  const { TelegramClient, StringSession } = await loadGramJS();
  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });

  await client.connect();
  activeClient = client;

  const user = await client.signInUserWithQrCode(
    {
      apiId,
      apiHash,
    },
    {
      qrCode: async ({ token, expires }: { token: Buffer; expires: number }) => {
        const base64UrlToken = toBase64Url(token);
        const tgLoginUrl = `tg://login?token=${base64UrlToken}`;
        const qrDataUrl = await QRCode.toDataURL(tgLoginUrl, {
          width: 260,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        onQrCode(qrDataUrl, expires);
      },
      onError: (err: Error) => {
        console.error("[telegram-qr] QR Auth Error:", err);
      },
    },
  );

  const sessionString = client.session.save();
  if (typeof sessionString === "string") {
    saveStoredTelegramSession(sessionString);
  }

  const me = (user || (await client.getMe())) as any;
  return {
    id: String(me.id),
    firstName: me.firstName || "Telegram User",
    lastName: me.lastName,
    username: me.username,
    phone: me.phone,
  };
}

export async function getTelegramAuthStatus(): Promise<TelegramUserInfo | null> {
  if (typeof window === "undefined") return null;
  const session = getStoredTelegramSession();
  if (!session) return null;

  try {
    const client = await getTelegramClient(session);
    const me = await client.getMe();
    if (!me) return null;
    return {
      id: String(me.id),
      firstName: me.firstName || "Telegram User",
      lastName: me.lastName,
      username: me.username,
      phone: me.phone,
    };
  } catch {
    return null;
  }
}

export async function getTelegramDialogs(): Promise<TelegramDialogItem[]> {
  const client = await getTelegramClient();
  const dialogs = await client.getDialogs({ limit: 100 });
  const items: TelegramDialogItem[] = [];

  for (const dialog of dialogs) {
    if (dialog.isChannel || dialog.isGroup) {
      const entity = dialog.entity as any;
      items.push({
        id: String(dialog.id),
        title: dialog.title || "Untitled Chat",
        isChannel: Boolean(dialog.isChannel),
        isGroup: Boolean(dialog.isGroup),
        username: entity?.username,
        unreadCount: dialog.unreadCount || 0,
      });
    }
  }

  return items;
}

export async function importDialogAsCourse(
  dialogIdOrUsername: string,
  onProgress?: (found: number, scanned: number) => void,
): Promise<ImportPreview> {
  const client = await getTelegramClient();
  const { Api } = await loadGramJS();

  const entity = await client.getEntity(dialogIdOrUsername);
  const entityAny = entity as any;

  const title = entityAny.title || entityAny.username || "Telegram Course";
  const channelIdentifier =
    entityAny.username ||
    `c_${String(entityAny.id).replace(/^-100/, "").replace(/^-/, "")}`;

  const videos: ImportPreview["videos"] = [];
  let scanned = 0;

  for await (const message of client.iterMessages(entity, { limit: 500 })) {
    scanned++;
    if (message.media && message.media instanceof Api.MessageMediaDocument) {
      const doc = message.media.document;
      if (doc instanceof Api.Document) {
        let isVideo = doc.mimeType?.startsWith("video/") || false;
        let filename = "";
        let durationSeconds = 0;

        if (doc.attributes) {
          for (const attr of doc.attributes) {
            if (attr instanceof Api.DocumentAttributeFilename) {
              filename = attr.fileName;
              if (/\.(?:mp4|m4v|mov|webm|mkv|avi)$/i.test(filename)) {
                isVideo = true;
              }
            } else if (attr instanceof Api.DocumentAttributeVideo) {
              isVideo = true;
              durationSeconds = Math.round(Number(attr.duration) || 0);
            }
          }
        }

        if (isVideo) {
          const caption = message.message || "";
          const videoTitle = (
            filename ||
            caption.split("\n").find((l: string) => l.trim()) ||
            `Lesson ${message.id}`
          ).slice(0, 500);

          videos.push({
            source: "telegram",
            telegram_post: `${channelIdentifier}/${message.id}`,
            youtube_video_id: "",
            title: videoTitle,
            description: caption.slice(0, 10000),
            thumbnail_url: "",
            duration_seconds: Math.max(
              0,
              Math.min(Math.round(durationSeconds), 604800),
            ),
            position: message.id,
            availability_status: "available",
          });

          onProgress?.(videos.length, scanned);
        }
      }
    }
  }

  if (!videos.length) {
    throw new Error(
      "No video messages or video attachments were found in this channel/group.",
    );
  }

  videos.sort((a, b) => a.position - b.position);

  return {
    title: title.slice(0, 250),
    description: (entityAny.about || `Imported from ${title}`).slice(0, 10000),
    channel_name: title.slice(0, 250),
    telegram_channel: channelIdentifier,
    thumbnail_url: "",
    youtube_playlist_id: null,
    videos,
  };
}
