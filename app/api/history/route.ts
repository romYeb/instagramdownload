import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";
import type { DownloadHistory } from "@/types/instagram";

// In-memory fallback when Supabase is not configured
const memoryHistory: DownloadHistory[] = [];

export async function GET() {
  if (isSupabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("download_history")
      .select("*")
      .order("downloaded_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ history: memoryHistory.slice(0, 20) });
    }
    return NextResponse.json({ history: data });
  }

  return NextResponse.json({ history: memoryHistory.slice(0, 20) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const entry: DownloadHistory = {
    id: crypto.randomUUID(),
    username: body.username,
    full_name: body.full_name,
    profile_pic_url: body.profile_pic_url,
    follower_count: body.follower_count,
    media_count: body.media_count ?? 0,
    downloaded_at: new Date().toISOString(),
    session_id: body.session_id ?? crypto.randomUUID(),
  };

  if (isSupabaseEnabled && supabase) {
    const { error } = await supabase.from("download_history").insert([entry]);
    if (error) console.error("Supabase insert error:", error);
  } else {
    // In-memory fallback
    memoryHistory.unshift(entry);
    if (memoryHistory.length > 50) memoryHistory.pop();
  }

  return NextResponse.json({ success: true, entry });
}
