/**
 * types/tiktok.ts
 * ─────────────────────────────────────────────────────────────
 * Types bruts des API TikTok via tikwm.com
 * — single video, profile info, profile posts, oEmbed.
 */

// ─── API single-video : POST https://www.tikwm.com/api/ ───────────────────────

export interface TikWmAuthor {
  id: string;
  unique_id: string;
  nickname: string;
  avatar: string;
  follower_count?: number;
  following_count?: number;
}

export interface TikWmStatistics {
  digg_count: number;
  comment_count: number;
  share_count: number;
  play_count: number;
}

export interface TikWmVideo {
  id: string;
  video_id?: string; // alias possible selon la route
  title: string;
  cover: string;
  origin_cover: string;
  duration: number;
  play: string;
  wmplay: string;
  hdplay?: string;
  size?: number;
  hd_size?: number;
  author: TikWmAuthor;
  statistics: TikWmStatistics;
  create_time: number;
  images?: string[] | null;
  music_info?: {
    title: string;
    author: string;
    play?: string;
  };
}

export interface TikWmResponse {
  code: number;
  msg: string;
  processed_time?: number;
  data: TikWmVideo;
}

// ─── API profil : GET https://www.tikwm.com/api/user/info/ ────────────────────

export interface TikWmUserFull {
  id: string;
  unique_id: string;
  nickname: string;
  avatar: string;
  avatar_larger?: string;
  signature?: string;
  verified?: boolean;
  sec_uid?: string;
  follower_count?: number;
  following_count?: number;
  aweme_count?: number;    // nb total de vidéos
  total_favorited?: number;
  region?: string;
  open_favorite?: boolean;
  commerce_user_info?: unknown;
}

export interface TikWmUserInfoResponse {
  code: number;
  msg: string;
  data: {
    user: TikWmUserFull;
  };
}

// ─── API posts : GET https://www.tikwm.com/api/user/posts ────────────────────

/** Un item de la liste de posts (structure similaire à TikWmVideo) */
export type TikWmPostItem = TikWmVideo & {
  video_id?: string;
};

export interface TikWmPostsData {
  /** Cursor pour la page suivante — peut être string ou number */
  cursor: string | number;
  /** 1 = il y a d'autres pages, 0 = fin */
  has_more: number;
  /** Liste des vidéos/posts */
  aweme_list: TikWmPostItem[];
  /** Alias éventuel selon la version de l'API */
  videos?: TikWmPostItem[];
}

export interface TikWmPostsResponse {
  code: number;
  msg: string;
  data: TikWmPostsData;
}

// ─── TikTok oEmbed ────────────────────────────────────────────────────────────

export interface TikTokOEmbedResponse {
  version: string;
  type: string;
  title: string;
  author_url: string;
  author_name: string;
  width: string;
  height: string;
  html: string;
  thumbnail_width: number;
  thumbnail_height: number;
  thumbnail_url: string;
  provider_url: string;
  provider_name: string;
}

// ─── API mobile TikTok (aweme/v1/aweme/post/) ────────────────────────────────
// Format retourné directement par l'API interne de l'app TikTok (sans tikwm)

export interface TikTokAwemeAddr {
  url_list: string[];
  width?: number;
  height?: number;
}

export interface TikTokAwemeVideo {
  play_addr: TikTokAwemeAddr;
  download_addr?: TikTokAwemeAddr;
  cover: TikTokAwemeAddr;
  origin_cover?: TikTokAwemeAddr;
  dynamic_cover?: TikTokAwemeAddr;
  duration: number;       // millisecondes
  width?: number;
  height?: number;
}

export interface TikTokAwemeAuthor {
  uid: string;
  unique_id: string;
  nickname: string;
  avatar_thumb?: TikTokAwemeAddr;
  follower_count?: number;
  following_count?: number;
  signature?: string;
  verified?: boolean;
}

export interface TikTokAwemeStatistics {
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  play_count?: number;
  collect_count?: number;
}

export interface TikTokAwemeMusic {
  id?: string;
  title?: string;
  author?: string;
}

export interface TikTokAwemeItem {
  aweme_id: string;
  desc: string;
  create_time: number;
  video: TikTokAwemeVideo;
  author: TikTokAwemeAuthor;
  statistics?: TikTokAwemeStatistics;
  music?: TikTokAwemeMusic;
}

export interface TikTokAwemePostResponse {
  status_code: number;
  status_msg?: string;
  has_more: number;         // 1 = plus de pages
  min_cursor?: number;      // timestamp de la vidéo la plus récente
  max_cursor?: number;      // timestamp de la vidéo la plus ancienne → à passer pour la page suivante
  aweme_list: TikTokAwemeItem[];
}

// ─── Types internes ───────────────────────────────────────────────────────────

export type TikTokUrlKind =
  | "profile"   // https://www.tiktok.com/@username
  | "video"     // https://www.tiktok.com/@username/video/123
  | "short"     // https://vm.tiktok.com/xxx | https://vt.tiktok.com/xxx
  | "share"     // https://www.tiktok.com/t/xxx
  | "mobile"    // https://m.tiktok.com/v/123
  | "unknown";
