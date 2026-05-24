/**
 * lib/utils/filename.ts
 * ─────────────────────────────────────────────────────────────
 * Système centralisé de nommage des fichiers téléchargés.
 *
 * Compatible : macOS · Windows · Android · iPhone
 * Supporte   : accents · caractères français · UTF-8
 * Évite      : caractères interdits · emojis · noms trop longs
 */

import type { UnifiedMedia, PlatformType } from "@/types/media";

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Longueur max de la partie caption dans le nom (avant id/username). */
const MAX_CAPTION_CHARS = 55;

/** Longueur max du nom de fichier complet (sans extension). */
const MAX_BASE_LENGTH = 80;

/**
 * Caractères interdits sur au moins une plateforme :
 * - Windows : \ / : * ? " < > |
 * - POSIX   : / et octet nul
 * - HTTP    : # % & + = ~ ^
 * - Shell   : ! ` $ { } [ ] ; , @ '
 */
const FORBIDDEN_RE = /[\\/:*?"<>|#%&+={}\[\]$!`~^;,'@\x00-\x1f]/g;

/**
 * Emojis Unicode — on les retire car Windows ne les supporte pas tous
 * et iOS peut créer des problèmes avec certains caractères composés.
 * Couvre : Emoticons, Misc Symbols, Transport, Supplemental, Flags, etc.
 */
const EMOJI_RE = new RegExp(
  "[\u{1F600}-\u{1F64F}]|" +  // Emoticons
  "[\u{1F300}-\u{1F5FF}]|" +  // Misc Symbols & Pictographs
  "[\u{1F680}-\u{1F6FF}]|" +  // Transport & Map
  "[\u{1F700}-\u{1F77F}]|" +  // Alchemical
  "[\u{1F780}-\u{1F7FF}]|" +  // Geometric
  "[\u{1F800}-\u{1F8FF}]|" +  // Supplemental Arrows
  "[\u{1F900}-\u{1F9FF}]|" +  // Supplemental Symbols
  "[\u{1FA00}-\u{1FA6F}]|" +  // Chess Symbols
  "[\u{1FA70}-\u{1FAFF}]|" +  // Symbols Extended-A
  "[\u{2600}-\u{26FF}]|" +    // Misc Symbols
  "[\u{2700}-\u{27BF}]|" +    // Dingbats
  "[\u{FE00}-\u{FE0F}]|" +    // Variation Selectors
  "[\u{1F1E0}-\u{1F1FF}]",    // Flags
  "gu"
);

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

/**
 * Nettoie une chaîne pour en faire un segment valide de nom de fichier.
 *
 * Règles appliquées :
 *  1. Supprime les emojis
 *  2. Supprime les caractères interdits (Windows + POSIX + HTTP)
 *  3. Supprime les points en début/fin (Windows les rejette)
 *  4. Normalise les espaces multiples → espace simple
 *  5. Limite à `maxLength` caractères en coupant au dernier mot
 *  6. Fallback "media" si vide après nettoyage
 *
 * @param text      Texte brut (caption, titre, etc.)
 * @param maxLength Longueur max du résultat (défaut : MAX_CAPTION_CHARS)
 */
export function sanitizeFilename(
  text: string,
  maxLength = MAX_CAPTION_CHARS
): string {
  let s = text
    .replace(EMOJI_RE, "")
    .replace(FORBIDDEN_RE, "")
    .replace(/^\.+|\.+$/g, "")   // points en début/fin
    .replace(/\s+/g, " ")
    .trim();

  if (s.length > maxLength) {
    const truncated = s.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    // Couper au dernier espace si > 40% de la longueur max (évite les coupes au 1er mot)
    s = (lastSpace > maxLength * 0.4 ? truncated.slice(0, lastSpace) : truncated).trim();
  }

  return s || "media";
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

/** Extrait les 6 derniers chiffres de l'ID pour le suffixe. */
function shortId(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(-6);
  // ID non-numérique (Instagram shortcode, etc.) → prendre les 8 premiers chars
  return id.slice(0, 8).replace(FORBIDDEN_RE, "");
}

/** Détermine l'extension selon le type de média et éventuellement le MIME type. */
function getExt(mediaType: string, mimeType?: string): string {
  if (mimeType) {
    if (mimeType.includes("mp4"))  return "mp4";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("png"))  return "png";
    if (mimeType.includes("jpg") || mimeType.includes("jpeg")) return "jpg";
  }
  switch (mediaType) {
    case "video":
    case "reel":
      return "mp4";
    case "carousel":
    case "image":
    case "photo":
    default:
      return "jpg";
  }
}

/**
 * Extrait et nettoie la caption d'un UnifiedMedia.
 * TikTok  → media.caption (= item.desc ou item.text)
 * Instagram → media.caption (= caption.text)
 */
function extractCaption(media: UnifiedMedia): string {
  const raw = (media.caption ?? "").trim();
  return raw ? sanitizeFilename(raw, MAX_CAPTION_CHARS) : "";
}

/** Assemble les parts en un nom de base limité à MAX_BASE_LENGTH. */
function assembleName(parts: string[]): string {
  // Filtrer les parties vides
  const filled = parts.filter(Boolean);
  let base = filled.join("_");
  if (base.length > MAX_BASE_LENGTH) {
    base = base.slice(0, MAX_BASE_LENGTH).replace(/_+$/, "").trim();
  }
  return base || "media";
}

// ─── generateMediaFilename ────────────────────────────────────────────────────

/**
 * Génère le nom de fichier final pour un média téléchargé.
 *
 * Format avec caption :
 *   TikTok_MaRoutineMatin_lyvirestyle_728819.mp4
 *   Instagram_LookRougeTabaski_nasa_aB3c12.jpg
 *
 * Format sans caption (fallback) :
 *   TikTok_lyvirestyle_728819.mp4
 *   Instagram_nasa_aB3c12.jpg
 *
 * @param media     Objet UnifiedMedia
 * @param platform  "tiktok" | "instagram"
 * @param username  Handle de l'auteur (sans @)
 * @param mimeType  MIME type optionnel pour choisir l'extension précise
 */
export function generateMediaFilename(
  media: UnifiedMedia,
  platform: PlatformType,
  username: string,
  mimeType?: string
): string {
  const prefix  = platform === "tiktok" ? "TikTok" : "Instagram";
  const caption = extractCaption(media);
  const id      = shortId(media.id);
  const ext     = getExt(media.type, mimeType);

  const base = assembleName(
    caption
      ? [prefix, caption, username, id]
      : [prefix, username, id]
  );

  return `${base}.${ext}`;
}

// ─── generateCarouselFilename ─────────────────────────────────────────────────

/**
 * Génère le nom de fichier pour une slide individuelle d'un carousel / slideshow.
 *
 * Format :
 *   TikTok_SummerVibes_lyvirestyle_728819_01.jpg
 *   Instagram_LookRouge_nasa_aB3c12_03.jpg
 *
 * @param media       Objet UnifiedMedia du carousel parent
 * @param platform    "tiktok" | "instagram"
 * @param username    Handle de l'auteur
 * @param slideIndex  Index de la slide (1-based)
 * @param slideType   "image" | "video" (pour certains carousel vidéo)
 * @param mimeType    MIME type optionnel
 */
export function generateCarouselFilename(
  media: UnifiedMedia,
  platform: PlatformType,
  username: string,
  slideIndex: number,
  slideType: "image" | "video" = "image",
  mimeType?: string
): string {
  const prefix  = platform === "tiktok" ? "TikTok" : "Instagram";
  const caption = extractCaption(media);
  const id      = shortId(media.id);
  const idx     = String(slideIndex).padStart(2, "0");
  const ext     = getExt(slideType, mimeType);

  const base = assembleName(
    caption
      ? [prefix, caption, username, id, idx]
      : [prefix, username, id, idx]
  );

  return `${base}.${ext}`;
}

// ─── generateZipFilename ──────────────────────────────────────────────────────

/**
 * Génère le nom du fichier ZIP global.
 *
 * Format : lyvirestyle_tiktok_2026-05-24.zip
 */
export function generateZipFilename(platform: PlatformType, username: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${username}_${platform}_${date}.zip`;
}

// ─── encodeContentDisposition ────────────────────────────────────────────────

/**
 * Encode le nom de fichier pour le header HTTP Content-Disposition.
 *
 * Utilise RFC 5987 (filename*=UTF-8'') pour supporter les accents
 * et caractères non-ASCII sur tous les navigateurs modernes.
 *
 * @returns La valeur complète du header Content-Disposition
 *
 * @example
 *   encodeContentDisposition("TikTok_MaRoutinéMatin.mp4")
 *   // → "attachment; filename=\"TikTok_MaRoutine_Matin.mp4\"; filename*=UTF-8''TikTok_MaRoutin%C3%A9Matin.mp4"
 */
export function encodeContentDisposition(filename: string): string {
  // Fallback ASCII : remplace les non-ASCII par leur équivalent latin simple
  const ascii = filename
    .normalize("NFD")                    // décompose é → e + ́
    .replace(/[̀-ͯ]/g, "")    // supprime les diacritiques
    .replace(/[^\x20-\x7E]/g, "_")      // remplace tout non-ASCII par _
    .replace(/\s+/g, "_");

  // RFC 5987 : percent-encode tout
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  // Double header : filename= pour compatibilité, filename*= pour UTF-8
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
