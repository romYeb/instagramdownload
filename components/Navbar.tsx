/**
 * components/Navbar.tsx
 * ─────────────────────────────────────────────────────────────
 * Barre de navigation — mise à jour pour la plateforme multi-source.
 */

"use client";
import { motion } from "framer-motion";
import { Download, Github, Zap } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-purple-blue shadow-glow group-hover:shadow-glow transition-all">
              <Download className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-text-primary tracking-tight">
              Lia Downloader
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Zap className="h-2.5 w-2.5" />
              BETA
            </span>
          </Link>

          {/* Badges plateformes */}
          <div className="hidden md:flex items-center gap-2">
            <PlatformBadge type="instagram" />
            <PlatformBadge type="tiktok" />
          </div>

          {/* GitHub */}
          <a
            href="https://github.com/romYeb/instagramdownload"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

// ─── Badges plateforme ────────────────────────────────────────────────────────

function PlatformBadge({ type }: { type: "instagram" | "tiktok" }) {
  if (type === "instagram") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/20 bg-pink-500/5 px-2.5 py-1 text-[11px] font-medium text-pink-400">
        <InstagramIcon className="h-3 w-3" />
        Instagram
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-[11px] font-medium text-cyan-400">
      <TikTokIcon className="h-3 w-3" />
      TikTok
    </span>
  );
}

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

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
