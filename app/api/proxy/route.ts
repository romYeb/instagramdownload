/**
 * app/api/proxy/route.ts
 * ─────────────────────────────────────────────────────────────
 * Proxy serveur pour contourner les restrictions CORS des CDN.
 * Supporte Instagram ET TikTok.
 *
 * FIX 1 : envoi du bon Referer selon le domaine source.
 *          TikTok CDN rejette les requêtes avec Referer instagram.com.
 * FIX 2 : résolution des URLs de page TikTok (tiktok.com/@user/video/ID)
 *          → appel tikwm.com POST /api/ pour obtenir l'URL CDN réelle.
 * FIX 3 : détection HTML en réponse (vidéo corrompue) → erreur propre.
 */

import { NextRequest, NextResponse } from "next/server";
import { encodeContentDisposition } from "@/lib/utils/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Whitelist des domaines autorisés ────────────────────────────────────────

const ALLOWED_HOSTS = [
  // ── Instagram ──────────────────────────────────────────────
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "scontent.cdninstagram.com",
  "video.cdninstagram.com",
  // ── TikTok ─────────────────────────────────────────────────
  "tiktokcdn.com",
  "tiktokcdn-us.com",      // CDN US (API mobile aweme)
  "tiktok.com",
  "byteoversea.com",
  "muscdn.com",
  "tikwm.com",
  "tiktokv.com",
  "ibytedtos.com",
  "sgsnssdk.com",
  "p16-sign-va.tiktokcdn.com",
  "p77-sign-va.tiktokcdn.com",
  "v19-webapp.tiktok.com",
  // TikTok mobile API CDNs
  "p16-common-sign.tiktokcdn-us.com",
  "v45.tiktokcdn-us.com",
  "v16m-default.tiktokcdn-us.com",
];

// ─── Domaines TikTok (pour adapter le Referer) ───────────────────────────────

const TIKTOK_HOSTS = new Set([
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktok.com",
  "tiktokv.com",
  "tikwm.com",
  "byteoversea.com",
  "muscdn.com",
  "ibytedtos.com",
  "sgsnssdk.com",
]);

function isAllowedUrl(url: string): { allowed: boolean; isTikTok: boolean } {
  try {
    const { hostname } = new URL(url);
    const matchedHost = ALLOWED_HOSTS.find(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
    if (!matchedHost) return { allowed: false, isTikTok: false };

    const isTikTok =
      TIKTOK_HOSTS.has(matchedHost) ||
      Array.from(TIKTOK_HOSTS).some((h) => hostname.endsWith(`.${h}`));

    return { allowed: true, isTikTok };
  } catch {
    return { allowed: false, isTikTok: false };
  }
}

// ─── Détection URL de page TikTok ────────────────────────────────────────────

/**
 * Retourne true si l'URL est une page vidéo TikTok (pas une URL CDN).
 * Ex : https://www.tiktok.com/@lyvirestyle/video/7429823456789
 */
function isTikTokPageUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      (hostname === "www.tiktok.com" || hostname === "tiktok.com") &&
      /\/@[^/]+\/video\/\d+/.test(pathname)
    );
  } catch {
    return false;
  }
}

// ─── Résolution via tikwm.com ─────────────────────────────────────────────────

const TIKWM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/**
 * Convertit une URL de page TikTok en URL CDN MP4 directe via tikwm.com.
 * tikwm.com retourne des URLs H.264 compatibles avec tous les appareils.
 */
async function resolveViaTikwm(pageUrl: string): Promise<string> {
  const body = new URLSearchParams({ url: pageUrl, hd: "1" });

  const r = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": TIKWM_UA,
      "Referer": "https://www.tikwm.com/",
      "Origin": "https://www.tikwm.com",
      "Accept": "application/json, text/plain, */*",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });

  if (!r.ok) {
    throw new Error(`tikwm.com HTTP ${r.status}`);
  }

  const json = (await r.json()) as {
    code?: number;
    msg?: string;
    data?: {
      hdplay?: string;
      nwm_video_url_HQ?: string;
      play?: string;
      wmplay?: string;
      size?: number;
    };
  };

  if (!json.data || json.code !== 0) {
    throw new Error(`tikwm: ${json.msg ?? `code ${json.code}`}`);
  }

  // Priorité : HD > sans watermark HQ > play standard
  const videoUrl =
    json.data.hdplay ||
    json.data.nwm_video_url_HQ ||
    json.data.play;

  if (!videoUrl) {
    throw new Error("tikwm: aucune URL vidéo dans la réponse");
  }

  return videoUrl;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const rawUrl  = request.nextUrl.searchParams.get("url");
  const rawName = request.nextUrl.searchParams.get("filename");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(rawUrl);
  const { allowed, isTikTok } = isAllowedUrl(decodedUrl);

  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  // ── Résolution des URLs de page TikTok → URL CDN réelle ──────────────────
  // Quand Apify renvoie webVideoUrl (ex: tiktok.com/@user/video/ID),
  // on appelle tikwm.com pour obtenir l'URL CDN H.264 directement téléchargeable.
  let finalUrl = decodedUrl;
  if (isTikTokPageUrl(decodedUrl)) {
    try {
      finalUrl = await resolveViaTikwm(decodedUrl);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Impossible de résoudre la vidéo TikTok via tikwm.com. Réessayez dans quelques secondes.",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 503 }
      );
    }
  }

  // ── Headers adaptés selon la plateforme ──────────────────────────────────
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const fetchHeaders: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
    // BUG FIX : TikTok CDN exige Referer tiktok.com, pas instagram.com
    Referer: isTikTok ? "https://www.tiktok.com/" : "https://www.instagram.com/",
    ...(isTikTok ? { Origin: "https://www.tiktok.com" } : {}),
  };

  // ── Tentative avec retry (1 retry si TikTok CDN expire) ──────────────────
  const maxAttempts = isTikTok ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(finalUrl, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        if (attempt < maxAttempts) continue; // retry
        return NextResponse.json(
          { error: `Upstream error: ${response.status}` },
          { status: response.status }
        );
      }

      const contentType =
        response.headers.get("Content-Type") ?? "application/octet-stream";
      const contentLength = response.headers.get("Content-Length");
      const data = await response.arrayBuffer();

      // ── Détection HTML en réponse (vidéo corrompue) ──────────────────────
      // Si le premier octet est '<' (0x3C), on a reçu du HTML au lieu d'une vidéo.
      // Cela arrive quand l'URL CDN est expirée ou invalide.
      if (data.byteLength > 0) {
        const firstByte = new Uint8Array(data, 0, 1)[0];
        if (firstByte === 0x3C) { // '<' = HTML/XML
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          return NextResponse.json(
            {
              error: "L'URL de la vidéo a expiré — le serveur a renvoyé du HTML au lieu d'une vidéo. Rechargez la page pour obtenir de nouvelles URLs.",
              hint: "URL expired",
            },
            { status: 422 }
          );
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        // Court délai de cache pour les URLs signées TikTok (elles expirent)
        "Cache-Control": isTikTok
          ? "public, max-age=600, stale-while-revalidate=60"
          : "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      };

      if (contentLength) headers["Content-Length"] = contentLength;

      // Content-Disposition avec nom de fichier UTF-8 (RFC 5987)
      // Supporte accents et caractères français sur tous les OS/navigateurs
      if (rawName) {
        const cleanName = decodeURIComponent(rawName);
        headers["Content-Disposition"] = encodeContentDisposition(cleanName);
      }

      return new NextResponse(data, { status: 200, headers });
    } catch (error) {
      if (attempt >= maxAttempts) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Proxy error" },
          { status: 500 }
        );
      }
      // Attendre 500ms avant retry
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return NextResponse.json({ error: "Proxy failed after retries" }, { status: 500 });
}
