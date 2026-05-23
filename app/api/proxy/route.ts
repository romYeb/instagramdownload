/**
 * app/api/proxy/route.ts
 * ─────────────────────────────────────────────────────────────
 * Proxy serveur pour contourner les restrictions CORS des CDN.
 * Supporte Instagram ET TikTok.
 *
 * FIX : envoi du bon Referer selon le domaine source.
 *       TikTok CDN rejette les requêtes avec Referer instagram.com.
 */

import { NextRequest, NextResponse } from "next/server";

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(rawUrl);
  const { allowed, isTikTok } = isAllowedUrl(decodedUrl);

  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
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
      const response = await fetch(decodedUrl, {
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

      const headers: Record<string, string> = {
        "Content-Type": contentType,
        // Court délai de cache pour les URLs signées TikTok (elles expirent)
        "Cache-Control": isTikTok
          ? "public, max-age=600, stale-while-revalidate=60"
          : "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      };

      if (contentLength) headers["Content-Length"] = contentLength;

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
