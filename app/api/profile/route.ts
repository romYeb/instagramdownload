import { NextRequest, NextResponse } from "next/server";
import { fetchInstagramProfile, fetchNextPage } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");
  const userId = searchParams.get("userId");
  const cursor = searchParams.get("cursor");

  // Read Instagram access token from httpOnly cookie (set after OAuth)
  const token = request.cookies.get("ig_access_token")?.value;

  // ── Pagination request ─────────────────────────────────────────────────────
  if (userId && cursor) {
    if (!/^\d+$/.test(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    try {
      const result = await fetchNextPage(userId, cursor, token);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Pagination failed. Instagram may be rate-limiting this request.",
          code: "PAGINATION_ERROR",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 503 }
      );
    }
  }

  // ── Initial profile fetch ──────────────────────────────────────────────────
  if (!username) {
    return NextResponse.json({ error: "username or (userId + cursor) required" }, { status: 400 });
  }

  const clean = username.replace(/[^a-zA-Z0-9._]/g, "").toLowerCase();
  if (!clean || clean.length > 30) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const profile = await fetchInstagramProfile(clean, token);
    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("private")) {
      return NextResponse.json(
        { error: "This account is private", code: "PRIVATE_ACCOUNT" },
        { status: 403 }
      );
    }
    if (message.includes("404") || message.includes("not found")) {
      return NextResponse.json(
        { error: "Account not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Unable to fetch profile. Instagram may be blocking this request.",
        code: "FETCH_ERROR",
        details: message,
      },
      { status: 503 }
    );
  }
}
