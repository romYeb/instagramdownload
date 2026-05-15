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

  const analyze = useCallback(async (input: string) => {
    const username = extractUsername(input);
    if (!username) {
      setState({ status: "error", message: "Lien ou nom d'utilisateur Instagram invalide." });
      return;
    }

    setState({ status: "loading", username });
    pendingMore.current = false;

    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
      const json = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: json.error ?? "Impossible d'analyser ce profil.", code: json.code });
        return;
      }

      setState({
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
      setState({ status: "error", message: "Erreur réseau. Vérifiez votre connexion et réessayez." });
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (pendingMore.current) return;

    setState((prev) => {
      if (prev.status !== "success" || !prev.hasMore || !prev.cursor) return prev;
      pendingMore.current = true;
      return { ...prev, isLoadingMore: true };
    });

    // Read current state synchronously via a snapshot
    let snap: SuccessState | null = null;
    setState((prev) => {
      if (prev.status === "success") snap = prev;
      return prev;
    });

    if (!snap || !(snap as SuccessState).cursor || !(snap as SuccessState).hasMore) {
      pendingMore.current = false;
      return;
    }

    const { user, cursor } = snap as SuccessState;

    try {
      const res = await fetch(
        `/api/profile?userId=${encodeURIComponent(user.id)}&cursor=${encodeURIComponent(cursor!)}`
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Pagination error");

      setState((prev) => {
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
      setState((prev) =>
        prev.status === "success" ? { ...prev, isLoadingMore: false } : prev
      );
    } finally {
      pendingMore.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    pendingMore.current = false;
    setState({ status: "idle" });
  }, []);

  return { state, analyze, loadMore, reset };
}
