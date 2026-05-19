import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.SCRAPER_API_KEY;

  // Test a real ScraperAPI call to Instagram
  let scraperTest: { status?: number; ok?: boolean; error?: string; body?: string } = {};
  if (key) {
    try {
      const testUrl = "https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram";
      const proxyUrl = `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(testUrl)}&keep_headers=true`;
      const res = await fetch(proxyUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.instagram.com/",
        },
        cache: "no-store",
      });
      const text = await res.text();
      scraperTest = {
        status: res.status,
        ok: res.ok,
        body: text.slice(0, 300),
      };
    } catch (e) {
      scraperTest = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    SCRAPER_API_KEY_set: !!key,
    SCRAPER_API_KEY_preview: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
    NODE_ENV: process.env.NODE_ENV,
    scraperTest,
  });
}
