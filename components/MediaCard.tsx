/**
 * components/MediaCard.tsx
 * ─────────────────────────────────────────────────────────────
 * Carte individuelle d'un média.
 * Compatible UnifiedMedia (Instagram + TikTok).
 */

"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Play, Images, Heart, MessageCircle, Share2, CheckCircle2, Eye } from "lucide-react";
import type { UnifiedMedia, UnifiedDownloadItem } from "@/types/media";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/Badge";

interface MediaCardProps {
  media: UnifiedMedia;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  downloadProgress?: number;
  downloadStatus?: UnifiedDownloadItem["status"];
  index: number;
}

const TYPE_BADGE: Record<string, { label: string; variant: "purple" | "blue" | "green" | "orange" }> = {
  video: { label: "Vidéo", variant: "blue" },
  reel: { label: "Reel", variant: "purple" },
  carousel: { label: "Carrousel", variant: "orange" },
  image: { label: "Image", variant: "green" },
};

export function MediaCard({
  media,
  selected,
  onSelect,
  onDownload,
  downloadProgress,
  downloadStatus,
  index,
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const thumbUrl = media.thumbnail_url ?? media.url;
  const proxyThumb = thumbUrl ? `/api/proxy?url=${encodeURIComponent(thumbUrl)}` : "";
  const badge = TYPE_BADGE[media.type] ?? { label: media.type, variant: "default" as const };
  const isDownloading = downloadStatus === "downloading";
  const isDone = downloadStatus === "done";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.5) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer",
        selected
          ? "border-primary/60 shadow-glow ring-1 ring-primary/30"
          : "border-border hover:border-border-2 shadow-card hover:shadow-card-hover"
      )}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-surface-3 relative overflow-hidden">
        {proxyThumb && !imgError ? (
          <img
            src={proxyThumb}
            alt={media.caption?.slice(0, 50) ?? `Media ${media.id}`}
            className={cn(
              "h-full w-full object-cover transition-transform duration-500",
              hovered && "scale-105"
            )}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-surface-3">
            <span className="text-text-muted text-xs text-center px-4">
              Aperçu indisponible
            </span>
          </div>
        )}

        {/* Overlay gradient */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200",
            hovered ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Icône type */}
        {(media.type === "video" || media.type === "reel") && (
          <div className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 backdrop-blur-sm">
            <Play className="h-3 w-3 text-white fill-white" />
          </div>
        )}
        {media.type === "carousel" && media.children && (
          <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm flex items-center gap-1">
            <Images className="h-3 w-3 text-white" />
            <span className="text-[10px] text-white font-medium">{media.children.length}</span>
          </div>
        )}

        {/* Checkbox sélection */}
        <div
          className={cn(
            "absolute top-2 left-2 h-5 w-5 rounded-full border-2 transition-all duration-200",
            selected
              ? "border-primary bg-primary"
              : "border-white/60 bg-black/30 opacity-0 group-hover:opacity-100"
          )}
        >
          {selected && <CheckCircle2 className="h-full w-full text-white p-0.5" />}
        </div>

        {/* Badge plateforme TikTok */}
        {media.platform === "tiktok" && (
          <div className="absolute bottom-2 left-2 rounded-full bg-black/60 backdrop-blur-sm px-1.5 py-0.5 flex items-center gap-1">
            <TikTokMiniIcon className="h-3 w-3 text-cyan-400" />
          </div>
        )}

        {/* Progression du téléchargement */}
        {isDownloading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <div className="text-white text-sm font-medium">{downloadProgress ?? 0}%</div>
            <div className="w-3/4 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-purple-blue rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {isDone && (
          <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
        )}

        {/* Bouton téléchargement au survol */}
        {!isDownloading && !isDone && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className={cn(
              "absolute bottom-2 right-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-2 text-white transition-all duration-200",
              hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            )}
            title="Télécharger"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="bg-surface px-3 py-2">
        <div className="flex items-center justify-between">
          <Badge variant={badge.variant as "purple" | "blue" | "green" | "orange"}>
            {badge.label}
          </Badge>
          <div className="flex items-center gap-2.5 text-xs text-text-muted">
            {(media.like_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {formatNumber(media.like_count!)}
              </span>
            )}
            {(media.comment_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {formatNumber(media.comment_count!)}
              </span>
            )}
            {(media.share_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Share2 className="h-3 w-3" />
                {formatNumber(media.share_count!)}
              </span>
            )}
            {(media.view_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatNumber(media.view_count!)}
              </span>
            )}
          </div>
        </div>
        {media.caption && (
          <p className="mt-1.5 text-xs text-text-muted line-clamp-2 leading-relaxed">
            {media.caption}
          </p>
        )}
        {media.music && (
          <p className="mt-1 text-[10px] text-text-muted truncate opacity-70">
            🎵 {media.music}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function TikTokMiniIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.84 4.84 0 0 1-1.07-.1z" />
    </svg>
  );
}
