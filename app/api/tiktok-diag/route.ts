/**
 * app/api/tiktok-diag/route.ts
 * ─────────────────────────────────────────────────────────────
 * Endpoint de diagnostic anti-bot TikTok.
 *
 * Usage : GET /api/tiktok-diag?username=lyvirestyle
 *
 * Logs et retourne TOUT ce que TikTok renvoie à chaque étape :
 *   - Status HTTP, headers, cookies Set-Cookie
 *   - Corps brut (500 premiers chars)
 *   - Détection HTML vs JSON
 *   - msToken, secUid, ttwid présents ?
 *   - Temps de réponse
 *   - Erreurs exactes
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface StepLog {
  step: string;
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  durationMs: number;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  setCookies?: string[];
  bodyType?: "json" | "html" | "empty" | "unknown";
  bodyPreview?: string;
  bodyLength?: number;
  parsedJson?: unknown;
  error?: string;
  // Analyse spécifique
  analysis: {
    hasSecUid?: boolean;
    hasTtwid?: boolean;
    hasMsToken?: boolean;
    hasAbck?: boolean;   // Akamai Bot Manager
    hasBmSz?: boolean;   // Akamai
    hasCfClearance?: boolean; // Cloudflare
    hasCfBm?: boolean;   // Cloudflare Bot Management
    isCloudflareChallenge?: boolean;
    isAkamaiChallenge?: boolean;
    isCaptchaPage?: boolean;
    tiktokStatusCode?: number;
    itemCount?: number;
    hasMore?: boolean;
    cursor?: number;
    detectedBlockReason?: string;
  };
}

async function diagStep(
  stepName: string,
  url: string,
  options: RequestInit & { headers?: Record<string, string> }
): Promise<StepLog> {
  const t0 = Date.now();
  const log: StepLog = {
    step: stepName,
    url,
    method: options.method ?? "GET",
    requestHeaders: options.headers ?? {},
    durationMs: 0,
    analysis: {},
  };

  try {
    const r = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(20_000),
    });

    log.durationMs = Date.now() - t0;
    log.status = r.status;
    log.statusText = r.statusText;

    // Headers de réponse
    const resHeaders: Record<string, string> = {};
    r.headers.forEach((v, k) => { resHeaders[k] = v; });
    log.responseHeaders = resHeaders;

    // Cookies Set-Cookie
    const setCookies = r.headers.getSetCookie?.() ?? [];
    log.setCookies = setCookies;

    // Analyse des cookies
    const allCookieStr = setCookies.join(" ");
    log.analysis.hasTtwid = allCookieStr.includes("ttwid");
    log.analysis.hasMsToken = allCookieStr.includes("msToken");
    log.analysis.hasAbck = allCookieStr.includes("_abck");
    log.analysis.hasBmSz = allCookieStr.includes("bm_sz");
    log.analysis.hasCfClearance = allCookieStr.includes("cf_clearance");
    log.analysis.hasCfBm = allCookieStr.includes("__cf_bm");

    // Corps de la réponse
    const text = await r.text();
    log.bodyLength = text.length;
    log.bodyPreview = text.slice(0, 800);

    if (!text || text.length < 5) {
      log.bodyType = "empty";
      log.analysis.detectedBlockReason = "Réponse vide — rate-limit silencieux ou IP bloquée";
    } else if (text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
      log.bodyType = "json";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = JSON.parse(text) as Record<string, any>;
        log.parsedJson = {
          statusCode: json.statusCode ?? json.status_code,
          hasItemList: Array.isArray(json.itemList),
          itemCount: json.itemList?.length ?? 0,
          hasMore: json.hasMore,
          cursor: json.cursor,
          // Champs d'erreur possibles
          message: json.message ?? json.msg,
          type: json.type,
          data_collection_only: json.data_collection_only,
        };
        log.analysis.tiktokStatusCode = json.statusCode ?? json.status_code;
        log.analysis.itemCount = json.itemList?.length ?? 0;
        log.analysis.hasMore = json.hasMore;
        log.analysis.cursor = json.cursor;

        // Diagnostics de blocage
        if (json.statusCode === 10201 || json.statusCode === 10219) {
          log.analysis.detectedBlockReason = `TikTok statusCode=${json.statusCode} → Login requis / session invalide`;
        } else if (json.statusCode === 10102) {
          log.analysis.detectedBlockReason = "TikTok 10102 → Utilisateur non trouvé ou région bloquée";
        } else if (json.statusCode === 10119) {
          log.analysis.detectedBlockReason = "TikTok 10119 → Paramètre manquant (msToken ? X-Bogus ?)";
        } else if (json.statusCode !== 0 && json.statusCode !== undefined) {
          log.analysis.detectedBlockReason = `TikTok statusCode=${json.statusCode} — voir doc TikTok error codes`;
        } else if (Array.isArray(json.itemList) && json.itemList.length === 0) {
          log.analysis.detectedBlockReason = "itemList vide avec statusCode=0 — filtrage invisible ou compte vide";
        }
      } catch {
        log.bodyType = "unknown";
        log.analysis.detectedBlockReason = "Body ressemble à JSON mais non parseable";
      }
    } else if (text.includes("<html") || text.includes("<!DOCTYPE")) {
      log.bodyType = "html";

      // Détection challenge Cloudflare
      if (text.includes("cf-challenge") || text.includes("cf_chl") || text.includes("Checking your browser")) {
        log.analysis.isCloudflareChallenge = true;
        log.analysis.detectedBlockReason = "⛔ Cloudflare Bot Challenge — IP bloquée par Cloudflare";
      }
      // Détection Akamai
      if (text.includes("AkamaiGHost") || text.includes("_abck") || text.includes("ak_bmsc")) {
        log.analysis.isAkamaiChallenge = true;
        log.analysis.detectedBlockReason = "⛔ Akamai Bot Manager — IP flaggée par Akamai";
      }
      // CAPTCHA
      if (text.includes("captcha") || text.includes("CAPTCHA") || text.includes("verify")) {
        log.analysis.isCaptchaPage = true;
        log.analysis.detectedBlockReason = "⛔ Page CAPTCHA — TikTok a détecté du scraping";
      }
      if (!log.analysis.detectedBlockReason) {
        log.analysis.detectedBlockReason = "Body est du HTML — attendu du JSON. Anti-bot probablement actif.";
      }
    } else {
      log.bodyType = "unknown";
    }
  } catch (e) {
    log.durationMs = Date.now() - t0;
    log.error = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
    log.analysis.detectedBlockReason = `Exception réseau: ${log.error}`;
  }

  return log;
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username") ?? "tiktok";
  const logs: StepLog[] = [];
  const report: Record<string, unknown> = { username, timestamp: new Date().toISOString() };

  // ─── ÉTAPE 1 : Scraping HTML du profil TikTok ────────────────────────────────
  const htmlUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const step1 = await diagStep("1_html_profile", htmlUrl, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.tiktok.com/",
    },
  });
  logs.push(step1);

  // Extraire les cookies + secUid depuis le HTML
  let ttwid = "";
  let msToken = "";
  let secUid = "";
  let cookieStr = "";

  if (step1.setCookies) {
    cookieStr = step1.setCookies
      .map((c) => c.split(";")[0])
      .filter((c) => c.includes("="))
      .join("; ");
    ttwid = (step1.setCookies.find((c) => c.startsWith("ttwid=")) ?? "").split(";")[0];
    msToken = (step1.setCookies.find((c) => c.startsWith("msToken=")) ?? "").split(";")[0];
  }

  if (step1.bodyType === "html" && step1.bodyPreview) {
    // Extraire secUid du JSON embarqué dans le HTML
    const secUidMatch = step1.bodyPreview.match(/"secUid":"([^"]+)"/);
    if (secUidMatch) secUid = secUidMatch[1];
  }

  // Re-lire le HTML complet si étape 1 réussie
  if (step1.status === 200 && step1.bodyType === "html" && !secUid) {
    // Le bodyPreview est tronqué — signaler qu'on cherche dans 800 chars
    step1.analysis.hasSecUid = false;
    report.warning_secuid = "secUid non trouvé dans les 800 premiers chars — profil peut-être dans la suite du HTML";
  } else {
    step1.analysis.hasSecUid = !!secUid;
  }

  report.extracted = { ttwid, msToken: msToken ? "[présent]" : "[absent]", secUid: secUid ? secUid.slice(0, 20) + "..." : "[absent]", cookieStr_length: cookieStr.length };

  // ─── ÉTAPE 2 : API web item_list sans cookies ─────────────────────────────────
  if (secUid) {
    const webParams = new URLSearchParams({
      aid: "1988", app_name: "tiktok_web", device_platform: "web_pc",
      region: "US", secUid, count: "5", cursor: "0", language: "en",
    });
    const step2 = await diagStep("2_web_api_no_cookies", `https://www.tiktok.com/api/post/item_list/?${webParams}`, {
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: `https://www.tiktok.com/@${username}`,
      },
    });
    logs.push(step2);

    // ─── ÉTAPE 3 : API web item_list AVEC cookies du scraping HTML ───────────────
    if (cookieStr) {
      const step3 = await diagStep("3_web_api_with_cookies", `https://www.tiktok.com/api/post/item_list/?${webParams}`, {
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: `https://www.tiktok.com/@${username}`,
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          Cookie: cookieStr,
        },
      });
      logs.push(step3);
    }
  }

  // ─── ÉTAPE 4 : Vérification de l'endpoint msToken ───────────────────────────
  const step4 = await diagStep("4_msdk_token_endpoint", "https://mssdk.tiktok.com/web/report", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: "https://www.tiktok.com",
      Referer: "https://www.tiktok.com/",
    },
    body: JSON.stringify({ magic: 538969122, version: 1, dataType: 8, strData: "" }),
  });
  logs.push(step4);

  // ─── ÉTAPE 5 : API mobile tiktokv.com ────────────────────────────────────────
  // On tente juste de savoir si l'IP est bloquée ou non
  const mobileParams = new URLSearchParams({
    user_id: "dummy_test",
    count: "1",
    cursor: "0",
    aid: "1233",
    device_id: String(Math.floor(Math.random() * 9e15)),
    iid: String(Math.floor(Math.random() * 9e15)),
  });
  const step5 = await diagStep("5_mobile_api_probe", `https://api19-normal-c-useast1a.tiktokv.com/aweme/v1/aweme/post/?${mobileParams}`, {
    headers: {
      "User-Agent": "TikTok 25.3.0 rv:253018 (iPhone; iOS 14.4.2; en_US) Cronet",
      Accept: "*/*",
      "Accept-Language": "en-US",
    },
  });
  logs.push(step5);

  // ─── SYNTHÈSE ─────────────────────────────────────────────────────────────────
  const blockedSteps = logs.filter(l => l.analysis.detectedBlockReason?.startsWith("⛔") || l.status === 403 || l.status === 429 || l.bodyType === "empty");
  const workingSteps = logs.filter(l => l.bodyType === "json" && l.analysis.tiktokStatusCode === 0 && (l.analysis.itemCount ?? 0) > 0);

  report.summary = {
    htmlScrapingWorks: step1.status === 200 && step1.bodyType === "html",
    secUidFound: !!secUid,
    cookiesReceived: step1.setCookies?.length ?? 0,
    cookieNames: step1.setCookies?.map(c => c.split("=")[0]).join(", "),
    blockedSteps: blockedSteps.map(l => `${l.step} (${l.analysis.detectedBlockReason})`),
    workingSteps: workingSteps.map(l => `${l.step} — ${l.analysis.itemCount} items`),
    verdict: workingSteps.length > 0
      ? "✅ Au moins une stratégie fonctionne"
      : blockedSteps.length > 0
      ? "⛔ Toutes les requêtes sont bloquées — voir détails dans logs"
      : "⚠️ Aucune erreur claire — voir bodyPreview pour comprendre",
  };

  return NextResponse.json({ report, logs }, { status: 200 });
}
