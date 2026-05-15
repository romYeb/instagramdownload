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
              {history.map((entry, i) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors"
                >
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
                        <div className="h-8 w-8 rounded-full bg-gradient-purple-blue flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {entry.username[0].toUpperCase()}
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
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-text-muted" />
                      {entry.follower_count ? formatNumber(entry.follower_count) : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="purple">{entry.media_count} médias</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-text-muted" />
                      <span className="text-xs">{formatDate(entry.downloaded_at)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`https://instagram.com/${entry.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}
