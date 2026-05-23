/**
 * components/HistorySection.tsx
 * ─────────────────────────────────────────────────────────────
 * Historique des téléchargements récents.
 * Affiche maintenant le badge plateforme (Instagram / TikTok).
 */

"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Clock, Users, ExternalLink } from "lucide-react";
import type { DownloadHistory } from "@/types/instagram";
import { formatNumber, formatDate } from "@/lib/utils";
import { Badge } from "./ui/Badge";

export function HistorySection() {
  const [history, setHistory] = useState<DownloadHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || history.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-4xl px-4"
    >
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-text-muted" />
        <h3 className="text-base font-semibold text-text-primary">
          Historique récent
        </h3>
        <Badge variant="default">{history.length}</Badge>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wide">
                  Profil
                </th>
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wide hidden sm:table-cell">
                  Plateforme
                </th>
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wide hidden sm:table-cell">
                  Abonnés
                </th>
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wide">
                  Médias
                </th>
                <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wide hidden md:table-cell">
                  Date
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {history.map((entry, i) => {
                const platform = entry.platform ?? "instagram";
                const profileUrl =
                  platform === "tiktok"
                    ? `https://www.tiktok.com/@${entry.username}`
                    : `https://instagram.com/${entry.username}`;

                return (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors"
                  >
                    {/* Avatar + nom */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {entry.profile_pic_url ? (
                          <img
                            src={`/api/proxy?url=${encodeURIComponent(entry.profile_pic_url)}`}
                            alt={entry.username}
                            className="h-8 w-8 rounded-full object-cover bg-surface-3 flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{
                              background:
                                platform === "tiktok"
                                  ? "linear-gradient(135deg, #ff0050, #00f2ea)"
                                  : "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                            }}
                          >
                            {entry.username[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-primary">
                            {entry.full_name || entry.username}
                          </p>
                          <p className="text-xs text-text-muted">@{entry.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Badge plateforme */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <PlatformBadge platform={platform} />
                    </td>

                    {/* Abonnés */}
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-text-muted" />
                        {entry.follower_count ? formatNumber(entry.follower_count) : "—"}
                      </div>
                    </td>

                    {/* Médias */}
                    <td className="px-4 py-3">
                      <Badge variant="purple">{entry.media_count} médias</Badge>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-text-muted" />
                        <span className="text-xs">{formatDate(entry.downloaded_at)}</span>
                      </div>
                    </td>

                    {/* Lien externe */}
                    <td className="px-4 py-3 text-right">
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Voir
                      </a>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}

// ─── Badge plateforme ─────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: "instagram" | "tiktok" }) {
  if (platform === "tiktok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <TikTokIcon className="h-2.5 w-2.5" />
        TikTok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
      <InstagramIcon className="h-2.5 w-2.5" />
      Instagram
    </span>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 2.163c-3.204 0-3.584.012-4.849.07-3.26.149-4.771 1.699-4.919 4.92-.058 1.265-.07 1.644-.07 4.849 0 3.205.012 3.584.07 4.849.149 3.225 1.664 4.771 4.919 4.919 1.265.058 1.645.069 4.849.069 3.205 0 3.584-.012 4.849-.069 3.26-.149 4.771-1.699 4.919-4.919.058-1.265.069-1.644.069-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.265-.058-1.644-.07-4.849-.07zm0 3.678a6.162 6.162 0 1 1 0 12.324 6.162 6.162 0 0 1 0-12.324zm0 2.163a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm6.406-3.845a1.44 1.44 0 1 1 0 2.881 1.44 1.44 0 0 1 0-2.881z" />
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
