import { NextRequest, NextResponse } from "next/server";
import { fetchInstagramProfile } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const clean = username.replace(/[^a-zA-Z0-9._]/g, "").toLowerCase();
  if (!clean || clean.length > 30) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const profile = await fetchInstagramProfile(clean);
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
