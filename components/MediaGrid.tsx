"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3X3, List, Filter, ChevronDown, Loader2 } from "lucide-react";
import type { UnifiedMedia, UnifiedDownloadItem } from "@/types/media";
type FilterType = "all" | "image" | "video" | "carousel" | "reel";
import { MediaCard } from "./MediaCard";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

interface MediaGridProps {
  media: UnifiedMedia[];
  selected: Set<string>;
  downloads: Map<string, UnifiedDownloadItem>;
  onSelect: (id: string) => void;
  onDownload: (media: UnifiedMedia) => void;
  onSelectAll: () => void;
  onClearSelected: () => void;
  // pagination
  hasMore: boolean;
  isLoadingMore: boolean;
  loadedCount: number;
  totalCount: number;
  onLoadMore: () => void;
  onLoadAll: () => void;
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: "Tous",
  image: "Images",
  video: "Vidéos",
  carousel: "Carrousels",
  reel: "Reels",
};

export function MediaGrid({
  media,
  selected,
  downloads,
  onSelect,
  onDownload,
  onSelectAll,
  onClearSelected,
  hasMore,
  isLoadingMore,
  loadedCount,
  totalCount,
  onLoadMore,
  onLoadAll,
}: MediaGridProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [cols, setCols] = useState<3 | 4>(3);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return media;
    return media.filter((m) => m.type === filter);
  }, [media, filter]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: media.length };
    for (const m of media) acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, [media]);

  const findDownload = (mediaId: string): UnifiedDownloadItem | undefined =>
    Array.from(downloads.values()).find((item) => item.mediaId === mediaId);

  // Auto-load on scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) onLoadMore();
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  const pct = totalCount > 0 ? Math.round((loadedCount / totalCount) * 100) : 100;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl px-4"
    >
      {/* Progress bar + count */}
      {totalCount > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">
              {loadedCount.toLocaleString("fr-FR")} médias chargés
              {totalCount > loadedCount && (
                <span className="text-text-muted"> / {totalCount.toLocaleString("fr-FR")} total</span>
              )}
            </span>
            <span className="text-xs text-text-secondary font-mono">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-purple-blue"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-4 w-4 text-text-muted flex-shrink-0" />
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-shrink-0 rounded-full px-3 py-1 text-sm transition-all duration-200",
                filter === f
                  ? "bg-primary text-white"
                  : "bg-surface-3 text-text-secondary hover:text-text-primary border border-border"
              )}
            >
              {FILTER_LABELS[f]}
              {counts[f] !== undefined && (
                <span className={cn("ml-1.5 text-xs", filter === f ? "text-white/70" : "text-text-muted")}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Tout sélect.
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearSelected}>
              Désélect. ({selected.size})
            </Button>
          )}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setCols(3)}
              className={cn(
                "p-2 transition-colors",
                cols === 3 ? "bg-surface-3 text-text-primary" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCols(4)}
              className={cn(
                "p-2 border-l border-border transition-colors",
                cols === 4 ? "bg-surface-3 text-text-primary" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-text-muted">
          Aucun média de type « {FILTER_LABELS[filter]} » trouvé.
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            cols === 3
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          )}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => {
              const dl = findDownload(item.id);
              return (
                <MediaCard
                  key={item.id}
                  media={item}
                  selected={selected.has(item.id)}
                  onSelect={() => onSelect(item.id)}
                  onDownload={() => onDownload(item)}
                  downloadProgress={dl?.progress}
                  downloadStatus={dl?.status}
                  index={i}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Load More zone */}
      <div ref={sentinelRef} className="mt-10 flex flex-col items-center gap-4">
        {isLoadingMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-text-secondary">
              Chargement de la page suivante...
            </p>
          </motion.div>
        )}

        {hasMore && !isLoadingMore && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={onLoadMore}
                className="gap-2"
              >
                <ChevronDown className="h-4 w-4" />
                Charger plus
              </Button>
              <Button
                size="md"
                onClick={onLoadAll}
                className="gap-2 bg-gradient-purple-blue text-white border-0 hover:opacity-90"
              >
                <Loader2 className="h-4 w-4" />
                Tout charger ({(totalCount - loadedCount).toLocaleString("fr-FR")} restants)
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              {loadedCount} / {totalCount} médias
            </p>
          </motion.div>
        )}

        {!hasMore && loadedCount > 0 && (
          <p className="text-xs text-text-muted py-4">
            ✓ Tous les {loadedCount} médias publics ont été chargés.
          </p>
        )}
      </div>
    </motion.section>
  );
}
