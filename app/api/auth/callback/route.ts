import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 24 * 60 * 60, // 60 days
  path: "/",
};

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state") ?? "";

  let target = "";
  try {
    const state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    target = state.target ?? "";
  } catch {}

  const redirectBase = new URL("/", request.url);

  if (!code) {
    redirectBase.searchParams.set("auth", "error");
    return NextResponse.redirect(redirectBase);
  }

  const clientId = process.env.INSTAGRAM_CLIENT_ID!;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET!;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;

  try {
    // 1. Exchange auth code → short-lived token
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access_token in response");

    const shortToken: string = tokenData.access_token;

    // 2. Exchange short-lived → long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortToken}`
    );
    const longData = await longRes.json();
    const longToken: string = longData.access_token ?? shortToken;

    // 3. Fetch connected user info
    const userRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${longToken}`
    );
    const userData = await userRes.json();
    const igUsername: string = userData.username ?? "";
    const igUserId: string = String(userData.id ?? tokenData.user_id ?? "");

    // 4. Set cookies and redirect
    redirectBase.searchParams.set("auth", "success");
    if (target) redirectBase.searchParams.set("target", target);

    const response = NextResponse.redirect(redirectBase);
    response.cookies.set("ig_access_token", longToken, COOKIE_OPTS);
    response.cookies.set("ig_user_id", igUserId, COOKIE_OPTS);
    response.cookies.set("ig_username", igUsername, { ...COOKIE_OPTS, httpOnly: false });
    return response;
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    redirectBase.searchParams.set("auth", "error");
    return NextResponse.redirect(redirectBase);
  }
}
