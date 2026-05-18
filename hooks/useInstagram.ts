"use client";
import { useState, useCallback, useRef } from "react";
import type { InstagramMedia, InstagramUser } from "@/types/instagram";
import { extractUsername } from "@/lib/utils";

export interface SuccessState {
  status: "success";
  username: string;
  user: InstagramUser;
  allMedia: InstagramMedia[];
  hasMore: boolean;
  cursor?: string;
  totalCount: number;
  isLoadingMore: boolean;
}

type State =
  | { status: "idle" }
  | { status: "loading"; username: string }
  | SuccessState
  | { status: "error"; message: string; code?: string };

export function useInstagram() {
  const [state, setState] = useState<State>({ status: "idle" });
  const pendingMore = useRef(false);
  const stateRef = useRef<State>({ status: "idle" });

  const set = useCallback((updater: State | ((prev: State) => State)) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  const analyze = useCallback(async (input: string) => {
    const username = extractUsername(input);
    if (!username) {
      set({ status: "error", message: "Lien ou nom d'utilisateur Instagram invalide." });
      return;
    }

    set({ status: "loading", username });
    pendingMore.current = false;

    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
      const json = await res.json();

      if (!res.ok) {
        set({ status: "error", message: json.error ?? "Impossible d'analyser ce profil.", code: json.code });
        return;
      }

      set({
        status: "success",
        username,
        user: json.user,
        allMedia: json.media ?? [],
        hasMore: json.has_next_page ?? false,
        cursor: json.end_cursor,
        totalCount: json.user?.media_count ?? 0,
        isLoadingMore: false,
      });
    } catch {
      set({ status: "error", message: "Erreur réseau. Vérifiez votre connexion et réessayez." });
    }
  }, [set]);

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

    const { user, cursor } = snap;

    try {
      const res = await fetch(
        `/api/profile?userId=${encodeURIComponent(user.id)}&cursor=${encodeURIComponent(cursor)}`
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Pagination error");

      set((prev) => {
        if (prev.status !== "success") return prev;
        const existingIds = new Set(prev.allMedia.map((m) => m.id));
        const newMedia = (json.media as InstagramMedia[]).filter((m) => !existingIds.has(m.id));
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

  const loadAll = useCallback(async () => {
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    while (true) {
      const s = stateRef.current;
      if (s.status !== "success" || !s.hasMore || !s.cursor) break;
      if (pendingMore.current) { await wait(300); continue; }
      loadMore();
      await wait(300);
      while (pendingMore.current) await wait(300);
    }
  }, [loadMore]);

  const reset = useCallback(() => {
    pendingMore.current = false;
    set({ status: "idle" });
  }, [set]);

  return { state, analyze, loadMore, loadAll, reset };
}
