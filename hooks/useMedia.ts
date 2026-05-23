/**
 * hooks/useMedia.ts
 * ─────────────────────────────────────────────────────────────
 * Hook multi-plateforme — Instagram (profil complet + pagination)
 *                       + TikTok (profil + toutes les vidéos + pagination).
 *
 * FIX : loadMore et loadAll fonctionnent maintenant pour les deux plateformes.
 */

"use client";
import { useState, useCallback, useRef } from "react";
import type { UnifiedMedia, UnifiedUser, PlatformType, AppErrorCode } from "@/types/media";
import { detectPlatform, extractInstagramUsername } from "@/lib/utils/platform";

// ─── Types d'état ─────────────────────────────────────────────────────────────

export interface MediaSuccessState {
  status: "success";
  platform: PlatformType;
  username: string;
  user: UnifiedUser;
  allMedia: UnifiedMedia[];
  hasMore: boolean;
  cursor?: string;
  totalCount: number;
  isLoadingMore: boolean;
  /** true quand le profil est chargé mais les vidéos sont indisponibles (API down) */
  apiUnavailable?: boolean;
}

export type MediaState =
  | { status: "idle" }
  | { status: "loading"; platform: PlatformType | null; input: string }
  | MediaSuccessState
  | { status: "error"; message: string; code?: AppErrorCode };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMedia() {
  const [state, setState] = useState<MediaState>({ status: "idle" });
  const pendingMore = useRef(false);
  const stateRef = useRef<MediaState>({ status: "idle" });

  const set = useCallback((updater: MediaState | ((prev: MediaState) => MediaState)) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  // ─── analyze ──────────────────────────────────────────────────────────────

  const analyze = useCallback(
    async (input: string, platformOverride?: PlatformType) => {
      const trimmed = input.trim();
      // platformOverride permet au sélecteur manuel de forcer la plateforme
      // (ex: @lyvirestyle → TikTok quand l'utilisateur sélectionne TikTok)
      const platform = platformOverride ?? detectPlatform(trimmed);

      if (!platform) {
        set({
          status: "error",
          message: "Lien non reconnu. Collez un profil Instagram (@username) ou une URL TikTok.",
          code: "PLATFORM_NOT_SUPPORTED",
        });
        return;
      }

      set({ status: "loading", platform, input: trimmed });
      pendingMore.current = false;

      try {
        let apiUrl: string;

        if (platform === "tiktok") {
          // TikTok avec URL → passer l'URL directement (auto-détection profil/vidéo côté serveur)
          // TikTok avec @username simple → construire l'URL de profil
          const looksLikeUrl = trimmed.includes("tiktok.com") || trimmed.startsWith("http");
          if (looksLikeUrl) {
            apiUrl = `/api/media?url=${encodeURIComponent(trimmed)}`;
          } else {
            // Username brut (@lyvirestyle ou lyvirestyle)
            const username = trimmed.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "");
            apiUrl = `/api/media?username=${encodeURIComponent(username)}&platform=tiktok`;
          }
        } else {
          // Instagram : extraire le username
          const username = extractInstagramUsername(trimmed);
          if (!username) {
            set({
              status: "error",
              message: "Username Instagram invalide. Ex : @nasa ou instagram.com/nasa",
              code: "INVALID_URL",
            });
            return;
          }
          apiUrl = `/api/media?username=${encodeURIComponent(username)}&platform=instagram`;
        }

        const res = await fetch(apiUrl);
        const json = await res.json();

        if (!res.ok) {
          set({
            status: "error",
            message: json.error ?? "Une erreur est survenue.",
            code: json.code ?? "FETCH_ERROR",
          });
          return;
        }

        set({
          status: "success",
          platform: json.platform ?? platform,
          username: json.user?.username ?? "",
          user: json.user,
          allMedia: json.media ?? [],
          hasMore: json.has_next_page ?? false,
          cursor: json.end_cursor,
          totalCount: json.total_count ?? json.user?.media_count ?? (json.media?.length ?? 0),
          isLoadingMore: false,
          apiUnavailable: json.api_unavailable ?? false,
        });
      } catch {
        set({
          status: "error",
          message: "Erreur réseau. Vérifiez votre connexion et réessayez.",
          code: "FETCH_ERROR",
        });
      }
    },
    [set]
  );

  // ─── loadMore (Instagram + TikTok) ────────────────────────────────────────
  // FIX : suppression du filtre `platform !== "instagram"` qui bloquait TikTok

  const loadMore = useCallback(async () => {
    if (pendingMore.current) return;

    set((prev) => {
      if (prev.status !== "success" || !prev.hasMore || !prev.cursor) return prev;
      pendingMore.current = true;
      return { ...prev, isLoadingMore: true };
    });

    const snap = stateRef.current;
    if (snap.status !== "success" || !snap.cursor || !snap.hasMore) {
      pendingMore.current = false;
      return;
    }

    const { user, cursor, platform } = snap;

    try {
      let apiUrl: string;

      if (platform === "instagram") {
        // Instagram : pagination par userId + cursor
        apiUrl = `/api/media?userId=${encodeURIComponent(user.id)}&cursor=${encodeURIComponent(cursor)}`;
      } else {
        // TikTok : pagination par userId numérique (API mobile TikTok)
        // user.id = userId numérique récupéré via HTML scraping
        apiUrl = `/api/media?userId=${encodeURIComponent(user.id)}&platform=tiktok&cursor=${encodeURIComponent(cursor)}`;
      }

      const res = await fetch(apiUrl);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Pagination error");

      set((prev) => {
        if (prev.status !== "success") return prev;
        const existingIds = new Set(prev.allMedia.map((m) => m.id));
        const newMedia = (json.media as UnifiedMedia[]).filter((m) => !existingIds.has(m.id));
        return {
          ...prev,
          allMedia: [...prev.allMedia, ...newMedia],
          hasMore: json.has_next_page ?? false,
          cursor: json.end_cursor,
          isLoadingMore: false,
        };
      });
    } catch {
      set((prev) =>
        prev.status === "success" ? { ...prev, isLoadingMore: false } : prev
      );
    } finally {
      pendingMore.current = false;
    }
  }, [set]);

  // ─── loadAll (Instagram + TikTok) ────────────────────────────────────────
  // FIX : fonctionne maintenant pour les deux plateformes

  const loadAll = useCallback(async () => {
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    while (true) {
      const s = stateRef.current;
      // Arrêter si : pas de succès, plus de pages, ou pas de cursor
      if (s.status !== "success" || !s.hasMore || !s.cursor) break;
      if (pendingMore.current) { await wait(300); continue; }
      loadMore();
      await wait(400);
      while (pendingMore.current) await wait(300);
    }
  }, [loadMore]);

  // ─── reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    pendingMore.current = false;
    set({ status: "idle" });
  }, [set]);

  return { state, analyze, loadMore, loadAll, reset };
}
