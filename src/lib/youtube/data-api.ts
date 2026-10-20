const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_DURATION_SECONDS = 10 * 60;

export type YoutubeVideoDetails = {
  id: string;
  title: string;
  channel: string;
  description: string;
  duration: string;
  durationSeconds: number;
  embeddable: boolean;
  privacyStatus: string;
  ageRestricted: boolean;
};

export type VideoValidation = {
  ok: boolean;
  reasons: string[];
  details?: YoutubeVideoDetails;
};

export function parseIso8601Duration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function requireYoutubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Add it to .env (see README → YouTube Data API).",
    );
  }
  return key;
}

function getApiKey(): string {
  return requireYoutubeApiKey();
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

type SearchListResponse = {
  items?: { id?: { videoId?: string } }[];
};

type VideosListResponse = {
  items?: {
    id: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      description?: string;
    };
    status?: {
      privacyStatus?: string;
      embeddable?: boolean;
    };
    contentDetails?: {
      duration?: string;
      contentRating?: { ytRating?: string };
    };
  }[];
};

function mapVideoItem(item: NonNullable<VideosListResponse["items"]>[number]): YoutubeVideoDetails | null {
  if (!item.id) return null;
  const duration = item.contentDetails?.duration ?? "PT0S";
  const durationSeconds = parseIso8601Duration(duration);
  return {
    id: item.id,
    title: item.snippet?.title ?? "",
    channel: item.snippet?.channelTitle ?? "",
    description: item.snippet?.description ?? "",
    duration,
    durationSeconds,
    embeddable: item.status?.embeddable !== false,
    privacyStatus: item.status?.privacyStatus ?? "unknown",
    ageRestricted: item.contentDetails?.contentRating?.ytRating === "ytAgeRestricted",
  };
}

export function validateVideoDetails(details: YoutubeVideoDetails): VideoValidation {
  const reasons: string[] = [];
  if (details.privacyStatus !== "public") {
    reasons.push(`privacy is ${details.privacyStatus}`);
  }
  if (!details.embeddable) {
    reasons.push("not embeddable");
  }
  if (details.ageRestricted) {
    reasons.push("age-restricted");
  }
  if (details.durationSeconds <= 0) {
    reasons.push("missing duration");
  }
  if (details.durationSeconds > MAX_DURATION_SECONDS) {
    reasons.push(`duration ${details.durationSeconds}s exceeds 10 minutes`);
  }
  return { ok: reasons.length === 0, reasons, details };
}

export async function fetchVideoDetails(videoIds: string[]): Promise<Map<string, YoutubeVideoDetails>> {
  const unique = [...new Set(videoIds.filter(Boolean))];
  const map = new Map<string, YoutubeVideoDetails>();
  if (unique.length === 0) return map;

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const data = await youtubeGet<VideosListResponse>("videos", {
      part: "status,contentDetails,snippet",
      id: chunk.join(","),
    });
    for (const item of data.items ?? []) {
      const mapped = mapVideoItem(item);
      if (mapped) map.set(mapped.id, mapped);
    }
  }
  return map;
}

export async function validateVideoId(videoId: string): Promise<VideoValidation> {
  const map = await fetchVideoDetails([videoId]);
  const details = map.get(videoId);
  if (!details) {
    return { ok: false, reasons: ["video not found or unavailable"] };
  }
  return validateVideoDetails(details);
}

export async function searchEmbeddableVideos(
  query: string,
  videoDuration: "short" | "medium",
): Promise<string[]> {
  const data = await youtubeGet<SearchListResponse>("search", {
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    videoDuration,
    relevanceLanguage: "en",
    safeSearch: "strict",
    maxResults: "10",
  });
  return (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
}

export function buildSearchQuery(lessonTitle: string, topicTags: string[]): string {
  const tags = topicTags.filter((t) => t !== "python").join(" ");
  return `${lessonTitle} Python tutorial ${tags}`.trim();
}

export async function findCandidatesForLesson(
  lessonTitle: string,
  topicTags: string[],
): Promise<YoutubeVideoDetails[]> {
  const query = buildSearchQuery(lessonTitle, topicTags);
  let ids = await searchEmbeddableVideos(query, "short");
  if (ids.length === 0) {
    ids = await searchEmbeddableVideos(query, "medium");
  }
  const detailsMap = await fetchVideoDetails(ids);
  const ordered: YoutubeVideoDetails[] = [];
  for (const id of ids) {
    const details = detailsMap.get(id);
    if (!details) continue;
    const validation = validateVideoDetails(details);
    if (validation.ok) ordered.push(details);
  }
  return ordered;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
