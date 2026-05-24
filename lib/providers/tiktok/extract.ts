/**
 * lib/providers/tiktok/extract.ts
 * ─────────────────────────────────────────────────────────────
 * Point d'entrée du provider TikTok.
 *
 * ─── CORRECTION DU BUG PRINCIPAL ────────────────────────────
 * Avant : fetchTikTokMedia() appelait l'API single-video sur TOUTES les URLs,
 *         y compris les URLs de profil (@username) → 1 seule vidéo, aperçu cassé.
 *
 * Après : on détecte si l'URL est un profil ou une vidéo, et on appelle
 *         la bonne API tikwm.com dans chaque cas.
 *
 * Flux pour un PROFIL :
 *   1. fetchTikTokUserInfo()  → avatar, bio, stats
 *   2. fetchTikTokUserPosts() → liste paginée des vidéos
 *   → parseTikWmProfileToUnified()
 *
 * Flux pour une VIDÉO :
 *   1. fetchViaTikWm()       → vidéo + metadata
 *   2. fetchViaOEmbed()      → fallback metadata
 *   3. fetchViaHtmlParsing() → fallback HTML
 */

import {
  fetchTikTokProfileViaApify,
  fetchTikTokNextPageViaApify,
  isApifyConfigured,
} from "./apify";
import {
  resolveTikTokUrl,
  fetchViaTikWm,
  fetchViaOEmbed,
  fetchViaHtmlParsing,
  fetchTikTokUserInfo,
  fetchTikTokUserPosts,
  fetchTikTokProfileFromHtml,
  fetchTikTokVideosByUserId,
  fetchTikTokWebVideos,
} from "./api";
import {
  parseTikWmToProfile,
  parseOEmbedToProfile,
  parseHtmlDataToProfile,
  parseTikWmProfileToUnified,
  parseTikWmPostItem,
  parseTikTokAwemeItem,
  parseTikTokWebItem,
} from "./parser";
import {
  isTikTokProfileUrl,
  isTikTokVideoUrl,
  extractTikTokUsername,
  getTikTokUrlKind,
} from "@/lib/utils/platform";
import type { UnifiedProfile, UnifiedMedia } from "@/types/media";
import type { MediaProvider, PageResult } from "@/types/provider";

// ─── Cache en mémoire — évite de re-frapper l'API TikTok sur la même instance ──
// Fluid Compute (Vercel) réutilise les instances → ce cache est très efficace.
// TTL : 30 min pour les profils avec vidéos, 2 min pour les profils sans vidéos.

interface CacheEntry {
  profile: UnifiedProfile;
  expiresAt: number;
}
const _profileCache = new Map<string, CacheEntry>();
const TTL_OK  = 30 * 60 * 1000; // 30 min (profil avec vidéos)
const TTL_ERR =  2 * 60 * 1000; //  2 min (api_unavailable → réessai rapide)

// ─── Point d'entrée principal ────────────────────────────────────────────────

/**
 * Auto-détecte si l'URL est un profil ou une vidéo et route en conséquence.
 */
export async function fetchTikTokMedia(rawUrl: string): Promise<UnifiedProfile> {
  const url = rawUrl.trim();
  const kind = getTikTokUrlKind(url);

  // URLs courtes/mobiles → résoudre d'abord pour connaître le vrai type
  if (kind === "short" || kind === "share" || kind === "mobile") {
    const resolved = await resolveTikTokUrl(url);
    const resolvedKind = getTikTokUrlKind(resolved);

    if (resolvedKind === "profile") return fetchTikTokProfileByUrl(resolved);
    return fetchTikTokSingleVideo(resolved);
  }

  if (kind === "profile") return fetchTikTokProfileByUrl(url);
  if (kind === "video") return fetchTikTokSingleVideo(url);

  // "unknown" → essayer le mode profil en premier, puis vidéo
  const username = extractTikTokUsername(url);
  if (username) return fetchTikTokProfileByUsername(username);

  return fetchTikTokSingleVideo(url);
}

// ─── Flux profil ─────────────────────────────────────────────────────────────

/**
 * Extrait le username depuis l'URL de profil et délègue.
 */
async function fetchTikTokProfileByUrl(profileUrl: string): Promise<UnifiedProfile> {
  const username = extractTikTokUsername(profileUrl);
  if (!username) {
    throw new Error(`Impossible d'extraire le username TikTok depuis : ${profileUrl}`);
  }
  return fetchTikTokProfileByUsername(username);
}

/**
 * Récupère le profil complet d'un utilisateur TikTok par son username.
 * - Première page (cursor=0) : cache en mémoire (TTL 30 min avec vidéos, 2 min sans).
 * - Pagination (cursor>0)    : toujours fraîche, pas de cache.
 *
 * @param username  Le handle TikTok (sans @)
 * @param cursor    Curseur de pagination (0 = première page)
 */
export async function fetchTikTokProfileByUsername(
  username: string,
  cursor = 0
): Promise<UnifiedProfile> {
  const key = username.toLowerCase();

  // ── Stratégie 0 : Apify (si configuré) — le plus fiable ─────────────────
  // Apify utilise un vrai navigateur Chromium stealth + IPs résidentielles.
  // Contourne complètement le blocage Akamai de TikTok.
  if (isApifyConfigured()) {
    const cacheKey = `apify:${key}:${cursor}`;
    const cached   = _profileCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.profile;

    try {
      // cursor = offset numérique pour Apify (pas un timestamp)
      const offset  = cursor === 0 ? 0 : parseInt(String(cursor), 10) || 0;
      const profile = await fetchTikTokProfileViaApify(username, offset);

      _profileCache.set(cacheKey, { profile, expiresAt: Date.now() + TTL_OK });
      return profile;
    } catch (e) {
      console.warn(`[apify] Failed for @${username}:`, e instanceof Error ? e.message : e);
      // Apify a échoué → tomber sur les stratégies suivantes
    }
  }

  if (cursor === 0) {
    // Vérifier le cache
    const cached = _profileCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.profile;
    }

    // Fetch réel (stratégies HTML + API web/mobile)
    const profile = await _fetchTikTokProfileByUsername(username, 0);

    // Stocker en cache (TTL selon disponibilité des vidéos)
    const ttl = profile.api_unavailable ? TTL_ERR : TTL_OK;
    _profileCache.set(key, { profile, expiresAt: Date.now() + ttl });

    return profile;
  }

  return _fetchTikTokProfileByUsername(username, cursor);
}

/**
 * Implémentation réelle (toutes les stratégies de fetch).
 * Ne pas appeler directement — passer par fetchTikTokProfileByUsername().
 */
async function _fetchTikTokProfileByUsername(
  username: string,
  cursor = 0
): Promise<UnifiedProfile> {
  const errors: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // STRATÉGIE A : HTML scraping (user info) + API mobile TikTok (vidéos)
  // ─────────────────────────────────────────────────────────────────────────
  // Étape 1 : toujours récupérer l'info utilisateur depuis la page TikTok
  // Étape 2 : récupérer les vidéos via l'API mobile TikTok (aweme/v1/aweme/post/)
  //           Elle utilise l'user_id du profil, pas tikwm.com.
  // ─────────────────────────────────────────────────────────────────────────
  if (cursor === 0) {
    try {
      const htmlUser = await fetchTikTokProfileFromHtml(username);

      // Construire l'objet utilisateur unifié
      // user.id = secUid (utilisé pour la pagination via l'API web)
      const user: UnifiedUser = {
        id: htmlUser.secUid || htmlUser.id,
        platform: "tiktok",
        username: htmlUser.uniqueId,
        display_name: htmlUser.nickname,
        biography: htmlUser.signature || undefined,
        avatar_url: htmlUser.avatarLarger || undefined,
        follower_count: htmlUser.followerCount,
        following_count: htmlUser.followingCount,
        profile_url: `https://www.tiktok.com/@${htmlUser.uniqueId}`,
        is_private: htmlUser.privateAccount,
        is_verified: htmlUser.verified,
      };

      // Étape 2a : API web TikTok (tiktok.com/api/post/item_list/)
      // Même requête que le navigateur — utilise les cookies du scraping HTML.
      if (htmlUser.secUid) {
        try {
          const webRes = await fetchTikTokWebVideos(htmlUser.secUid, 0, 35, htmlUser.cookies);
          const itemList = webRes.itemList ?? [];
          if (itemList.length === 0) throw new Error("itemList vide depuis l'API web");
          const media = itemList.map(parseTikTokWebItem);
          const hasMore = webRes.hasMore ?? false;
          const nextCursor = webRes.cursor ?? 0;

          return {
            platform: "tiktok",
            user,
            media,
            has_next_page: hasMore,
            end_cursor: hasMore ? String(nextCursor) : undefined,
            total_count: htmlUser.videoCount || media.length,
          };
        } catch (e) {
          errors.push(`[tiktok-web-api] ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Étape 2b : fallback API mobile TikTok (tiktokv.com)
      if (htmlUser.id) {
        try {
          const awemeRes = await fetchTikTokVideosByUserId(htmlUser.id, 0, 20, htmlUser.cookies);
          const media = (awemeRes.aweme_list ?? []).map(parseTikTokAwemeItem);
          const hasMore = awemeRes.has_more === 1;
          const nextCursor = awemeRes.max_cursor ?? 0;

          return {
            platform: "tiktok",
            user,
            media,
            has_next_page: hasMore,
            end_cursor: hasMore ? String(nextCursor) : undefined,
            total_count: htmlUser.videoCount || media.length,
          };
        } catch (e) {
          errors.push(`[tiktok-mobile-api] ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Si l'API mobile a échoué → retourner le profil sans vidéos (avec marqueur)
      return {
        platform: "tiktok",
        user,
        media: [],
        has_next_page: false,
        end_cursor: undefined,
        total_count: htmlUser.videoCount,
        api_unavailable: true,
      };
    } catch (e) {
      errors.push(`[tiktok-html] ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STRATÉGIE B : tikwm.com API (fallback si HTML scraping échoue, ou pagination)
  // Aussi utilisé pour la pagination (cursor > 0) et les cas où le HTML échoue.
  // ─────────────────────────────────────────────────────────────────────────

  // Pagination via API mobile (cursor > 0)
  if (cursor > 0) {
    try {
      const snap = await fetchTikTokVideosByUserId("", cursor); // userId vide → rechercherons
      // Note: pour la pagination on a besoin du userId depuis quelque part
      // Voir fetchTikTokNextPage() qui est appelé à la place pour la pagination
      void snap;
    } catch {
      // Expected — on tombera sur tikwm ou un autre fallback
    }
  }

  try {
    // Appels en parallèle pour réduire la latence
    const [userInfoRes, postsRes] = await Promise.all([
      fetchTikTokUserInfo(username),
      fetchTikTokUserPosts(username, 35, cursor),
    ]);

    const nextCursor = Number(postsRes.data.cursor ?? 0);
    const hasMore = postsRes.data.has_more === 1;
    const posts = postsRes.data.aweme_list ?? postsRes.data.videos ?? [];

    if (posts.length === 0 && cursor === 0) {
      const emptyProfile = parseTikWmProfileToUnified(
        userInfoRes.data.user, [], 0, false
      );
      return emptyProfile;
    }

    return parseTikWmProfileToUnified(
      userInfoRes.data.user,
      posts,
      nextCursor,
      hasMore
    );
  } catch (e) {
    errors.push(`[tikwm-profile] ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const postsRes = await fetchTikTokUserPosts(username, 35, cursor);
    const nextCursor = Number(postsRes.data.cursor ?? 0);
    const hasMore = postsRes.data.has_more === 1;
    const posts = postsRes.data.aweme_list ?? postsRes.data.videos ?? [];

    if (posts.length === 0) throw new Error("Aucune vidéo trouvée via user/posts");

    const firstPost = posts[0];
    const author = firstPost.author;
    const media: UnifiedMedia[] = posts.map(parseTikWmPostItem);

    return {
      platform: "tiktok",
      user: {
        id: author?.id || username,
        platform: "tiktok",
        username: author?.unique_id || username,
        display_name: author?.nickname || username,
        avatar_url: author?.avatar,
        follower_count: author?.follower_count,
        following_count: author?.following_count,
        profile_url: `https://www.tiktok.com/@${author?.unique_id || username}`,
        is_private: false,
        is_verified: false,
      },
      media,
      has_next_page: hasMore,
      end_cursor: hasMore ? String(nextCursor) : undefined,
      total_count: media.length,
    };
  } catch (e) {
    errors.push(`[tikwm-posts-only] ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(
    `Impossible de récupérer le profil TikTok @${username}. Détails : ${errors.join(" | ")}`
  );
}

// Type helper local
interface UnifiedUser {
  id: string;
  platform: "tiktok";
  username: string;
  display_name: string;
  biography?: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  profile_url: string;
  is_private?: boolean;
  is_verified?: boolean;
}

// ─── Pagination profil TikTok ────────────────────────────────────────────────

/**
 * Charge la page suivante des vidéos d'un profil TikTok.
 * Retourne uniquement les nouveaux médias + pagination info (pas le profil entier).
 */
export async function fetchTikTokNextPage(
  username: string,
  cursor: number
): Promise<PageResult> {
  // Apify en priorité si disponible
  if (isApifyConfigured()) {
    try {
      return await fetchTikTokNextPageViaApify(username, cursor);
    } catch (e) {
      console.warn(`[apify-pagination] Failed for @${username} cursor=${cursor}:`, e instanceof Error ? e.message : e);
    }
  }

  const postsRes = await fetchTikTokUserPosts(username, 35, cursor);

  const nextCursor = Number(postsRes.data.cursor ?? 0);
  const hasMore = postsRes.data.has_more === 1;
  const posts = postsRes.data.aweme_list ?? postsRes.data.videos ?? [];

  return {
    platform: "tiktok",
    media: posts.map(parseTikWmPostItem),
    has_next_page: hasMore,
    end_cursor: hasMore ? String(nextCursor) : undefined,
  };
}

// ─── Flux vidéo unique ───────────────────────────────────────────────────────

/**
 * Récupère les données d'une vidéo TikTok spécifique via 3 stratégies.
 */
async function fetchTikTokSingleVideo(url: string): Promise<UnifiedProfile> {
  const errors: string[] = [];

  try {
    const res = await fetchViaTikWm(url);
    return parseTikWmToProfile(res.data);
  } catch (e) {
    errors.push(`[tikwm-video] ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const oembed = await fetchViaOEmbed(url);
    return parseOEmbedToProfile(oembed, url);
  } catch (e) {
    errors.push(`[oEmbed] ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const htmlData = await fetchViaHtmlParsing(url);
    return parseHtmlDataToProfile(htmlData, url);
  } catch (e) {
    errors.push(`[HTML] ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(
    `Impossible de récupérer la vidéo TikTok. Détails : ${errors.join(" | ")}`
  );
}

// ─── MediaProvider interface ──────────────────────────────────────────────────

export const TikTokProvider: MediaProvider = {
  platform: "tiktok",
  detect: (input) => /tiktok\.com/i.test(input) || /vm\.tiktok\.com/i.test(input),
  fetchProfile: fetchTikTokMedia,
};
