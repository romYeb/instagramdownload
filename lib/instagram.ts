import axios from "axios";
import type { InstagramProfile, InstagramMedia, MediaType } from "@/types/instagram";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function makeHeaders(): Record<string, string> {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  const csrfToken = process.env.INSTAGRAM_CSRF_TOKEN ?? "missing";

  const cookieParts = [`csrftoken=${csrfToken}`];
  if (sessionId) cookieParts.push(`sessionid=${sessionId}`);

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
    "X-CSRFToken": csrfToken,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    Cookie: cookieParts.join("; "),
  };
}

// Parse PROXY_URL env var (format: http://user:pass@host:port)
function getProxyConfig() {
  const raw = process.env.PROXY_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol.replace(":", "") as "http" | "https",
      host: u.hostname,
      port: parseInt(u.port || "80"),
      ...(u.username ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } } : {}),
    };
  } catch {
    return undefined;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function igGet(url: string, retries = 2): Promise<any> {
  const proxy = getProxyConfig();
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt);
    try {
      const res = await axios.get(url, {
        headers: makeHeaders(),
        proxy: proxy ?? false,
        timeout: 15000,
        validateStatus: () => true,
      });
      if (res.status === 429 && attempt < retries) continue;
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res.data;
    } catch (e) {
      if (attempt === retries) throw e;
    }
  }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children = item.carousel_media?.map((child: any) => ({
    id: child.id || child.pk,
    type: child.media_type === 2 ? "video" : "image",
    url: child.image_versions2?.candidates?.[0]?.url || "",
    thumbnail_url: child.image_versions2?.candidates?.[0]?.url || "",
    video_url: child.video_versions?.[0]?.url,
    dimensions: child.original_width
      ? { width: child.original_width, height: child.original_height }
      : undefined,
  }));

  return {
    id: String(item.pk || item.id),
    shortcode: item.code || item.shortcode || "",
    type,
    url,
    thumbnail_url: url,
    video_url: item.video_versions?.[0]?.url,
    caption: item.caption?.text,
    timestamp: item.taken_at,
    like_count: item.like_count ?? 0,
    comment_count: item.comment_count ?? 0,
    children,
    dimensions: item.original_width
      ? { width: item.original_width, height: item.original_height }
      : undefined,
    duration: item.video_duration,
    is_reel: type === "reel",
  };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

async function fetchViaWebProfileInfo(username: string): Promise<InstagramProfile> {
  const data = await igGet(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
  );
  const user = data?.data?.user;
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
  const data = await igGet(
    `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`
  );
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

  try { return await fetchViaWebProfileInfo(username); }
  catch (e) { errors.push(`WebProfileInfo: ${e instanceof Error ? e.message : e}`); }

  try { return await fetchViaGraphQLLegacy(username); }
  catch (e) { errors.push(`GraphQL: ${e instanceof Error ? e.message : e}`); }

  throw new Error(`Unable to fetch Instagram profile for @${username}. Details: ${errors.join("; ")}`);
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PageResult {
  media: InstagramMedia[];
  has_next_page: boolean;
  end_cursor?: string;
}

// ─── Helpers pagination ────────────────────────────────────────────────────────

function checkAuthError(data: unknown): void {
  const d = data as Record<string, unknown>;
  if (d?.message === "login_required" || d?.require_login || d?.login_required) {
    throw new Error("INSTAGRAM_AUTH_EXPIRED: session expirée — mettez à jour INSTAGRAM_SESSION_ID et INSTAGRAM_CSRF_TOKEN dans Vercel");
  }
}

// Cursor GraphQL (base64 alphanumérique) vs max_id numérique Instagram
function isGraphQLCursor(cursor: string): boolean {
  // Les curseurs GraphQL sont des chaînes base64 qui encodent des identifiants opaques
  // Les max_id sont des entiers (timestamp) : "1234567890123456789" ou "1234_528817151"
  return !/^\d{10,}(_\d+)?$/.test(cursor);
}

async function fetchNextPageViaGraphQL(userId: string, cursor: string): Promise<PageResult> {
  const variables = JSON.stringify({ id: userId, first: 12, after: cursor });

  // Essayer plusieurs query_hash / doc_id connus (Instagram les change parfois)
  const endpoints = [
    `https://www.instagram.com/graphql/query/?query_hash=8c2a529969ee035a5063f2fc8602a0fd&variables=${encodeURIComponent(variables)}`,
    `https://www.instagram.com/graphql/query/?doc_id=17888483320059182&variables=${encodeURIComponent(variables)}`,
    `https://www.instagram.com/graphql/query/?query_hash=42323d64886122307be10013ad2dcc44&variables=${encodeURIComponent(variables)}`,
  ];

  const subErrors: string[] = [];
  for (const url of endpoints) {
    try {
      const data = await igGet(url);
      checkAuthError(data);

      const timeline = data?.data?.user?.edge_owner_to_timeline_media;
      if (!timeline) {
        subErrors.push(`no timeline (body=${JSON.stringify(data).slice(0, 120)})`);
        continue; // essayer le prochain endpoint
      }

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        media: timeline.edges.map((e: any) => parseMediaNode(e.node)),
        has_next_page: timeline.page_info.has_next_page ?? false,
        end_cursor: timeline.page_info.end_cursor,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("INSTAGRAM_AUTH_EXPIRED")) throw e;
      subErrors.push(msg);
    }
  }
  throw new Error(`GraphQL: ${subErrors.join(" | ")}`);
}

async function fetchNextPageViaUserFeed(userId: string, cursor: string): Promise<PageResult> {
  // L'API feed/user attend un max_id numérique.
  // Si le cursor est un cursor GraphQL base64, on l'utilise quand même — Instagram
  // l'accepte parfois comme max_id (comportement non documenté).
  const data = await igGet(
    `https://www.instagram.com/api/v1/feed/user/${userId}/?count=12&max_id=${encodeURIComponent(cursor)}`
  );
  checkAuthError(data);

  if (!Array.isArray(data?.items)) {
    throw new Error(`feed/user: no items — body: ${JSON.stringify(data).slice(0, 200)}`);
  }
  if (data.items.length === 0 && !data.more_available) {
    // Probablement une réponse vide car max_id format incompatible
    throw new Error(`feed/user: 0 items retournés (cursor format probablement incompatible)`);
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: data.items.map((item: any) => parseFeedItem(item)),
    has_next_page: data.more_available ?? false,
    end_cursor: data.next_max_id,
  };
}

/**
 * Fallback : recharge la première page sans cursor, retourne le reste.
 * Utilisé quand le cursor est incompatible avec les endpoints disponibles.
 * Perd la position dans la liste (repart du début) mais évite le 503.
 */
async function fetchNextPageFallback(userId: string): Promise<PageResult> {
  const data = await igGet(
    `https://www.instagram.com/api/v1/feed/user/${userId}/?count=12`
  );
  checkAuthError(data);

  if (!Array.isArray(data?.items)) {
    throw new Error(`fallback feed/user: no items`);
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: data.items.map((item: any) => parseFeedItem(item)),
    has_next_page: data.more_available ?? false,
    end_cursor: data.next_max_id,
  };
}

export async function fetchNextPage(userId: string, cursor: string): Promise<PageResult> {
  const errors: string[] = [];
  const cursorIsGraphQL = isGraphQLCursor(cursor);

  // Stratégie 1 : GraphQL (même format que le cursor initial web_profile_info)
  if (cursorIsGraphQL) {
    try { return await fetchNextPageViaGraphQL(userId, cursor); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`GraphQL: ${msg}`);
      if (msg.startsWith("INSTAGRAM_AUTH_EXPIRED")) throw e;
    }
  }

  // Stratégie 2 : feed/user avec max_id (fonctionne si cursor est numérique)
  try { return await fetchNextPageViaUserFeed(userId, cursor); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`feed/user: ${msg}`);
    if (msg.startsWith("INSTAGRAM_AUTH_EXPIRED")) throw e;
  }

  // Stratégie 3 : fallback sans cursor (repart du début) — garantit de ne pas rester bloqué
  try { return await fetchNextPageFallback(userId); }
  catch (e) { errors.push(`fallback: ${e instanceof Error ? e.message : e}`); }

  throw new Error(`Pagination Instagram échouée: ${errors.join(" | ")}`);
}
