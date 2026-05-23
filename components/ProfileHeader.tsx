/**
 * components/ProfileHeader.tsx
 * ─────────────────────────────────────────────────────────────
 * Affiche les informations du profil/auteur.
 * Compatible Instagram (profil complet) et TikTok (auteur de la vidéo).
 */

"use client";
import { motion } from "framer-motion";
import { CheckCircle2, Users, Grid3X3, ExternalLink, Lock } from "lucide-react";
import type { UnifiedUser, PlatformType } from "@/types/media";
import { formatNumber } from "@/lib/utils";
import { Badge } from "./ui/Badge";

interface ProfileHeaderProps {
  user: UnifiedUser;
  platform: PlatformType;
  mediaCount: number;
}

export function ProfileHeader({ user, platform, mediaCount }: ProfileHeaderProps) {
  const isTikTok = platform === "tiktok";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-4xl px-4"
    >
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="h-20 w-20 rounded-full p-0.5 shadow-glow"
              style={{
                background: isTikTok
                  ? "linear-gradient(135deg, #ff0050, #00f2ea)"
                  : "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
              }}
            >
              <div className="h-full w-full rounded-full overflow-hidden bg-surface-3">
                {user.avatar_url ? (
                  <img
                    src={`/api/proxy?url=${encodeURIComponent(user.avatar_url)}`}
                    alt={user.username}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-text-secondary">
                    {user.username[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
            </div>

            {user.is_verified && (
              <div className="absolute -bottom-1 -right-1 rounded-full bg-accent p-0.5">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-xl font-semibold text-text-primary truncate">
                {user.display_name || user.username}
              </h2>
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                {/* Badge plateforme */}
                <PlatformBadge platform={platform} />

                {user.is_verified && (
                  <Badge variant="blue">
                    <CheckCircle2 className="h-3 w-3" /> Vérifié
                  </Badge>
                )}
                {user.is_private && (
                  <Badge variant="orange">
                    <Lock className="h-3 w-3" /> Privé
                  </Badge>
                )}
                {user.category && (
                  <Badge variant="default">{user.category}</Badge>
                )}
              </div>
            </div>

            <a
              href={user.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors mb-3"
            >
              @{user.username}
              <ExternalLink className="h-3 w-3" />
            </a>

            {user.biography && (
              <p className="text-sm text-text-secondary leading-relaxed mb-4 max-w-lg line-clamp-2">
                {user.biography}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-6 justify-center sm:justify-start flex-wrap">
              {user.media_count !== undefined && !isTikTok && (
                <Stat
                  label="Publications"
                  value={formatNumber(user.media_count)}
                  icon={Grid3X3}
                />
              )}
              {user.follower_count !== undefined && (
                <Stat
                  label="Abonnés"
                  value={formatNumber(user.follower_count)}
                  icon={Users}
                />
              )}
              {user.following_count !== undefined && !isTikTok && (
                <Stat
                  label="Abonnements"
                  value={formatNumber(user.following_count)}
                  icon={Users}
                />
              )}
              <Stat
                label={isTikTok ? "Médias" : "Chargées"}
                value={mediaCount.toString()}
                icon={Grid3X3}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-lg font-semibold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: PlatformType }) {
  if (platform === "tiktok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <TikTokIcon className="h-3 w-3" />
        TikTok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
      <InstagramIcon className="h-3 w-3" />
      Instagram
    </span>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.84 4.84 0 0 1-1.07-.1z" />
    </svg>
  );
}
