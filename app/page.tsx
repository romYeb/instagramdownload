"use client";
import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { URLInput } from "@/components/URLInput";
import { ProfileHeader } from "@/components/ProfileHeader";
import { MediaGrid } from "@/components/MediaGrid";
import { DownloadPanel } from "@/components/DownloadPanel";
import { HistorySection } from "@/components/HistorySection";
import { PulseLoader } from "@/components/ui/Spinner";
import { useMedia } from "@/hooks/useMedia";
import { useDownload } from "@/hooks/useDownload";

// ─── Labels de chargement par étape ──────────────────────────────────────────

const LOADING_STEPS_INSTAGRAM = [
  "Connexion à Instagram...",
  "Analyse du profil...",
  "Chargement des médias...",
  "Récupération des thumbnails...",
];

const LOADING_STEPS_TIKTOK = [
  "Connexion à TikTok...",
  "Extraction des métadonnées...",
  "Récupération de la vidéo...",
  "Finalisation...",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { state, analyze, loadMore, loadAll, reset } = useMedia();

  // Infos dérivées de l'état
  const username =
    state.status === "success" || state.status === "loading"
      ? (state.status === "success" ? state.username : "") ?? ""
      : "";
  const platform = state.status === "success" ? state.platform : "instagram";

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
  } = useDownload(username, platform);

  // ── Sauvegarde dans l'historique au chargement initial ─────────────────────
  useEffect(() => {
    if (state.status === "success" && !state.isLoadingMore) {
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: state.platform,
          username: state.user.username,
          full_name: state.user.display_name,
          profile_pic_url: state.user.avatar_url,
          follower_count: state.user.follower_count,
          media_count: state.allMedia.length,
          session_id: crypto.randomUUID(),
        }),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const handleDownloadSelected = useCallback(() => {
    if (state.status !== "success") return;
    downloadSelected(state.allMedia);
  }, [state, downloadSelected]);

  // ── État de chargement ─────────────────────────────────────────────────────
  const isLoading = state.status === "loading";
  const loadingPlatform = state.status === "loading" ? state.platform : null;
  const LOADING_STEPS =
    loadingPlatform === "tiktok" ? LOADING_STEPS_TIKTOK : LOADING_STEPS_INSTAGRAM;
  const loadingStepIdx = Math.floor(Date.now() / 1500) % LOADING_STEPS.length;

  // FIX : la pagination fonctionne maintenant pour Instagram ET TikTok
  const canLoadMore = state.status === "success" && state.hasMore;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pb-20">
        {/* Hero (masqué après succès) */}
        <AnimatePresence mode="wait">
          {state.status !== "success" && (
            <motion.div key="hero" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Hero />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Champ URL */}
        <div className={state.status === "success" ? "pt-20 pb-6" : "pb-10"}>
          <URLInput
            onAnalyze={(input, platformOverride) => analyze(input, platformOverride)}
            loading={isLoading}
            error={state.status === "error" ? state.message : undefined}
            onClear={reset}
          />
        </div>

        {/* Chargement */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-16"
            >
              <PulseLoader label={LOADING_STEPS[loadingStepIdx]} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Résultats */}
        <AnimatePresence>
          {state.status === "success" && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* En-tête profil / auteur */}
              <ProfileHeader
                user={state.user}
                platform={state.platform}
                mediaCount={state.allMedia.length}
              />

              {state.allMedia.length > 0 ? (
                <>
                  {/* Panneau de téléchargement ZIP */}
                  <DownloadPanel
                    selectedCount={selected.size}
                    totalCount={state.allMedia.length}
                    zipState={zipState}
                    onDownloadSelected={handleDownloadSelected}
                    onDownloadAll={handleDownloadSelected}
                    onCancelZip={cancelZip}
                  />

                  {/* Grille de médias */}
                  <MediaGrid
                    media={state.allMedia}
                    selected={selected}
                    downloads={downloads}
                    onSelect={toggleSelect}
                    onDownload={downloadOne}
                    onSelectAll={() => selectAll(state.allMedia)}
                    onClearSelected={clearSelected}
                    hasMore={canLoadMore}
                    isLoadingMore={state.isLoadingMore}
                    loadedCount={state.allMedia.length}
                    totalCount={state.totalCount}
                    onLoadMore={loadMore}
                    onLoadAll={loadAll}
                  />
                </>
              ) : state.apiUnavailable ? (
                /* API TikTok temporairement indisponible (tikwm.com down) */
                <div className="mx-auto max-w-4xl px-4">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-10 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                        <AlertTriangle className="h-6 w-6 text-amber-400" />
                      </div>
                    </div>
                    <p className="font-semibold text-amber-300">
                      API TikTok temporairement indisponible
                    </p>
                    <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
                      Le service tiers utilisé pour récupérer les vidéos TikTok est
                      actuellement hors ligne (tikwm.com).{" "}
                      {state.totalCount ? (
                        <>Ce profil possède <strong>{state.totalCount} vidéos</strong> mais elles ne peuvent pas être chargées pour le moment.</>
                      ) : null}
                    </p>
                    <p className="mt-3 text-xs text-text-muted">
                      Réessayez dans 5–10 minutes. Le service est généralement disponible la plupart du temps.
                    </p>
                    <button
                      onClick={() => analyze(state.username, "tiktok")}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Réessayer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-4xl px-4">
                  <div className="rounded-2xl border border-border bg-surface py-16 text-center">
                    <p className="text-text-secondary">
                      Aucun média accessible sur ce profil / cette URL.
                    </p>
                    {state.user.is_private && (
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

        {/* Historique */}
        {state.status !== "loading" && (
          <div className="mt-16">
            <HistorySection />
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-text-muted">
        <p>
          Lia Downloader — Cet outil utilise uniquement les données publiques
          d&apos;Instagram et TikTok.
        </p>
        <p className="mt-1">
          Respectez les conditions d&apos;utilisation des plateformes et les
          droits d&apos;auteur des créateurs.
        </p>
      </footer>
    </div>
  );
}
