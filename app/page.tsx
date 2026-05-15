"use client";
import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { URLInput } from "@/components/URLInput";
import { ProfileHeader } from "@/components/ProfileHeader";
import { MediaGrid } from "@/components/MediaGrid";
import { DownloadPanel } from "@/components/DownloadPanel";
import { HistorySection } from "@/components/HistorySection";
import { PulseLoader } from "@/components/ui/Spinner";
import { useInstagram } from "@/hooks/useInstagram";
import { useDownload } from "@/hooks/useDownload";

const LOADING_STEPS = [
  "Connexion à Instagram...",
  "Analyse du profil...",
  "Chargement des médias...",
  "Récupération des thumbnails...",
];

export default function Home() {
  const { state, analyze, reset } = useInstagram();

  const username =
    state.status === "success" || state.status === "loading"
      ? state.username ?? ""
      : "";

  const {
    items: downloads,
    selected,
    zipState,
    downloadOne,
    downloadSelected,
    toggleSelect,
    selectAll,
    clearSelected,
    cancelZip,
  } = useDownload(username);

  // Save history on success
  useEffect(() => {
    if (state.status === "success") {
      const { profile } = state;
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profile.user.username,
          full_name: profile.user.full_name,
          profile_pic_url: profile.user.profile_pic_url,
          follower_count: profile.user.follower_count,
          media_count: profile.media.length,
          session_id: crypto.randomUUID(),
        }),
      }).catch(() => {});
    }
  }, [state.status]);

  const handleDownloadSelected = useCallback(() => {
    if (state.status !== "success") return;
    downloadSelected(state.profile.media);
  }, [state, downloadSelected]);

  const isLoading = state.status === "loading";
  const loadingLabel = isLoading
    ? LOADING_STEPS[Math.floor(Date.now() / 1000) % LOADING_STEPS.length]
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pb-20">
        <AnimatePresence mode="wait">
          {state.status !== "success" && (
            <motion.div
              key="hero"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Hero />
            </motion.div>
          )}
        </AnimatePresence>

        {/* URL Input — always visible */}
        <div className={state.status === "success" ? "pt-20 pb-6" : "pb-10"}>
          <URLInput
            onAnalyze={analyze}
            loading={isLoading}
            error={state.status === "error" ? state.message : undefined}
            onClear={reset}
          />
        </div>

        {/* Loading state */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-16"
            >
              <PulseLoader label={loadingLabel} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success state */}
        <AnimatePresence>
          {state.status === "success" && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <ProfileHeader
                user={state.profile.user}
                mediaCount={state.profile.media.length}
              />

              {state.profile.media.length > 0 ? (
                <>
                  <DownloadPanel
                    selectedCount={selected.size}
                    totalCount={state.profile.media.length}
                    zipState={zipState}
                    onDownloadSelected={handleDownloadSelected}
                    onDownloadAll={handleDownloadSelected}
                    onCancelZip={cancelZip}
                  />

                  <MediaGrid
                    media={state.profile.media}
                    selected={selected}
                    downloads={downloads}
                    onSelect={toggleSelect}
                    onDownload={downloadOne}
                    onSelectAll={() => selectAll(state.profile.media)}
                    onClearSelected={clearSelected}
                  />
                </>
              ) : (
                <div className="mx-auto max-w-4xl px-4">
                  <div className="rounded-2xl border border-border bg-surface py-16 text-center">
                    <p className="text-text-secondary">
                      Aucun média accessible sur ce profil.
                    </p>
                    {state.profile.user.is_private && (
                      <p className="mt-2 text-sm text-text-muted">
                        Ce compte est privé — seuls les médias publics sont accessibles.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {state.status !== "loading" && (
          <div className="mt-16">
            <HistorySection />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-text-muted">
        <p>
          InstaGrab — Cet outil utilise uniquement les données publiques
          d&apos;Instagram.
        </p>
        <p className="mt-1">
          Respectez les conditions d&apos;utilisation d&apos;Instagram et les
          droits d&apos;auteur des créateurs.
        </p>
      </footer>
    </div>
  );
}
