/**
 * app/api/history/route.ts
 * ─────────────────────────────────────────────────────────────
 * Historique des téléchargements — stockage Supabase ou in-memory.
 * Supporte maintenant le champ "platform" (instagram | tiktok).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";
import type { DownloadHistory } from "@/types/instagram";

// Fallback in-memory (perdu au redémarrage serveur)
const memoryHistory: DownloadHistory[] = [];

export async function GET() {
  if (isSupabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("download_history")
      .select("*")
      .order("downloaded_at", { ascending: false })
      .limit(20);

    if (error) {
      // Fallback in-memory si Supabase échoue
      return NextResponse.json({ history: memoryHistory.slice(0, 20) });
    }
    return NextResponse.json({ history: data });
  }

  return NextResponse.json({ history: memoryHistory.slice(0, 20) });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    platform?: "instagram" | "tiktok";
    username: string;
    full_name?: string;
    profile_pic_url?: string;
    follower_count?: number;
    media_count?: number;
    session_id?: string;
  };

  const entry: DownloadHistory = {
    id: crypto.randomUUID(),
    platform: body.platform ?? "instagram", // backward compat
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
    if (error) console.error("[history] Supabase insert error:", error.message);
  } else {
    memoryHistory.unshift(entry);
    if (memoryHistory.length > 50) memoryHistory.pop();
  }

  return NextResponse.json({ success: true, entry });
}
