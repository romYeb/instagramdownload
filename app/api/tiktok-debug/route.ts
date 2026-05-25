/**
 * app/api/tiktok-debug/route.ts
 * ─────────────────────────────────────────────────────────────
 * Diagnostic complet du flux de récupération des vidéos TikTok.
 *
 * Teste chaque stratégie INDÉPENDAMMENT et trace exactement
 * à quelle étape les vidéos passent de N à 0.
 *
 * Usage : GET /api/tiktok-debug?username=lyvirestyle
 */

import { NextRequest, NextResponse } from "next/server";
import { isApifyConfigured } from "@/lib/providers/tiktok/apify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TIKTOK_APP_UA = "TikTok 25.3.0 rv:253018 (iPhone; iOS 14.4.2; en_US) Cronet";

// ─── Helper fetch avec métriques ──────────────────────────────────────────────

async function probeFetch(
  label: string,
  url: string,
  options?: RequestInit
): Promise<{
  label: string;
  url: string;
  status: number | null;
  statusText: string;
  contentType: string;
  bodySize: number;
  bodyPreview: string;
  bodyType: "json" | "html" | "empty" | "binary" | "unknown";
  parsed: unknown;
  error: string | null;
  durationMs: number;
}> {
  const start = Date.now();
  let status: number | null = null;
  let statusText = "";
  let contentType = "";
  let bodySize = 0;
  let bodyPreview = "";
  let bodyType: "json" | "html" | "empty" | "binary" | "unknown" = "unknown";
  let parsed: unknown = null;
  let error: string | null = null;

  try {
    const r = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(20_000),
    });

    status = r.status;
    statusText = r.statusText;
    contentType = r.headers.get("content-type") ?? "";

    const text = await r.text();
    bodySize = text.length;
    bodyPreview = text.slice(0, 600);

    if (!text || text.length < 5) {
      bodyType = "empty";
    } else if (text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
      bodyType = "json";
      try { parsed = JSON.parse(text); } catch { bodyType = "unknown"; }
    } else if (text.trimStart().startsWith("<")) {
      bodyType = "html";
    } else {
      bodyType = "binary";
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return {
    label,
    url,
    status,
    statusText,
    contentType,
    bodySize,
    bodyPreview,
    bodyType,
    parsed,
    error,
    durationMs: Date.now() - start,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "?username=<tiktok_handle> requis" },
      { status: 400 }
    );
  }

  const log: unknown[] = [];
  const T = (msg: string) => {
    console.log(`[tiktok-debug] ${msg}`);
    return msg;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 1 — Scraping HTML du profil
  // ═══════════════════════════════════════════════════════════════════════════

  log.push(T(`=== ÉTAPE 1 : HTML Scraping du profil @${username} ===`));

  let htmlResult: {
    ok: boolean;
    userId: string;
    secUid: string;
    videoCount: number;
    followerCount: number;
    nickname: string;
    cookies: string;
    error?: string;
  } = { ok: false, userId: "", secUid: "", videoCount: 0, followerCount: 0, nickname: "", cookies: "" };

  const htmlProbe = await probeFetch(
    "TikTok profile HTML",
    `https://www.tiktok.com/@${encodeURIComponent(username)}`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.tiktok.com/",
      },
    }
  );

  log.push({
    step: "1a_html_fetch",
    status: htmlProbe.status,
    contentType: htmlProbe.contentType,
    bodySize: htmlProbe.bodySize,
    bodyType: htmlProbe.bodyType,
    durationMs: htmlProbe.durationMs,
    error: htmlProbe.error,
  });

  if (htmlProbe.bodyType === "html" && typeof htmlProbe.bodyPreview === "string") {
    const fullBody = htmlProbe.bodyPreview; // only first 600 chars

    // Try to extract from the real body via a separate fetch to get full content
    try {
      const r2 = await fetch(
        `https://www.tiktok.com/@${encodeURIComponent(username)}`,
        {
          headers: {
            "User-Agent": UA,
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.tiktok.com/",
          },
          signal: AbortSignal.timeout(20_000),
        }
      );
      const rawCookies = r2.headers.getSetCookie?.() ?? [];
      const html = await r2.text();

      const universalMatch = html.match(
        /<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
      );

      if (!universalMatch) {
        log.push(T("1b_rehydration: INTROUVABLE dans le HTML (page bloquée par bot-protection?)"));
        htmlResult.error = "No __UNIVERSAL_DATA_FOR_REHYDRATION__ in HTML";

        // Check if it's a captcha page
        const isCaptcha = html.includes("captcha") || html.includes("verify") || html.includes("robot");
        log.push({ step: "1b_captcha_check", isCaptcha, htmlSnippet: html.slice(0, 300) });
      } else {
        try {
          const data = JSON.parse(universalMatch[1]) as Record<string, unknown>;
          const scope = (data?.__DEFAULT_SCOPE__ ?? {}) as Record<string, unknown>;
          const userDetail = (scope?.["webapp.user-detail"] ?? {}) as Record<string, unknown>;
          const userInfo = (userDetail?.userInfo ?? {}) as Record<string, unknown>;
          const user = (userInfo?.user ?? {}) as Record<string, unknown>;
          const stats = (userInfo?.stats ?? {}) as Record<string, unknown>;

          htmlResult = {
            ok: !!user?.uniqueId,
            userId: String(user?.id ?? ""),
            secUid: String(user?.secUid ?? ""),
            videoCount: Number(stats?.videoCount ?? 0),
            followerCount: Number(stats?.followerCount ?? 0),
            nickname: String(user?.nickname ?? ""),
            cookies: rawCookies.map((c: string) => c.split(";")[0]).join("; "),
          };

          log.push({
            step: "1b_profile_extracted",
            ok: htmlResult.ok,
            userId: htmlResult.userId,
            secUid: htmlResult.secUid ? `${htmlResult.secUid.slice(0, 20)}...` : "(VIDE)",
            videoCount: htmlResult.videoCount,
            followerCount: htmlResult.followerCount,
            nickname: htmlResult.nickname,
            cookiesPresent: !!htmlResult.cookies,
            cookiesSnippet: htmlResult.cookies.slice(0, 100),
          });

          if (!htmlResult.userId) log.push(T("⚠ userId EST VIDE — l'API mobile ne pourra pas fonctionner"));
          if (!htmlResult.secUid) log.push(T("⚠ secUid EST VIDE — l'API web ne pourra pas fonctionner"));
        } catch (parseErr) {
          log.push({ step: "1b_json_parse_error", error: String(parseErr) });
          htmlResult.error = String(parseErr);
        }
      }
    } catch (e) {
      log.push({ step: "1b_fetch2_error", error: String(e) });
    }
  } else {
    log.push(T(`1a_html: réponse non-HTML (bodyType=${htmlProbe.bodyType}) — bodyPreview: ${htmlProbe.bodyPreview}`));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 2 — Stratégie A : TikTok Web API (item_list)
  // ═══════════════════════════════════════════════════════════════════════════

  log.push(T(`=== ÉTAPE 2A : TikTok Web API (item_list) — secUid=${htmlResult.secUid ? htmlResult.secUid.slice(0, 20) + "..." : "VIDE"} ===`));

  let webApiResult: { videos: number; error?: string; statusCode?: unknown } = { videos: 0 };

  if (!htmlResult.secUid) {
    log.push(T("2A SKIPPED — secUid vide"));
    webApiResult.error = "secUid vide — stratégie web API ignorée";
  } else {
    const webParams = new URLSearchParams({
      aid: "1988",
      app_name: "tiktok_web",
      device_platform: "web_pc",
      region: "US",
      secUid: htmlResult.secUid,
      count: "35",
      cursor: "0",
    });
    const webProbe = await probeFetch(
      "TikTok Web API item_list",
      `https://www.tiktok.com/api/post/item_list/?${webParams.toString()}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.tiktok.com/",
          ...(htmlResult.cookies ? { Cookie: htmlResult.cookies } : {}),
        },
      }
    );

    const p = webProbe.parsed as Record<string, unknown> | null;
    const itemList = (p?.itemList ?? p?.item_list ?? []) as unknown[];
    const statusCode = p?.statusCode ?? p?.status_code;

    log.push({
      step: "2A_web_api",
      status: webProbe.status,
      contentType: webProbe.contentType,
      bodyType: webProbe.bodyType,
      bodySize: webProbe.bodySize,
      statusCodeInResponse: statusCode,
      itemListLength: itemList.length,
      hasMore: (p as Record<string, unknown>)?.hasMore,
      error: webProbe.error,
      durationMs: webProbe.durationMs,
      bodyPreview: webProbe.bodyPreview.slice(0, 300),
    });

    if (webProbe.bodyType === "html") {
      log.push(T("2A BLOCKED — TikTok a renvoyé du HTML (bot-detection Akamai)"));
    }

    webApiResult = { videos: itemList.length, statusCode };
    if (webProbe.error) webApiResult.error = webProbe.error;
    else if (itemList.length === 0) webApiResult.error = `itemList vide (statusCode=${statusCode})`;

    log.push(T(`2A RESULT: videos=${itemList.length}, error=${webApiResult.error ?? "none"}`));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 2B — Stratégie B : TikTok Mobile API (aweme/v1/aweme/post)
  // ═══════════════════════════════════════════════════════════════════════════

  log.push(T(`=== ÉTAPE 2B : TikTok Mobile API — userId=${htmlResult.userId || "VIDE"} ===`));

  let mobileApiResult: { videos: number; error?: string; statusCode?: unknown } = { videos: 0 };

  if (!htmlResult.userId) {
    log.push(T("2B SKIPPED — userId vide"));
    mobileApiResult.error = "userId vide — stratégie mobile API ignorée";
  } else {
    const mobileParams = new URLSearchParams({
      user_id: htmlResult.userId,
      count: "20",
      cursor: "0",
      aid: "1233",
      version_code: "250305",
      device_platform: "iphone",
      os_version: "14.4.2",
      device_id: String(Math.floor(Math.random() * 9e15) + 1e15),
    });

    const mobileServer = "api19-normal-c-useast1a.tiktokv.com";
    const mobileProbe = await probeFetch(
      "TikTok Mobile API aweme/post",
      `https://${mobileServer}/aweme/v1/aweme/post/?${mobileParams.toString()}`,
      {
        headers: {
          "User-Agent": TIKTOK_APP_UA,
          Accept: "*/*",
          "Accept-Language": "en-US",
          ...(htmlResult.cookies ? { Cookie: htmlResult.cookies } : {}),
        },
      }
    );

    const p = mobileProbe.parsed as Record<string, unknown> | null;
    const awemeList = (p?.aweme_list ?? []) as unknown[];
    const statusCode = p?.status_code ?? p?.statusCode;

    log.push({
      step: "2B_mobile_api",
      status: mobileProbe.status,
      contentType: mobileProbe.contentType,
      bodyType: mobileProbe.bodyType,
      bodySize: mobileProbe.bodySize,
      statusCodeInResponse: statusCode,
      awemeListLength: awemeList.length,
      has_more: (p as Record<string, unknown>)?.has_more,
      error: mobileProbe.error,
      durationMs: mobileProbe.durationMs,
      bodyPreview: mobileProbe.bodyPreview.slice(0, 300),
    });

    mobileApiResult = { videos: awemeList.length, statusCode };
    if (mobileProbe.error) mobileApiResult.error = mobileProbe.error;
    else if (awemeList.length === 0) mobileApiResult.error = `aweme_list vide (statusCode=${statusCode})`;

    log.push(T(`2B RESULT: videos=${awemeList.length}, error=${mobileApiResult.error ?? "none"}`));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 2C — Stratégie C : tikwm.com user/info + user/posts
  // ═══════════════════════════════════════════════════════════════════════════

  log.push(T(`=== ÉTAPE 2C : tikwm.com API — @${username} ===`));

  let tikwmResult: { videos: number; error?: string; userFound?: boolean; tikwmCode?: unknown } = { videos: 0 };

  const tikwmInfoProbe = await probeFetch(
    "tikwm user/info",
    `https://www.tikwm.com/api/user/info/?unique_id=${encodeURIComponent(username)}&hd=1`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.tikwm.com/",
      },
    }
  );

  const tikwmInfoParsed = tikwmInfoProbe.parsed as Record<string, unknown> | null;

  log.push({
    step: "2C_tikwm_userinfo",
    status: tikwmInfoProbe.status,
    contentType: tikwmInfoProbe.contentType,
    bodyType: tikwmInfoProbe.bodyType,
    tikwmCode: tikwmInfoParsed?.code,
    tikwmMsg: tikwmInfoParsed?.msg,
    userFound: !!(tikwmInfoParsed?.data as Record<string, unknown>)?.user,
    error: tikwmInfoProbe.error,
    durationMs: tikwmInfoProbe.durationMs,
  });

  const tikwmPostsParams = new URLSearchParams({
    unique_id: username,
    count: "35",
    cursor: "0",
    web: "1",
    hd: "1",
  });

  const tikwmPostsProbe = await probeFetch(
    "tikwm user/posts",
    `https://www.tikwm.com/api/user/posts?${tikwmPostsParams.toString()}`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.tikwm.com/",
      },
    }
  );

  const tikwmPostsParsed = tikwmPostsProbe.parsed as Record<string, unknown> | null;
  const tikwmData = tikwmPostsParsed?.data as Record<string, unknown> | null;
  const tikwmVideos =
    (tikwmData?.aweme_list as unknown[] | null)?.length ??
    (tikwmData?.videos as unknown[] | null)?.length ??
    0;

  log.push({
    step: "2C_tikwm_posts",
    status: tikwmPostsProbe.status,
    contentType: tikwmPostsProbe.contentType,
    bodyType: tikwmPostsProbe.bodyType,
    tikwmCode: tikwmPostsParsed?.code,
    tikwmMsg: tikwmPostsParsed?.msg,
    awemeListLength: tikwmVideos,
    has_more: tikwmData?.has_more,
    error: tikwmPostsProbe.error,
    durationMs: tikwmPostsProbe.durationMs,
    bodyPreview: tikwmPostsProbe.bodyPreview.slice(0, 300),
  });

  tikwmResult = {
    videos: tikwmVideos,
    userFound: !!(tikwmInfoParsed?.data as Record<string, unknown>)?.user,
    tikwmCode: tikwmPostsParsed?.code,
  };
  if (tikwmVideos === 0) tikwmResult.error = `aweme_list/videos vide (code=${tikwmPostsParsed?.code})`;

  log.push(T(`2C RESULT: videos=${tikwmVideos}, error=${tikwmResult.error ?? "none"}`));

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAPE 2D — Stratégie D : Apify
  // ═══════════════════════════════════════════════════════════════════════════

  log.push(T(`=== ÉTAPE 2D : Apify — configured=${isApifyConfigured()} ===`));

  let apifyResult: {
    videos: number;
    rawItemsCount: number;
    firstItemKeys?: string[];
    firstItemVideoUrl?: string;
    firstItemWebVideoUrl?: string;
    error?: string;
  } = { videos: 0, rawItemsCount: 0 };

  if (!isApifyConfigured()) {
    log.push(T("2D SKIPPED — APIFY_API_TOKEN non configuré"));
    apifyResult.error = "APIFY_API_TOKEN manquant";
  } else {
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? "";
    const ACTOR_ID = "clockworks~tiktok-profile-scraper";
    const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;

    const apifyInput = {
      profiles: [profileUrl],
      resultsPerPage: 30,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    };

    const apifyUrl =
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items` +
      `?token=${APIFY_TOKEN}&timeout=120&memory=1024`;

    log.push({ step: "2D_apify_calling", input: apifyInput });

    try {
      const apifyStart = Date.now();
      const apifyRes = await fetch(apifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyInput),
        signal: AbortSignal.timeout(150_000),
      });

      const apifyDuration = Date.now() - apifyStart;
      const apifyText = await apifyRes.text();
      const apifyBodyType = apifyText.trimStart().startsWith("[") ? "json-array"
        : apifyText.trimStart().startsWith("{") ? "json-object"
        : apifyText.trimStart().startsWith("<") ? "html"
        : "unknown";

      log.push({
        step: "2D_apify_response",
        status: apifyRes.status,
        contentType: apifyRes.headers.get("content-type"),
        bodySize: apifyText.length,
        bodyType: apifyBodyType,
        durationMs: apifyDuration,
        bodyPreview: apifyText.slice(0, 400),
      });

      if (!apifyRes.ok) {
        apifyResult.error = `Apify HTTP ${apifyRes.status}: ${apifyText.slice(0, 200)}`;
        log.push(T(`2D ERROR — ${apifyResult.error}`));
      } else {
        let items: unknown[] = [];
        try {
          items = JSON.parse(apifyText) as unknown[];
        } catch (parseErr) {
          apifyResult.error = `JSON.parse failed: ${String(parseErr)}`;
          log.push(T(`2D JSON parse error: ${apifyResult.error}`));
        }

        apifyResult.rawItemsCount = Array.isArray(items) ? items.length : 0;

        if (!Array.isArray(items) || items.length === 0) {
          apifyResult.error = "aucun item retourné par Apify";
          log.push(T(`2D RESULT: 0 items`));
        } else {
          const first = items[0] as Record<string, unknown>;
          apifyResult.firstItemKeys = Object.keys(first);
          apifyResult.firstItemVideoUrl = String(first.videoUrl ?? "");
          apifyResult.firstItemWebVideoUrl = String(first.webVideoUrl ?? "");

          log.push({
            step: "2D_apify_first_item",
            id: first.id,
            text: String(first.text ?? "").slice(0, 80),
            hasVideoUrl: !!first.videoUrl,
            hasVideoUrlNoWatermark: !!first.videoUrlNoWatermark,
            hasWebVideoUrl: !!first.webVideoUrl,
            isSlideshow: first.isSlideshow,
            slideshowImages: Array.isArray(first.slideshowImages) ? first.slideshowImages.length : 0,
            videoUrl: String(first.videoUrl ?? "").slice(0, 80),
            videoUrlNoWatermark: String(first.videoUrlNoWatermark ?? "").slice(0, 80),
            webVideoUrl: String(first.webVideoUrl ?? "").slice(0, 80),
            authorMetaKeys: first.authorMeta ? Object.keys(first.authorMeta as object) : [],
          });

          // Simulate parseApifyItem on first item to detect mapping errors
          try {
            const slideshowUrls: string[] =
              (first.slideshowImages as string[] | undefined) ??
              (Array.isArray(first.imageUrl) ? (first.imageUrl as string[]) : []);
            const isSlideshow = first.isSlideshow === true || slideshowUrls.length > 0;
            const videoUrl =
              String(first.videoUrlNoWatermark ?? "") ||
              String(first.videoUrl ?? "") ||
              String(first.webVideoUrl ?? "");

            log.push({
              step: "2D_parse_simulation",
              isSlideshow,
              videoUrl: videoUrl.slice(0, 80),
              mediaType: isSlideshow ? "carousel" : "video",
              videoUrlIsPageUrl: videoUrl.includes("tiktok.com/@") && videoUrl.includes("/video/"),
              videoUrlIsEmpty: !videoUrl,
            });

            apifyResult.videos = items.length;
          } catch (mapErr) {
            apifyResult.error = `parseApifyItem simulation failed: ${String(mapErr)}`;
            log.push(T(`2D PARSE ERROR: ${apifyResult.error}`));
          }
        }
      }
    } catch (e) {
      apifyResult.error = e instanceof Error ? e.message : String(e);
      log.push(T(`2D EXCEPTION: ${apifyResult.error}`));
    }
  }

  log.push(T(`2D RESULT: rawItems=${apifyResult.rawItemsCount}, videos=${apifyResult.videos}, error=${apifyResult.error ?? "none"}`));

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNTHÈSE FINALE
  // ═══════════════════════════════════════════════════════════════════════════

  const strategies = [
    { name: "2A_web_api",   videos: webApiResult.videos,    error: webApiResult.error },
    { name: "2B_mobile_api", videos: mobileApiResult.videos, error: mobileApiResult.error },
    { name: "2C_tikwm",     videos: tikwmResult.videos,     error: tikwmResult.error },
    { name: "2D_apify",     videos: apifyResult.videos,     error: apifyResult.error },
  ];

  const firstWorkingStrategy = strategies.find((s) => s.videos > 0);
  const allFailed = strategies.every((s) => s.videos === 0);

  const diagnosis = {
    profile: {
      userId: htmlResult.userId || "(VIDE — cause probable si mobile API échoue)",
      secUid: htmlResult.secUid ? htmlResult.secUid.slice(0, 30) + "..." : "(VIDE — cause probable si web API échoue)",
      videoCount: htmlResult.videoCount,
      followerCount: htmlResult.followerCount,
      nickname: htmlResult.nickname,
      htmlScrapingOk: htmlResult.ok,
      htmlError: htmlResult.error,
    },
    strategies,
    firstWorkingStrategy: firstWorkingStrategy?.name ?? "AUCUNE",
    allFailed,
    verdict: allFailed
      ? "❌ Toutes les stratégies ont échoué — les vidéos disparaissent lors de la récupération"
      : `✅ ${firstWorkingStrategy?.name} retourne ${firstWorkingStrategy?.videos} vidéos`,
    recommendation: allFailed
      ? [
          !htmlResult.userId && "userId vide → mobile API ignorée",
          !htmlResult.secUid && "secUid vide → web API ignorée",
          webApiResult.error?.includes("HTML") && "TikTok web API bloquée par Akamai (HTML au lieu de JSON)",
          mobileApiResult.error && `Mobile API: ${mobileApiResult.error}`,
          tikwmResult.error && `tikwm.com: ${tikwmResult.error}`,
          apifyResult.error && `Apify: ${apifyResult.error}`,
        ].filter(Boolean)
      : [],
  };

  log.push(T(`=== VERDICT: ${diagnosis.verdict} ===`));

  return NextResponse.json({
    username,
    timestamp: new Date().toISOString(),
    apifyConfigured: isApifyConfigured(),
    diagnosis,
    fullLog: log,
    apifyDetail: apifyResult,
  });
}
