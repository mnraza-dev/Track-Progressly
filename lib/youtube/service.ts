import { parseDuration, parseYouTube } from "./parse";
import type { ImportPreview } from "@/types";
type Snippet = {
  title: string;
  description?: string;
  channelTitle?: string;
  videoOwnerChannelTitle?: string;
  position?: number;
  resourceId?: { videoId: string };
  thumbnails?: { high?: { url: string }; medium?: { url: string } };
};
type Resource = {
  id: string;
  snippet: Snippet;
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
};
type Page = {
  items: Resource[];
  nextPageToken?: string;
  error?: { errors?: { reason: string }[] };
};
export class YouTubeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const cache = new Map<string, { expires: number; data: ImportPreview }>();
export async function importYouTube(
  input: string,
  request: typeof fetch = fetch,
  fresh = false,
): Promise<ImportPreview> {
  const parsed = parseYouTube(input);
  const key = `${parsed.type}:${parsed.id}`;
  if (!fresh && cache.get(key) && cache.get(key)!.expires > Date.now())
    return structuredClone(cache.get(key)!.data);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey)
    throw new YouTubeError(
      "YouTube import isn’t connected yet. You can still create a course manually and add video links.",
      503,
    );
  async function api(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<Page> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.entries({ ...params, key: apiKey! }).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
    let response: Response;
    try {
      response = await request(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new YouTubeError(
        "YouTube could not be reached. Please try again, or add your videos manually.",
        502,
      );
    }
    const result: Page = await response.json();
    if (!response.ok) {
      const reason = result.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
        throw new YouTubeError(
          "YouTube’s API quota has been reached. Try again later, or use manual course creation.",
          429,
        );
      throw new YouTubeError(
        "This playlist or video is unavailable, private, or restricted. Try a public link.",
        response.status === 404 ? 404 : 400,
      );
    }
    return result;
  }
  let metadata: Resource;
  const playlistItems: Resource[] = [];
  if (parsed.type === "playlist") {
    const playlists = await api("playlists", {
      part: "snippet",
      id: parsed.id,
    });
    metadata = playlists.items[0];
    if (!metadata)
      throw new YouTubeError("No public playlist was found at this link.", 404);
    let token = "";
    const seenTokens = new Set<string>();
    do {
      const page = await api("playlistItems", {
        part: "snippet",
        playlistId: parsed.id,
        maxResults: "50",
        ...(token ? { pageToken: token } : {}),
      });
      playlistItems.push(...page.items);
      token = page.nextPageToken || "";
      if (token && seenTokens.has(token))
        throw new YouTubeError(
          "YouTube returned an invalid pagination response. Please retry.",
          502,
        );
      if (token) seenTokens.add(token);
      if (playlistItems.length > 5000)
        throw new YouTubeError(
          "Please import playlists with fewer than 5,000 videos.",
        );
    } while (token);
  } else {
    const result = await api("videos", {
      part: "snippet,contentDetails,status",
      id: parsed.id,
    });
    metadata = result.items[0];
    if (!metadata)
      throw new YouTubeError(
        "No available public video was found at this link.",
        404,
      );
    playlistItems.push({
      ...metadata,
      snippet: {
        ...metadata.snippet,
        resourceId: { videoId: parsed.id },
        position: 0,
      },
    });
  }
  const ids = Array.from(
    new Set(
      playlistItems
        .map((item) => item.snippet.resourceId?.videoId)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const videos = new Map<string, Resource>();
  if (parsed.type === "video") videos.set(parsed.id, metadata);
  else
    for (let i = 0; i < ids.length; i += 50) {
      const result = await api("videos", {
        part: "snippet,contentDetails,status",
        id: ids.slice(i, i + 50).join(","),
      });
      result.items.forEach((v) => videos.set(v.id, v));
    }
  const unique = new Set<string>();
  const preview: ImportPreview = {
    title: metadata.snippet.title,
    description: metadata.snippet.description || "",
    channel_name: metadata.snippet.channelTitle || "",
    thumbnail_url:
      metadata.snippet.thumbnails?.high?.url ||
      metadata.snippet.thumbnails?.medium?.url ||
      "",
    youtube_playlist_id: parsed.type === "playlist" ? parsed.id : null,
    videos: playlistItems
      .sort((a, b) => (a.snippet.position || 0) - (b.snippet.position || 0))
      .filter((item) => {
        const id = item.snippet.resourceId?.videoId;
        if (!id || unique.has(id)) return false;
        unique.add(id);
        return true;
      })
      .map((item, position) => {
        const id = item.snippet.resourceId!.videoId;
        const video = videos.get(id);
        return {
          youtube_video_id: id,
          title: video?.snippet.title || item.snippet.title,
          description: video?.snippet.description || "",
          thumbnail_url: video?.snippet.thumbnails?.medium?.url || "",
          duration_seconds: parseDuration(
            video?.contentDetails?.duration || "",
          ),
          position,
          availability_status:
            video &&
            video.status?.embeddable !== false &&
            video.status?.privacyStatus !== "private"
              ? "available"
              : "unavailable",
        };
      }),
  };
  if (!preview.videos.some((v) => v.availability_status === "available"))
    throw new YouTubeError(
      "This playlist has no available embeddable videos.",
      400,
    );
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 10 * 60 * 1000, data: preview });
  return preview;
}
