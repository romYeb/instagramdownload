import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    // Redirect back with error if not configured
    return NextResponse.redirect(
      new URL("/?auth=not_configured", request.url)
    );
  }

  // Preserve the target profile so we can resume after auth
  const target = request.nextUrl.searchParams.get("target") ?? "";
  const state = Buffer.from(
    JSON.stringify({ target, nonce: crypto.randomUUID() })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "user_profile,user_media",
    response_type: "code",
    state,
  });

  return NextResponse.redirect(
    `https://api.instagram.com/oauth/authorize?${params}`
  );
}
