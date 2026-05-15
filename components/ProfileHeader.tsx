"use client";
import { motion } from "framer-motion";
import { CheckCircle2, Users, Grid3X3, ExternalLink, Lock } from "lucide-react";
import Image from "next/image";
import type { InstagramUser } from "@/types/instagram";
import { formatNumber } from "@/lib/utils";
import { Badge } from "./ui/Badge";

interface ProfileHeaderProps {
  user: InstagramUser;
  mediaCount: number;
}

export function ProfileHeader({ user, mediaCount }: ProfileHeaderProps) {
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
            <div className="h-20 w-20 rounded-full bg-gradient-purple-blue p-0.5 shadow-glow">
              <div className="h-full w-full rounded-full overflow-hidden bg-surface-3">
                {user.profile_pic_url ? (
                  <img
                    src={`/api/proxy?url=${encodeURIComponent(user.profile_pic_url)}`}
                    alt={user.username}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-text-secondary">
                    {user.username[0].toUpperCase()}
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

          {/* Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-text-primary truncate">
                {user.full_name || user.username}
              </h2>
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
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
              href={`https://instagram.com/${user.username}`}
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
            <div className="flex gap-6 justify-center sm:justify-start">
              {[
                { label: "Publications", value: formatNumber(user.media_count), icon: Grid3X3 },
                { label: "Abonnés", value: formatNumber(user.follower_count), icon: Users },
                { label: "Chargées", value: mediaCount.toString(), icon: Grid3X3 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center sm:text-left">
                  <div className="text-lg font-semibold text-text-primary">{value}</div>
                  <div className="text-xs text-text-muted flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
