"use client";
import { useState, useCallback } from "react";
import type { InstagramProfile } from "@/types/instagram";
import { extractUsername } from "@/lib/utils";

type State =
  | { status: "idle" }
  | { status: "loading"; username: string }
  | { status: "success"; profile: InstagramProfile; username: string }
  | { status: "error"; message: string; code?: string };

export function useInstagram() {
  const [state, setState] = useState<State>({ status: "idle" });

  const analyze = useCallback(async (input: string) => {
    const username = extractUsername(input);
    if (!username) {
      setState({ status: "error", message: "Lien ou nom d'utilisateur Instagram invalide." });
      return;
    }

    setState({ status: "loading", username });

    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
      const json = await res.json();

      if (!res.ok) {
        setState({
          status: "error",
          message: json.error ?? "Impossible d'analyser ce profil.",
          code: json.code,
        });
        return;
      }

      setState({ status: "success", profile: json, username });
    } catch {
      setState({
        status: "error",
        message: "Erreur réseau. Vérifiez votre connexion et réessayez.",
      });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, analyze, reset };
}
