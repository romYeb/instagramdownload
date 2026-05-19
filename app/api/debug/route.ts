import { NextResponse } from "next/server";
import axios from "axios";

export const dynamic = "force-dynamic";

function getProxyConfig() {
  const raw = process.env.PROXY_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol.replace(":", "") as "http" | "https",
      host: u.hostname,
      port: parseInt(u.port || "80"),
      ...(u.username ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } } : {}),
    };
  } catch {
    return undefined;
  }
}

export async function GET() {
  const proxyUrl = process.env.PROXY_URL;
  const proxy = getProxyConfig();

  let igTest: { status?: number; hasData?: boolean; error?: string } = {};
  try {
    const res = await axios.get(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
          Referer: "https://www.instagram.com/",
        },
        proxy: proxy ?? false,
        timeout: 15000,
        validateStatus: () => true,
      }
    );
    igTest = {
      status: res.status,
      hasData: !!res.data?.data?.user,
    };
  } catch (e) {
    igTest = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    PROXY_URL_set: !!proxyUrl,
    PROXY_URL_preview: proxyUrl
      ? `${proxyUrl.split("@")[0].split(":")[0]}://${proxyUrl.split("@")[0].split(":")[1]?.replace("//", "")}:***@${proxyUrl.split("@")[1]}`
      : null,
    NODE_ENV: process.env.NODE_ENV,
    igTest,
  });
}
