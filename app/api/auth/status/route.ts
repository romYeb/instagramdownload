import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("ig_access_token")?.value;
  const username = request.cookies.get("ig_username")?.value;
  const userId = request.cookies.get("ig_user_id")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    username: username ?? null,
    userId: userId ?? null,
  });
}
