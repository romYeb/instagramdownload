/**
 * lib/providers/tiktok/parser.ts
 * ─────────────────────────────────────────────────────────────
 * Parsers : transforme les réponses brutes tikwm.com/TikTok
 * en types UnifiedProfile / UnifiedMedia.
 */

import type {
  TikWmVideo,
  TikWmPostItem,
  TikWmUserFull,
  TikTokOEmbedResponse,
  TikTokAwemeItem,
} from "@/types/tiktok";
import type {
  UnifiedProfile,
  UnifiedMedia,
  UnifiedUser,
  UnifiedMediaChild,
  UnifiedMediaType,
} from "@/types/media";

// ─── Helper : normalise l'ID d'un post ───────────────────────────────────────

function resolveId(post: TikWmVideo | TikWmPostItem): string {
  return String(post.id ?? post.video_id ?? Date.now());
}

// ─── Parser d'un post individuel (vidéo ou slideshow) ────────────────────────

/**
 * Convertit un TikWmPostItem (ou TikWmVideo) en UnifiedMedia.
 * Exporté pour être utilisé par la pagination.
 */
export function parseTikWmPostItem(post: TikWmPostItem): UnifiedMedia {
  const id = resolveId(post);
  const isSlideshow = Array.isArray(post.images) && (post.images?.length ?? 0) > 0;
  const mediaType: UnifiedMediaType = isSlideshow ? "carousel" : "video";

  let children: UnifiedMediaChild[] | undefined;
  if (isSlideshow && post.images) {
    children = post.images.map((imgUrl, i) => ({
      id: `${id}_slide_${i}`,
      type: "image" as const,
      url: imgUrl,
      thumbnail_url: imgUrl,
    }));
  }

  // Priorité : hdplay > play > wmplay
  const videoUrl = post.hdplay ?? post.play ?? post.wmplay ?? "";

  return {
    id,
    platform: "tiktok",
    type: mediaType,
    url: isSlideshow ? (post.images![0] ?? post.cover) : videoUrl,
    thumbnail_url: post.origin_cover || post.cover || undefined,
    video_url: isSlideshow ? undefined : videoUrl || undefined,
    caption: post.title || undefined,
    author: post.author?.nickname || post.author?.unique_id || undefined,
    music: post.music_info
      ? `${post.music_info.title} — ${post.music_info.author}`.trim()
      : undefined,
    like_count: post.statistics?.digg_count ?? 0,
    comment_count: post.statistics?.comment_count ?? 0,
    share_count: post.statistics?.share_count ?? 0,
    view_count: post.statistics?.play_count ?? 0,
    timestamp: post.create_time,
    duration: isSlideshow ? undefined : post.duration,
    children,
    is_reel: false,
  };
}

// ─── Parser profil complet (user info + liste de posts) ───────────────────────

/**
 * Construit un UnifiedProfile depuis les données profil tikwm.com.
 * Utilisé pour la première page ET la pagination.
 */
export function parseTikWmProfileToUnified(
  userInfo: TikWmUserFull,
  posts: TikWmPostItem[],
  nextCursor: number,
  hasMore: boolean
): UnifiedProfile {
  const user: UnifiedUser = {
    id: userInfo.id || userInfo.unique_id,
    platform: "tiktok",
    username: userInfo.unique_id,
    display_name: userInfo.nickname || userInfo.unique_id,
    biography: userInfo.signature,
    avatar_url: userInfo.avatar_larger ?? userInfo.avatar,
    follower_count: userInfo.follower_count,
    following_count: userInfo.following_count,
    media_count: userInfo.aweme_count,
    is_private: false, // tikwm ne retourne pas les comptes privés
    is_verified: userInfo.verified ?? false,
    profile_url: `https://www.tiktok.com/@${userInfo.unique_id}`,
  };

  return {
    platform: "tiktok",
    user,
    media: posts.map(parseTikWmPostItem),
    has_next_page: hasMore,
    end_cursor: hasMore ? String(nextCursor) : undefined,
    total_count: userInfo.aweme_count ?? posts.length,
  };
}

// ─── Parser vidéo unique → "profil" mono-post ────────────────────────────────

/**
 * Convertit la réponse tikwm single-video en UnifiedProfile.
 * L'auteur de la vidéo devient le "profil".
 */
export function parseTikWmToProfile(data: TikWmVideo): UnifiedProfile {
  const user: UnifiedUser = {
    id: data.author.id || data.author.unique_id,
    platform: "tiktok",
    username: data.author.unique_id,
    display_name: data.author.nickname || data.author.unique_id,
    avatar_url: data.author.avatar,
    follower_count: data.author.follower_count,
    following_count: data.author.following_count,
    profile_url: `https://www.tiktok.com/@${data.author.unique_id}`,
    is_private: false,
    is_verified: false,
  };

  return {
    platform: "tiktok",
    user,
    media: [parseTikWmPostItem(data)],
    has_next_page: false,
    total_count: 1,
  };
}

// ─── Fallback oEmbed → profil minimal ────────────────────────────────────────

export function parseOEmbedToProfile(
  data: TikTokOEmbedResponse,
  originalUrl: string
): UnifiedProfile {
  const usernameMatch = data.author_url?.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
  const username = usernameMatch ? usernameMatch[1] : "unknown";
  const idMatch = originalUrl.match(/video\/(\d+)/);
  const videoId = idMatch ? idMatch[1] : String(Date.now());

  const user: UnifiedUser = {
    id: username,
    platform: "tiktok",
    username,
    display_name: data.author_name || username,
    avatar_url: data.thumbnail_url,
    profile_url: data.author_url || `https://www.tiktok.com/@${username}`,
    is_private: false,
    is_verified: false,
  };

  return {
    platform: "tiktok",
    user,
    media: [{
      id: videoId,
      platform: "tiktok",
      type: "video",
      url: data.thumbnail_url,
      thumbnail_url: data.thumbnail_url,
      caption: data.title || undefined,
      author: data.author_name,
    }],
    has_next_page: false,
    total_count: 1,
  };
}

// ─── Parser format aweme (API mobile TikTok directe) ─────────────────────────

/**
 * Convertit un item aweme (API mobile TikTok) en UnifiedMedia.
 * Format différent de tikwm : les URLs sont dans url_list[], la durée est en ms.
 */
export function parseTikTokAwemeItem(item: TikTokAwemeItem): UnifiedMedia {
  const video = item.video;
  const stats = item.statistics ?? {};
  const music = item.music ?? {};

  // Prendre la première URL valide dans play_addr ou download_addr
  const playUrls = video.play_addr?.url_list ?? [];
  const coverUrls = video.cover?.url_list ?? video.origin_cover?.url_list ?? [];
  const videoUrl = playUrls.find((u) => u.startsWith("https")) ?? playUrls[0] ?? "";
  const thumbnailUrl = coverUrls.find((u) => u.startsWith("https")) ?? coverUrls[0];

  return {
    id: item.aweme_id,
    platform: "tiktok",
    type: "video",
    url: videoUrl,
    thumbnail_url: thumbnailUrl,
    video_url: videoUrl || undefined,
    caption: item.desc || undefined,
    author: item.author?.nickname,
    music: music.title ? `${music.title}${music.author ? ` — ${music.author}` : ""}` : undefined,
    like_count: stats.digg_count,
    comment_count: stats.comment_count,
    share_count: stats.share_count,
    view_count: stats.play_count,
    timestamp: item.create_time,
    duration: video.duration ? Math.round(video.duration / 1000) : undefined, // ms → s
    dimensions:
      video.width && video.height
        ? { width: video.width, height: video.height }
        : undefined,
  };
}

// ─── Fallback HTML parsing → profil ──────────────────────────────────────────

export function parseHtmlDataToProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  originalUrl: string
): UnifiedProfile {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemStruct: Record<string, any> =
    data?.itemStruct ??
    data?.itemInfo?.itemStruct ??
    data?.props?.pageProps?.itemInfo?.itemStruct ??
    null;

  if (!itemStruct) throw new Error("itemStruct introuvable dans la réponse HTML");

  const author = itemStruct.author ?? {};
  const stats = itemStruct.stats ?? {};
  const music = itemStruct.music ?? {};
  const video = itemStruct.video ?? {};
  const imagePost = itemStruct.imagePost ?? null;
  const username: string = author.uniqueId || author.nickname || "unknown";

  const user: UnifiedUser = {
    id: author.id || username,
    platform: "tiktok",
    username,
    display_name: author.nickname || username,
    avatar_url: author.avatarMedium || author.avatarThumb,
    follower_count: author.followerCount,
    following_count: author.followingCount,
    is_verified: !!author.verified,
    profile_url: `https://www.tiktok.com/@${username}`,
    is_private: !!author.privateAccount,
  };

  const isSlideshow = imagePost && Array.isArray(imagePost.images);
  const mediaType: UnifiedMediaType = isSlideshow ? "carousel" : "video";

  let children: UnifiedMediaChild[] | undefined;
  if (isSlideshow) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children = (imagePost.images as any[]).map((img: any, i: number) => ({
      id: `${itemStruct.id}_${i}`,
      type: "image" as const,
      url: img?.imageURL?.urlList?.[0] || "",
      thumbnail_url: img?.imageURL?.urlList?.[0] || "",
    }));
  }

  const videoUrl: string = video.playAddr || video.downloadAddr || "";
  const videoId = String(itemStruct.id || Date.now());
  const idMatch = originalUrl.match(/video\/(\d+)/);

  return {
    platform: "tiktok",
    user,
    media: [{
      id: idMatch ? idMatch[1] : videoId,
      platform: "tiktok",
      type: mediaType,
      url: isSlideshow ? (children?.[0]?.url ?? video.cover ?? "") : videoUrl,
      thumbnail_url: video.cover || video.originCover,
      video_url: isSlideshow ? undefined : videoUrl || undefined,
      caption: itemStruct.desc || undefined,
      author: author.nickname,
      music: music.title ? `${music.title} — ${music.authorName ?? ""}`.trim() : undefined,
      like_count: stats.diggCount,
      comment_count: stats.commentCount,
      share_count: stats.shareCount,
      view_count: stats.playCount,
      timestamp: itemStruct.createTime,
      duration: video.duration,
      children,
    }],
    has_next_page: false,
    total_count: 1,
  };
}
