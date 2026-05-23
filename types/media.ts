/**
 * types/media.ts
 * ─────────────────────────────────────────────────────────────
 * Types unifiés communs à toutes les plateformes.
 * Instagram et TikTok retournent EXACTEMENT ce format en interne.
 */

export type PlatformType = "instagram" | "tiktok";

export type UnifiedMediaType = "image" | "video" | "carousel" | "reel";

// ─── Utilisateur / Auteur ─────────────────────────────────────────────────────

export interface UnifiedUser {
  id: string;
  platform: PlatformType;
  username: string;
  display_name: string;
  biography?: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  media_count?: number;
  is_private?: boolean;
  is_verified?: boolean;
  /** URL du profil sur la plateforme d'origine */
  profile_url: string;
  external_url?: string | null;
  category?: string;
}

// ─── Média enfant (pour les carrousels / slideshows) ─────────────────────────

export interface UnifiedMediaChild {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnail_url?: string;
  video_url?: string;
  dimensions?: { width: number; height: number };
}

// ─── Média principal ──────────────────────────────────────────────────────────

export interface UnifiedMedia {
  id: string;
  platform: PlatformType;
  shortcode?: string;
  type: UnifiedMediaType;
  /** URL principale (image HD ou vidéo) */
  url: string;
  thumbnail_url?: string;
  video_url?: string;
  caption?: string;
  /** Nom d'affichage de l'auteur (utile pour TikTok) */
  author?: string;
  /** Titre de la musique (TikTok) */
  music?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  timestamp?: number;
  children?: UnifiedMediaChild[];
  dimensions?: { width: number; height: number };
  duration?: number;
  is_reel?: boolean;
}

// ─── Profil complet retourné par l'API ───────────────────────────────────────

export interface UnifiedProfile {
  platform: PlatformType;
  user: UnifiedUser;
  media: UnifiedMedia[];
  has_next_page: boolean;
  end_cursor?: string;
  total_count?: number;
  /**
   * Si true : le profil a été chargé via scraping HTML car l'API vidéo
   * (tikwm.com) est temporairement indisponible. Les vidéos ne sont pas là
   * mais le profil utilisateur est valide.
   */
  api_unavailable?: boolean;
}

// ─── Item de téléchargement ───────────────────────────────────────────────────

export interface UnifiedDownloadItem {
  id: string;
  mediaId: string;
  platform: PlatformType;
  url: string;
  filename: string;
  type: UnifiedMediaType;
  status: "pending" | "downloading" | "done" | "error";
  progress: number;
  blob?: Blob;
}

// ─── Historique ───────────────────────────────────────────────────────────────

export interface UnifiedDownloadHistory {
  id: string;
  platform: PlatformType;
  username: string;
  display_name?: string;
  avatar_url?: string;
  follower_count?: number;
  media_count: number;
  downloaded_at: string;
  session_id: string;
}

// ─── Codes d'erreur unifiés ───────────────────────────────────────────────────

export type AppErrorCode =
  | "PLATFORM_NOT_SUPPORTED"
  | "INVALID_URL"
  | "PRIVATE_CONTENT"
  | "MEDIA_NOT_FOUND"
  | "RATE_LIMIT"
  | "FETCH_ERROR"
  | "PAGINATION_ERROR"
  | "PROXY_ERROR";
