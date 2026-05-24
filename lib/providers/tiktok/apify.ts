/**
 * lib/providers/tiktok/apify.ts
 * ─────────────────────────────────────────────────────────────
 * Provider TikTok via Apify — contourne complètement le blocage TikTok.
 *
 * Utilise l'acteur "clockworks/tiktok-profile-scraper" qui tourne
 * avec un vrai navigateur Chromium stealth sur des IPs résidentielles.
 *
 * Env requis : APIFY_API_TOKEN
 *
 * API Apify utilisée :
 *   POST /v2/acts/{actor}/run-sync-get-dataset-items
 *   → bloque jusqu'à la fin du run, retourne les items directement
 */

import type {
  UnifiedProfile,
  UnifiedMedia,
  UnifiedUser,
  UnifiedMediaChild,
  UnifiedMediaType,
} from "@/types/media";

// ─── Config ───────────────────────────────────────────────────────────────────

const APIFY_TOKEN  = process.env.APIFY_API_TOKEN ?? "";
const ACTOR_ID     = "clockworks~tiktok-profile-scraper";
const ITEMS_PER_PAGE = 30;
// Timeout Apify côté serveur (secondes) + 30s de marge côté fetch
const APIFY_RUN_TIMEOUT_S  = 120;
const FETCH_TIMEOUT_MS     = (APIFY_RUN_TIMEOUT_S + 30) * 1000;

// ─── Types bruts Apify ────────────────────────────────────────────────────────

interface ApifyAuthorMeta {
  id?: string;
  name?: string;
  nickName?: string;
  verified?: boolean;
  signature?: string;
  avatar?: string;
  fans?: number;
  heart?: number;
  video?: number;       // nombre total de vidéos du profil
  following?: number;
  profileUrl?: string;
}

interface ApifyVideoMeta {
  height?: number;
  width?: number;
  duration?: number;
  coverUrl?: string;
  originalCoverUrl?: string;
  definition?: string;
}

interface ApifyMusicMeta {
  musicName?: string;
  musicAuthor?: string;
  musicId?: string;
  musicUrl?: string;
  coverMediumUrl?: string;
}

interface ApifyTikTokItem {
  id: string;
  text?: string;
  createTime?: number;
  createTimeISO?: string;
  authorMeta?: ApifyAuthorMeta;
  videoMeta?: ApifyVideoMeta;
  diggCount?: number;
  shareCount?: number;
  playCount?: number;
  commentCount?: number;
  musicMeta?: ApifyMusicMeta;
  // Vidéo
  webVideoUrl?: string;
  videoUrl?: string;
  videoUrlNoWatermark?: string;
  // Slideshow
  isSlideshow?: boolean;
  slideshowImages?: string[];
  imageUrl?: string | string[] | null;
}

// ─── Appel Apify ─────────────────────────────────────────────────────────────

/**
 * Charge jusqu'à `limit` vidéos d'un profil TikTok via Apify.
 * @param username  Username TikTok (sans @)
 * @param offset    Nombre de vidéos à sauter (pour la pagination)
 * @param limit     Nombre de vidéos à récupérer
 */
export async function fetchTikTokProfileViaApify(
  username: string,
  offset = 0,
  limit  = ITEMS_PER_PAGE
): Promise<UnifiedProfile> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_API_TOKEN non défini — ajoutez-le dans les variables d'environnement Vercel");
  }

  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;

  // On récupère offset+limit pour pouvoir ignorer les `offset` premiers
  const resultsToFetch = offset + limit;

  const input = {
    profiles: [profileUrl],
    resultsPerPage: resultsToFetch,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  };

  const apiUrl =
    `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items` +
    `?token=${APIFY_TOKEN}&timeout=${APIFY_RUN_TIMEOUT_S}&memory=1024`;

  const r = await fetch(apiUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(input),
    signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Apify HTTP ${r.status}: ${txt.slice(0, 300)}`);
  }

  const allItems = (await r.json()) as ApifyTikTokItem[];

  if (!Array.isArray(allItems) || allItems.length === 0) {
    throw new Error(`Apify: aucun résultat pour @${username}. Profil privé ou introuvable.`);
  }

  // Appliquer la pagination en mémoire
  const pageItems = allItems.slice(offset, offset + limit);

  // Infos profil depuis le 1er item
  const firstItem   = allItems[0];
  const authorMeta  = firstItem.authorMeta ?? {};
  const totalVideos = authorMeta.video ?? allItems.length;

  const user: UnifiedUser = {
    id:             authorMeta.id ?? username,
    platform:       "tiktok",
    username:       authorMeta.name ?? username,
    display_name:   authorMeta.nickName ?? authorMeta.name ?? username,
    biography:      authorMeta.signature,
    avatar_url:     authorMeta.avatar,
    follower_count: authorMeta.fans,
    following_count: authorMeta.following,
    media_count:    totalVideos,
    is_private:     false,
    is_verified:    authorMeta.verified ?? false,
    profile_url:    `https://www.tiktok.com/@${authorMeta.name ?? username}`,
  };

  const media = pageItems.map(parseApifyItem);

  const nextOffset  = offset + limit;
  const hasNextPage = nextOffset < totalVideos && pageItems.length === limit;

  return {
    platform:      "tiktok",
    user,
    media,
    has_next_page: hasNextPage,
    end_cursor:    hasNextPage ? String(nextOffset) : undefined,
    total_count:   totalVideos,
  };
}

/**
 * Charge la page suivante pour un profil déjà chargé.
 * L'`end_cursor` est l'offset numérique de la prochaine page.
 */
export async function fetchTikTokNextPageViaApify(
  username: string,
  offset: number
): Promise<{ platform: "tiktok"; media: UnifiedMedia[]; has_next_page: boolean; end_cursor?: string }> {
  const profile = await fetchTikTokProfileViaApify(username, offset, ITEMS_PER_PAGE);
  return {
    platform:      "tiktok",
    media:         profile.media,
    has_next_page: profile.has_next_page,
    end_cursor:    profile.end_cursor,
  };
}

// ─── Parser item Apify → UnifiedMedia ────────────────────────────────────────

function parseApifyItem(item: ApifyTikTokItem): UnifiedMedia {
  // Détecter slideshow
  const slideshowUrls: string[] =
    item.slideshowImages ??
    (Array.isArray(item.imageUrl) ? item.imageUrl : []);
  const isSlideshow = (item.isSlideshow === true) || slideshowUrls.length > 0;
  const mediaType: UnifiedMediaType = isSlideshow ? "carousel" : "video";

  let children: UnifiedMediaChild[] | undefined;
  if (isSlideshow && slideshowUrls.length > 0) {
    children = slideshowUrls.map((url, i) => ({
      id:            `${item.id}_slide_${i}`,
      type:          "image" as const,
      url,
      thumbnail_url: url,
    }));
  }

  // URL vidéo (sans watermark en priorité)
  const videoUrl =
    item.videoUrlNoWatermark ||
    item.videoUrl ||
    item.webVideoUrl ||
    "";

  const cover = item.videoMeta?.originalCoverUrl || item.videoMeta?.coverUrl;

  // Musique
  let music: string | undefined;
  if (item.musicMeta?.musicName) {
    music = item.musicMeta.musicAuthor
      ? `${item.musicMeta.musicName} — ${item.musicMeta.musicAuthor}`
      : item.musicMeta.musicName;
  }

  return {
    id:            item.id,
    platform:      "tiktok",
    type:          mediaType,
    url:           isSlideshow ? (children?.[0]?.url ?? cover ?? "") : videoUrl,
    thumbnail_url: cover,
    video_url:     isSlideshow ? undefined : videoUrl || undefined,
    caption:       item.text || undefined,
    author:        item.authorMeta?.nickName ?? item.authorMeta?.name,
    music,
    like_count:    item.diggCount,
    comment_count: item.commentCount,
    share_count:   item.shareCount,
    view_count:    item.playCount,
    timestamp:     item.createTime,
    duration:      item.videoMeta?.duration,
    dimensions:
      item.videoMeta?.width && item.videoMeta?.height
        ? { width: item.videoMeta.width, height: item.videoMeta.height }
        : undefined,
    children,
  };
}

// ─── Guard : Apify est-il configuré ? ────────────────────────────────────────

export function isApifyConfigured(): boolean {
  return !!APIFY_TOKEN;
}
