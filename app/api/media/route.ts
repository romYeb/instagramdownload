/**
 * app/api/media/route.ts
 * ─────────────────────────────────────────────────────────────
 * Route unifiée — auto-détecte la plateforme et route vers le bon provider.
 *
 * Paramètres :
 *   GET /api/media?url=<tiktok_profile_or_video_url>
 *   GET /api/media?url=<instagram_url>
 *   GET /api/media?username=<ig_username>&platform=instagram
 *   GET /api/media?userId=<id>&cursor=<cursor>            (pagination Instagram)
 *   GET /api/media?username=<tt_username>&platform=tiktok&cursor=<n>  (pagination TikTok)
 */

import { NextRequest, NextResponse } from "next/server";
import { detectPlatform, extractInstagramUsername } from "@/lib/utils/platform";
import { fetchInstagramProfile, fetchInstagramNextPage } from "@/lib/providers/instagram";
import {
  fetchTikTokMedia,
  fetchTikTokProfileByUsername,
  fetchTikTokNextPage,
} from "@/lib/providers/tiktok/extract";
import { fetchTikTokVideosByUserId, fetchTikTokWebVideos } from "@/lib/providers/tiktok/api";
import { parseTikTokAwemeItem, parseTikTokWebItem } from "@/lib/providers/tiktok/parser";
import type { AppErrorCode } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Helper erreur ────────────────────────────────────────────────────────────

function err(message: string, code: AppErrorCode, status: number, details?: string) {
  return NextResponse.json(
    { error: message, code, ...(details ? { details } : {}) },
    { status }
  );
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const rawUrl  = sp.get("url");
  const username = sp.get("username");
  const platform = sp.get("platform");
  const userId   = sp.get("userId");
  const cursor   = sp.get("cursor");

  // ── 1a. Pagination TikTok (API web via secUid, ou API mobile via userId) ────
  if (userId && cursor && platform === "tiktok") {
    const cursorNum = parseInt(cursor, 10) || 0;
    const isSecUid = !/^\d+$/.test(userId); // secUid = alphanumérique, userId = numérique

    // Stratégie 1 : API web TikTok (secUid) — même appel que le navigateur
    if (isSecUid) {
      try {
        const webRes = await fetchTikTokWebVideos(userId, cursorNum);
        const media = (webRes.itemList ?? []).map(parseTikTokWebItem);
        const hasMore = webRes.hasMore ?? false;
        return NextResponse.json({
          platform: "tiktok",
          media,
          has_next_page: hasMore,
          end_cursor: hasMore ? String(webRes.cursor ?? 0) : undefined,
        });
      } catch (e) {
        return handleTikTokError(e);
      }
    }

    // Stratégie 2 : API mobile (userId numérique) — fallback
    try {
      const awemeRes = await fetchTikTokVideosByUserId(userId, cursorNum);
      const media = awemeRes.aweme_list.map(parseTikTokAwemeItem);
      const hasMore = awemeRes.has_more === 1;
      const nextCursor = awemeRes.max_cursor ?? 0;
      return NextResponse.json({
        platform: "tiktok",
        media,
        has_next_page: hasMore,
        end_cursor: hasMore ? String(nextCursor) : undefined,
      });
    } catch (e) {
      return handleTikTokError(e);
    }
  }

  // ── 1b. Pagination Instagram ───────────────────────────────────────────────
  if (userId && cursor) {
    if (!/^\d+$/.test(userId)) return err("userId invalide", "INVALID_URL", 400);
    try {
      const result = await fetchInstagramNextPage(userId, cursor);
      return NextResponse.json(result);
    } catch (e) {
      return err(
        "Pagination Instagram échouée.",
        "PAGINATION_ERROR",
        503,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // ── 2. Pagination TikTok profil ────────────────────────────────────────────
  if (username && platform === "tiktok" && cursor !== null) {
    const cursorNum = parseInt(cursor ?? "0", 10) || 0;
    try {
      const result = await fetchTikTokNextPage(username, cursorNum);
      return NextResponse.json(result);
    } catch (e) {
      return err(
        "Pagination TikTok échouée. Réessayez dans quelques secondes.",
        "PAGINATION_ERROR",
        503,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // ── 3. URL générique (auto-détection plateforme) ───────────────────────────
  if (rawUrl) {
    const detected = detectPlatform(rawUrl);

    // TikTok
    if (detected === "tiktok") {
      try {
        const profile = await fetchTikTokMedia(rawUrl);
        return NextResponse.json(profile);
      } catch (e) {
        return handleTikTokError(e);
      }
    }

    // Instagram via URL
    if (detected === "instagram") {
      const igUsername = extractInstagramUsername(rawUrl);
      if (!igUsername) {
        return err("URL Instagram invalide.", "INVALID_URL", 400);
      }
      try {
        const profile = await fetchInstagramProfile(igUsername);
        return NextResponse.json(profile);
      } catch (e) {
        return handleInstagramError(e);
      }
    }

    return err(
      "Plateforme non supportée. Collez un lien Instagram ou TikTok.",
      "PLATFORM_NOT_SUPPORTED",
      400
    );
  }

  // ── 4. Username Instagram direct ───────────────────────────────────────────
  if (username && (platform === "instagram" || !platform)) {
    const clean = username.replace(/[^a-zA-Z0-9._]/g, "").toLowerCase();
    if (!clean || clean.length > 30) return err("Username Instagram invalide.", "INVALID_URL", 400);
    try {
      const profile = await fetchInstagramProfile(clean);
      return NextResponse.json(profile);
    } catch (e) {
      return handleInstagramError(e);
    }
  }

  // ── 5. Username TikTok direct ─────────────────────────────────────────────
  if (username && platform === "tiktok") {
    const clean = username.replace(/[^a-zA-Z0-9._]/g, "");
    if (!clean) return err("Username TikTok invalide.", "INVALID_URL", 400);
    try {
      const profile = await fetchTikTokProfileByUsername(clean, 0);
      return NextResponse.json(profile);
    } catch (e) {
      return handleTikTokError(e);
    }
  }

  return err("Paramètre url ou username requis.", "INVALID_URL", 400);
}

// ─── Gestion des erreurs ──────────────────────────────────────────────────────

function handleInstagramError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.toLowerCase().includes("private")) return err("Compte Instagram privé.", "PRIVATE_CONTENT", 403);
  if (msg.includes("404") || msg.toLowerCase().includes("not found")) return err("Compte Instagram introuvable.", "MEDIA_NOT_FOUND", 404);
  if (msg.includes("429")) return err("Instagram limite les requêtes. Réessayez dans 30s.", "RATE_LIMIT", 429);
  return err("Impossible de récupérer ce profil Instagram.", "FETCH_ERROR", 503, msg);
}

function handleTikTokError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.toLowerCase().includes("private")) return err("Ce contenu TikTok est privé.", "PRIVATE_CONTENT", 403);
  if (msg.toLowerCase().includes("not found") || msg.includes("404")) return err("Vidéo ou profil TikTok introuvable.", "MEDIA_NOT_FOUND", 404);
  if (msg.includes("429")) return err("TikTok limite les requêtes. Réessayez dans 30s.", "RATE_LIMIT", 429);

  // Cas spécifique : tikwm.com bloqué par Cloudflare (502/503)
  if (msg.includes("502") || msg.includes("503") || msg.includes("522") || msg.includes("524")) {
    return err(
      "L'API TikTok (tikwm.com) est temporairement indisponible (erreur Cloudflare). Réessayez dans 1-2 minutes.",
      "FETCH_ERROR",
      503,
      msg
    );
  }

  return err(
    "Impossible de récupérer ce contenu TikTok. Réessayez dans quelques secondes.",
    "FETCH_ERROR",
    503,
    msg
  );
}
