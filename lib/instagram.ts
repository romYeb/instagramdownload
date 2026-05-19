import type { InstagramProfile, InstagramMedia, MediaType } from "@/types/instagram";

// Rotate user agents to reduce rate limiting
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function makeHeaders(): Record<string, string> {
  return {
    "User-Agent": randomUA(),
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: "https://www.instagram.com/",
    Origin: "https://www.instagram.com",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "198387",
    "X-IG-WWW-Claim": "0",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  const key = process.env.SCRAPER_API_KEY;

  // On Vercel (key set): route via ScraperAPI with keep_headers=true
  // so Instagram headers are forwarded through the proxy.
  // Locally (no key): fetch Instagram directly.
  const finalUrl = key
    ? `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&keep_headers=true`
    : url;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt);
    const res = await fetch(finalUrl, {
      ...options,
      headers: makeHeaders(), // always send IG headers (ScraperAPI forwards them with keep_headers=true)
      cache: "no-store",
    });
    if (res.status === 429 && attempt < retries) continue;
    return res;
  }
  throw new Error("Max retries exceeded");
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMediaNode(node: any): InstagramMedia {
  const typename: string = node.__typename || "";
  let type: MediaType = "image";

  if (typename === "GraphVideo" || node.is_video) {
    type = node.product_type === "clips" ? "reel" : "video";
  } else if (typename === "GraphSidecar") {
    type = "carousel";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children = node.edge_sidecar_to_children?.edges?.map((e: any) => {
    const child = e.node;
    return {
      id: child.id,
      type: child.is_video ? "video" : "image",
      url: child.display_url,
      thumbnail_url: child.display_url,
      video_url: child.video_url,
      dimensions: child.dimensions,
    };
  });

  return {
    id: node.id,
    shortcode: node.shortcode,
    type,
    url: node.display_url || node.thumbnail_src,
    thumbnail_url: node.thumbnail_src || node.display_url,
    video_url: node.video_url,
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text,
    timestamp: node.taken_at_timestamp,
    like_count: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0,
    comment_count: node.edge_media_to_comment?.count ?? 0,
    children,
    dimensions: node.dimensions,
    duration: node.video_duration,
    is_reel: type === "reel",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFeedItem(item: any): InstagramMedia {
  const mediaType: number = item.media_type;
  let type: MediaType = "image";

  if (mediaType === 2) {
    type = item.product_type === "clips" ? "reel" : "video";
  } else if (mediaType === 8) {
    type = "carousel";
  }

  const url =
    item.image_versions2?.candidates?.[0]?.url ||
    item.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
    "";
  const videoUrl = item.video_versions?.[0]?.url;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children = item.carousel_media?.map((child: any) => ({
    id: child.id || child.pk,
    type: child.media_type === 2 ? "video" : "image",
    url: child.image_versions2?.candidates?.[0]?.url || "",
    thumbnail_url: child.image_versions2?.candidates?.[0]?.url || "",
    video_url: child.video_versions?.[0]?.url,
    dimensions:
      child.original_width
        ? { width: child.original_width, height: child.original_height }
        : undefined,
  }));

  return {
    id: String(item.pk || item.id),
    shortcode: item.code || item.shortcode || "",
    type,
    url,
    thumbnail_url: url,
    video_url: videoUrl,
    caption: item.caption?.text,
    timestamp: item.taken_at,
    like_count: item.like_count ?? 0,
    comment_count: item.comment_count ?? 0,
    children,
    dimensions:
      item.original_width
        ? { width: item.original_width, height: item.original_height }
        : undefined,
    duration: item.video_duration,
    is_reel: type === "reel",
  };
}

// ─── First page ───────────────────────────────────────────────────────────────

async function fetchViaWebProfileInfo(username: string): Promise<InstagramProfile> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const res = await fetchWithRetry(url, {});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const user = json?.data?.user;
  if (!user) throw new Error("No user data");

  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const pageInfo = user.edge_owner_to_timeline_media?.page_info ?? {};

  return {
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      biography: user.biography,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
      follower_count: user.edge_followed_by?.count ?? 0,
      following_count: user.edge_follow?.count ?? 0,
      media_count: user.edge_owner_to_timeline_media?.count ?? 0,
      is_private: user.is_private,
      is_verified: user.is_verified,
      external_url: user.external_url,
      category: user.category_name,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: edges.map((e: any) => parseMediaNode(e.node)),
    has_next_page: pageInfo.has_next_page ?? false,
    end_cursor: pageInfo.end_cursor,
  };
}

async function fetchViaGraphQLLegacy(username: string): Promise<InstagramProfile> {
  const res = await fetchWithRetry(
    `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const user = data?.graphql?.user ?? data?.user;
  if (!user) throw new Error("No user data in GraphQL response");

  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const pageInfo = user.edge_owner_to_timeline_media?.page_info ?? {};

  return {
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      biography: user.biography,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
      follower_count: user.edge_followed_by?.count ?? 0,
      following_count: user.edge_follow?.count ?? 0,
      media_count: user.edge_owner_to_timeline_media?.count ?? 0,
      is_private: user.is_private,
      is_verified: user.is_verified,
      external_url: user.external_url,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: edges.map((e: any) => parseMediaNode(e.node)),
    has_next_page: pageInfo.has_next_page ?? false,
    end_cursor: pageInfo.end_cursor,
  };
}

export async function fetchInstagramProfile(username: string): Promise<InstagramProfile> {
  const errors: string[] = [];

  try {
    return await fetchViaWebProfileInfo(username);
  } catch (e) {
    errors.push(`WebProfileInfo: ${e instanceof Error ? e.message : e}`);
  }

  try {
    return await fetchViaGraphQLLegacy(username);
  } catch (e) {
    errors.push(`GraphQL: ${e instanceof Error ? e.message : e}`);
  }

  throw new Error(
    `Unable to fetch Instagram profile for @${username}. ` +
      `Details: ${errors.join("; ")}`
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PageResult {
  media: InstagramMedia[];
  has_next_page: boolean;
  end_cursor?: string;
}

async function fetchNextPageViaGraphQL(userId: string, cursor: string): Promise<PageResult> {
  const variables = JSON.stringify({ id: userId, first: 50, after: cursor });
  const url = `https://www.instagram.com/graphql/query/?query_hash=8c2a529969ee035a5063f2fc8602a0fd&variables=${encodeURIComponent(variables)}`;

  const res = await fetchWithRetry(url, {});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const timeline = json?.data?.user?.edge_owner_to_timeline_media;
  if (!timeline) throw new Error("No timeline data in GraphQL response");

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: timeline.edges.map((e: any) => parseMediaNode(e.node)),
    has_next_page: timeline.page_info.has_next_page ?? false,
    end_cursor: timeline.page_info.end_cursor,
  };
}

async function fetchNextPageViaUserFeed(userId: string, cursor: string): Promise<PageResult> {
  const url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=50&max_id=${encodeURIComponent(cursor)}`;

  const res = await fetchWithRetry(url, {});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json.items)) throw new Error("No items array in user feed response");

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: json.items.map((item: any) => parseFeedItem(item)),
    has_next_page: json.more_available ?? false,
    end_cursor: json.next_max_id,
  };
}

export async function fetchNextPage(userId: string, cursor: string): Promise<PageResult> {
  const errors: string[] = [];

  try {
    return await fetchNextPageViaGraphQL(userId, cursor);
  } catch (e) {
    errors.push(`GraphQL: ${e instanceof Error ? e.message : e}`);
  }

  try {
    return await fetchNextPageViaUserFeed(userId, cursor);
  } catch (e) {
    errors.push(`UserFeed: ${e instanceof Error ? e.message : e}`);
  }

  throw new Error(`Pagination failed: ${errors.join("; ")}`);
}
