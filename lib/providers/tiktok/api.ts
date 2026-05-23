/**
 * lib/providers/tiktok/api.ts
 * ─────────────────────────────────────────────────────────────
 * Appels API TikTok via tikwm.com — sans headless browser, 100% serverless.
 *
 * Endpoints utilisés :
 *   1. POST https://www.tikwm.com/api/              → single video
 *   2. GET  https://www.tikwm.com/api/user/info/    → infos profil
 *   3. GET  https://www.tikwm.com/api/user/posts    → liste des vidéos du profil
 *   4. GET  https://www.tiktok.com/oembed           → fallback metadata
 *   5. GET  <tiktok_url>  + parsing HTML            → fallback HTML
 */

import type {
  TikWmResponse,
  TikWmUserInfoResponse,
  TikWmPostsResponse,
  TikTokOEmbedResponse,
  TikTokAwemePostResponse,
} from "@/types/tiktok";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const UA = process.env.TIKTOK_USER_AGENT ?? DEFAULT_UA;

// Headers communs simulant un vrai navigateur (aide à passer Cloudflare)
const BROWSER_HEADERS = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  Referer: "https://www.tikwm.com/",
  Origin: "https://www.tikwm.com",
};

// ─── Résolution des URLs courtes ──────────────────────────────────────────────

/**
 * Suit les redirections pour résoudre vm.tiktok.com, vt.tiktok.com, etc.
 * Retourne l'URL finale après toutes les redirections.
 */
export async function resolveTikTokUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (r.url && r.url !== url) return r.url;
  } catch { /* ignore */ }

  // Fallback GET si HEAD échoue
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (r.url) return r.url;
  } catch { /* ignore */ }

  return url;
}

// ─── 1. Vidéo unique : POST https://www.tikwm.com/api/ ───────────────────────

/**
 * Récupère les données d'une VIDÉO TikTok via l'API tikwm.com.
 * ⚠ Ne fonctionne qu'avec des URLs de vidéo, PAS les URLs de profil.
 */
export async function fetchViaTikWm(videoUrl: string): Promise<TikWmResponse> {
  const body = new URLSearchParams({ url: videoUrl, hd: "1" });

  const r = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!r.ok) throw new Error(`tikwm video API: HTTP ${r.status}`);

  const json = (await r.json()) as TikWmResponse;
  if (json.code !== 0) throw new Error(`tikwm video API: code=${json.code} msg="${json.msg}"`);
  if (!json.data?.id && !json.data?.video_id) throw new Error("tikwm video API: no video id in response");

  return json;
}

// ─── 2. Profil utilisateur : GET + POST https://www.tikwm.com/api/user/info/ ──

/**
 * Récupère les informations d'un profil TikTok (bio, stats, avatar…).
 * Essaie d'abord GET, puis POST en fallback (certains CDN Cloudflare bloquent GET).
 */
export async function fetchTikTokUserInfo(username: string): Promise<TikWmUserInfoResponse> {
  const errors: string[] = [];

  // ── Tentative 1 : GET classique ───────────────────────────────────────────
  try {
    const url = `https://www.tikwm.com/api/user/info/?unique_id=${encodeURIComponent(username)}&hd=1`;
    const r = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = (await r.json()) as TikWmUserInfoResponse;
    if (json.code !== 0) throw new Error(`code=${json.code} msg="${json.msg}"`);
    if (!json.data?.user) throw new Error("no user in response");
    return json;
  } catch (e) {
    errors.push(`GET: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Tentative 2 : POST (contourne parfois Cloudflare) ────────────────────
  try {
    const body = new URLSearchParams({ unique_id: username, hd: "1" });
    const r = await fetch("https://www.tikwm.com/api/user/info/", {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = (await r.json()) as TikWmUserInfoResponse;
    if (json.code !== 0) throw new Error(`code=${json.code} msg="${json.msg}"`);
    if (!json.data?.user) throw new Error("no user in response");
    return json;
  } catch (e) {
    errors.push(`POST: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(`tikwm user/info failed — ${errors.join(" | ")}`);
}

// ─── 3. Posts du profil : GET + POST https://www.tikwm.com/api/user/posts ─────

/**
 * Récupère une page de vidéos depuis le profil TikTok d'un utilisateur.
 * Essaie GET, puis POST en fallback si Cloudflare bloque.
 *
 * @param username  Le @handle TikTok (sans le @)
 * @param count     Nombre de vidéos par page (max 35 recommandé)
 * @param cursor    Curseur de pagination (0 pour la première page)
 */
export async function fetchTikTokUserPosts(
  username: string,
  count = 35,
  cursor = 0
): Promise<TikWmPostsResponse> {
  const errors: string[] = [];

  const normalizePostsResponse = (json: TikWmPostsResponse): TikWmPostsResponse => {
    // L'API peut retourner aweme_list ou videos selon la version
    const list = json.data?.aweme_list ?? json.data?.videos;
    if (!list) throw new Error("no aweme_list in response");
    if (!json.data.aweme_list) json.data.aweme_list = json.data.videos ?? [];
    return json;
  };

  // ── Tentative 1 : GET ────────────────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      unique_id: username,
      count: String(count),
      cursor: String(cursor),
      web: "1",
      hd: "1",
    });
    const url = `https://www.tikwm.com/api/user/posts?${params.toString()}`;
    const r = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = (await r.json()) as TikWmPostsResponse;
    if (json.code !== 0) throw new Error(`code=${json.code} msg="${json.msg}"`);
    return normalizePostsResponse(json);
  } catch (e) {
    errors.push(`GET: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Tentative 2 : POST ───────────────────────────────────────────────────
  try {
    const body = new URLSearchParams({
      unique_id: username,
      count: String(count),
      cursor: String(cursor),
      web: "1",
      hd: "1",
    });
    const r = await fetch("https://www.tikwm.com/api/user/posts", {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = (await r.json()) as TikWmPostsResponse;
    if (json.code !== 0) throw new Error(`code=${json.code} msg="${json.msg}"`);
    return normalizePostsResponse(json);
  } catch (e) {
    errors.push(`POST: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(`tikwm user/posts failed — ${errors.join(" | ")}`);
}

// ─── 4. API mobile TikTok — liste des vidéos d'un profil ─────────────────────

/**
 * Récupère la liste des vidéos d'un profil TikTok via l'API mobile interne
 * de TikTok (aweme/v1/aweme/post/).
 *
 * ✅ Ne dépend PAS de tikwm.com (utilise directement les serveurs TikTok).
 * ⚠ Requiert le `user_id` numérique de l'utilisateur (obtenu via HTML scraping).
 *
 * La pagination utilise `max_cursor` (timestamp de la dernière vidéo vue).
 */
const TIKTOK_MOBILE_API_SERVERS = [
  "api19-normal-c-useast1a.tiktokv.com",
  "api16-normal-c-useast1a.tiktokv.com",
  "api22-normal-c-useast2a.tiktokv.com",
];

const TIKTOK_APP_UA =
  "TikTok 25.3.0 rv:253018 (iPhone; iOS 14.4.2; en_US) Cronet";

export async function fetchTikTokVideosByUserId(
  userId: string,
  maxCursor = 0,
  count = 20,
  /** Cookies obtenus lors du scraping HTML du profil — aident à contourner le rate-limit */
  sessionCookies?: string
): Promise<TikTokAwemePostResponse> {
  if (!userId) throw new Error("userId requis pour l'API mobile TikTok");

  // Paramètres qui imitent l'app TikTok iOS
  const params = new URLSearchParams({
    user_id: userId,
    count: String(count),
    cursor: String(maxCursor),
    aid: "1233",
    version_code: "250305",
    version_name: "25.3.0",
    device_platform: "iphone",
    os_version: "14.4.2",
    // Device ID aléatoire à chaque requête (évite le rate-limit par device)
    device_id: String(Math.floor(Math.random() * 9e15) + 1e15),
    iid: String(Math.floor(Math.random() * 9e15) + 1e15),
  });

  const errors: string[] = [];

  // Headers de base, avec cookies si disponibles
  const baseHeaders: Record<string, string> = {
    "User-Agent": TIKTOK_APP_UA,
    Accept: "*/*",
    "Accept-Language": "en-US",
    ...(sessionCookies ? { Cookie: sessionCookies } : {}),
  };

  for (const server of TIKTOK_MOBILE_API_SERVERS) {
    try {
      const url = `https://${server}/aweme/v1/aweme/post/?${params.toString()}`;
      const r = await fetch(url, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(12_000),
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      // TikTok répond parfois avec un body vide (rate-limit silencieux)
      const text = await r.text();
      if (!text || text.length < 10) throw new Error("empty response (rate limited)");

      const json = JSON.parse(text) as TikTokAwemePostResponse;

      if (json.status_code !== 0) {
        throw new Error(`status_code=${json.status_code} msg="${json.status_msg}"`);
      }

      if (!Array.isArray(json.aweme_list)) {
        throw new Error("no aweme_list in response");
      }

      return json;
    } catch (e) {
      errors.push(`[${server}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(`TikTok mobile API failed — ${errors.join(" | ")}`);
}

// ─── 5. Scraping HTML du profil TikTok (fallback si tikwm.com est down) ─────

/**
 * Récupère les informations de profil d'un utilisateur TikTok directement
 * depuis la page HTML de son profil (tiktok.com/@username).
 *
 * ✅ Fonctionne même quand tikwm.com est bloqué / hors-ligne.
 * ⚠ Ne retourne pas la liste des vidéos (lazy-loaded côté client).
 *
 * Retourne un objet partiel — le profil avec les stats mais sans vidéos.
 */
export interface TikTokProfileHtmlResult {
  id: string;
  uniqueId: string;
  nickname: string;
  signature: string;
  verified: boolean;
  privateAccount: boolean;
  avatarLarger: string;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
  /** Cookies définis par TikTok lors du chargement de la page (pour l'API mobile) */
  cookies?: string;
}

export async function fetchTikTokProfileFromHtml(
  username: string
): Promise<TikTokProfileHtmlResult> {
  const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.tiktok.com/",
    },
    signal: AbortSignal.timeout(15_000),
  });

  // Extraire les cookies de la réponse (pour réutilisation dans l'API mobile)
  const rawCookies = r.headers.getSetCookie?.() ?? [];

  if (!r.ok) throw new Error(`TikTok profile page: HTTP ${r.status}`);

  const html = await r.text();

  // Extraire UNIVERSAL_DATA_FOR_REHYDRATION (contient user-detail)
  const universalMatch = html.match(
    /<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!universalMatch) throw new Error("TikTok profile page: no rehydration data found");

  const data = JSON.parse(universalMatch[1]) as {
    __DEFAULT_SCOPE__?: {
      "webapp.user-detail"?: {
        userInfo?: {
          user?: {
            id?: string;
            uniqueId?: string;
            nickname?: string;
            signature?: string;
            verified?: boolean;
            privateAccount?: boolean;
            avatarLarger?: string;
          };
          stats?: {
            followerCount?: number;
            followingCount?: number;
            heart?: number;
            heartCount?: number;
            videoCount?: number;
          };
        };
      };
    };
  };

  const scope = data?.__DEFAULT_SCOPE__;
  const userDetail = scope?.["webapp.user-detail"];
  const userInfo = userDetail?.userInfo;
  const user = userInfo?.user;
  const stats = userInfo?.stats;

  if (!user?.uniqueId) {
    throw new Error(`TikTok profile page: user not found for @${username}`);
  }

  // Construire la chaîne de cookies (msToken, ttwid, etc.)
  // Ces cookies aident l'API mobile TikTok à accepter plus de requêtes
  const cookieString = rawCookies
    .map((c) => c.split(";")[0]) // garder seulement name=value
    .filter((c) => c.includes("="))
    .join("; ");

  return {
    id: user.id ?? "",
    uniqueId: user.uniqueId,
    nickname: user.nickname ?? user.uniqueId,
    signature: user.signature ?? "",
    verified: user.verified ?? false,
    privateAccount: user.privateAccount ?? false,
    avatarLarger: user.avatarLarger ?? "",
    followerCount: stats?.followerCount ?? 0,
    followingCount: stats?.followingCount ?? 0,
    heartCount: stats?.heart ?? stats?.heartCount ?? 0,
    videoCount: stats?.videoCount ?? 0,
    cookies: cookieString || undefined,
  };
}

// ─── 5. Fallback : oEmbed ─────────────────────────────────────────────────────

/**
 * Appelle l'API oEmbed officielle de TikTok.
 * Retourne uniquement les métadonnées + thumbnail, PAS l'URL vidéo directe.
 * Utilisé uniquement pour les URLs de vidéo en dernier recours.
 */
export async function fetchViaOEmbed(videoUrl: string): Promise<TikTokOEmbedResponse> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;

  const r = await fetch(endpoint, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!r.ok) throw new Error(`oEmbed: HTTP ${r.status}`);

  const json = (await r.json()) as TikTokOEmbedResponse;
  if (!json.author_name) throw new Error("oEmbed: réponse invalide");

  return json;
}

// ─── 5. Fallback : parsing HTML ───────────────────────────────────────────────

/**
 * Fetch la page HTML d'une URL TikTok et extrait le JSON embarqué.
 * Supporte UNIVERSAL_DATA_FOR_REHYDRATION, SIGI_STATE, __NEXT_DATA__.
 */
export async function fetchViaHtmlParsing(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://www.tiktok.com/",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!r.ok) throw new Error(`HTML fetch: HTTP ${r.status}`);

  const html = await r.text();

  // Tenter UNIVERSAL_DATA_FOR_REHYDRATION
  const universalMatch = html.match(
    /<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (universalMatch) {
    try {
      const data = JSON.parse(universalMatch[1]) as Record<string, Record<string, unknown>>;
      const scope = data?.["__DEFAULT_SCOPE__"];
      if (scope) {
        const videoDetail = scope["webapp.video-detail"] as Record<string, unknown> | undefined;
        if (videoDetail?.itemInfo) return videoDetail.itemInfo as Record<string, unknown>;
      }
      return data;
    } catch { /* continue */ }
  }

  // Tenter SIGI_STATE
  const sigiMatch = html.match(/window\['SIGI_STATE'\]\s*=\s*(\{[\s\S]*?\});\s*window\[/);
  if (sigiMatch) {
    try { return JSON.parse(sigiMatch[1]) as Record<string, unknown>; } catch { /* continue */ }
  }

  // Tenter __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try { return JSON.parse(nextDataMatch[1]) as Record<string, unknown>; } catch { /* continue */ }
  }

  throw new Error("Aucun JSON trouvé dans la page TikTok");
}
