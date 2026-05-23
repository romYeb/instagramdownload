/**
 * lib/utils/platform.ts
 * ─────────────────────────────────────────────────────────────
 * Détection de plateforme, normalisation d'URL, extraction d'identifiants.
 * Fonctions pures, sans side-effects — utilisables côté client et serveur.
 */

import type { PlatformType } from "@/types/media";
import type { TikTokUrlKind } from "@/types/tiktok";

// ─── Détection de plateforme ──────────────────────────────────────────────────

const INSTAGRAM_PATTERNS = [/instagram\.com/i, /instagr\.am/i];
const TIKTOK_PATTERNS = [/tiktok\.com/i, /vm\.tiktok\.com/i, /vt\.tiktok\.com/i, /m\.tiktok\.com/i];

/**
 * Détecte automatiquement la plateforme depuis un input (URL ou username).
 * - URL TikTok  → "tiktok"
 * - URL Instagram → "instagram"
 * - Username simple (sans /) → "instagram" (backward compat)
 * - Inconnu → null
 */
export function detectPlatform(input: string): PlatformType | null {
  const lower = input.toLowerCase().trim();
  if (TIKTOK_PATTERNS.some((p) => p.test(lower))) return "tiktok";
  if (INSTAGRAM_PATTERNS.some((p) => p.test(lower))) return "instagram";

  // Username simple → Instagram par défaut
  const clean = lower.replace(/^@/, "");
  if (!clean.includes("/") && /^[a-z0-9._]{1,30}$/.test(clean)) return "instagram";
  return null;
}

// ─── TikTok : type d'URL ──────────────────────────────────────────────────────

/**
 * Détermine précisément le type d'une URL TikTok.
 *
 * BUG CORRIGÉ : avant cette correction, les URLs de profil retournaient
 * "unknown" et étaient traitées comme des vidéos — ce qui faisait échouer
 * toutes les API et ne retournait qu'une seule vidéo via le fallback HTML.
 */
export function getTikTokUrlKind(url: string): TikTokUrlKind {
  // URLs courtes (doivent être résolues avant de savoir le vrai type)
  if (/vm\.tiktok\.com|vt\.tiktok\.com/.test(url)) return "short";

  // URL de partage
  if (/tiktok\.com\/t\//.test(url)) return "share";

  // Mobile
  if (/m\.tiktok\.com/.test(url)) return "mobile";

  // URL vidéo standard : /@username/video/ID
  if (/tiktok\.com\/@[^/?#]+\/video\/\d+/.test(url)) return "video";

  // URL de profil : /@username (avec ou sans query string)
  if (/tiktok\.com\/@[a-zA-Z0-9._]+([/?#]|$)/.test(url)) return "profile";

  return "unknown";
}

/** Alias pour backward-compat (ancien nom utilisé dans extract.ts) */
export function getTikTokUrlType(url: string): "standard" | "short" | "share" | "mobile" | "unknown" {
  const kind = getTikTokUrlKind(url);
  if (kind === "video") return "standard";
  if (kind === "profile") return "unknown"; // sera géré séparément
  return kind as "short" | "share" | "mobile" | "unknown";
}

/** Retourne true si l'URL pointe vers un profil TikTok (pas une vidéo). */
export function isTikTokProfileUrl(url: string): boolean {
  return getTikTokUrlKind(url) === "profile";
}

/** Retourne true si l'URL pointe vers une vidéo TikTok spécifique. */
export function isTikTokVideoUrl(url: string): boolean {
  const kind = getTikTokUrlKind(url);
  return kind === "video" || kind === "short" || kind === "share" || kind === "mobile";
}

// ─── TikTok : extraction d'identifiants ──────────────────────────────────────

/**
 * Extrait l'ID de vidéo TikTok depuis une URL standard.
 * @example "/@nasa/video/7182902156082165034" → "7182902156082165034"
 */
export function extractTikTokId(url: string): string | null {
  const match = url.match(/video\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extrait le @username TikTok depuis n'importe quelle URL TikTok.
 * @example "https://www.tiktok.com/@lyvirestyle?_r=1" → "lyvirestyle"
 */
export function extractTikTokUsername(url: string): string | null {
  const match = url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
  return match ? match[1] : null;
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/**
 * Extrait le username Instagram depuis un input (URL ou @username).
 */
export function extractInstagramUsername(input: string): string | null {
  input = input.trim();

  if (!input.includes("/")) {
    const clean = input.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "").toLowerCase();
    if (clean && clean.length <= 30 && clean.length >= 1) return clean;
    return null;
  }

  const RESERVED = new Set(["p", "reel", "stories", "explore", "accounts", "tv", "ar", "a", "direct"]);
  const patterns = [
    /instagram\.com\/([a-zA-Z0-9._]{1,30})\/?(?:\?|$|#)/,
    /instagram\.com\/([a-zA-Z0-9._]{1,30})$/,
    /instagram\.com\/([a-zA-Z0-9._]{1,30})\//,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const username = match[1].toLowerCase();
      if (!RESERVED.has(username)) return username;
    }
  }
  return null;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

export function normalizeUrl(input: string): string {
  input = input.trim();
  if (!input.startsWith("http") && input.includes(".")) return `https://${input}`;
  return input;
}

// ─── Nommage des fichiers ─────────────────────────────────────────────────────

export function getUnifiedFilename(
  platform: PlatformType,
  username: string,
  mediaId: string,
  type: string,
  index?: number
): string {
  const prefix = platform === "tiktok" ? "tt" : "ig";
  const ext = type === "video" || type === "reel" ? "mp4" : "jpg";
  const suffix = index !== undefined ? `_${index}` : "";
  return `${prefix}_${username}_${mediaId}${suffix}.${ext}`;
}

export function getZipFilename(platform: PlatformType, username: string): string {
  return `${username}_${platform}.zip`;
}
