"use client";
import { motion } from "framer-motion";
import { Download, Github, Zap, LogOut } from "lucide-react";
import Link from "next/link";
import type { AuthState } from "@/hooks/useAuth";

interface NavbarProps {
  auth?: AuthState;
  onLogout?: () => void;
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function Navbar({ auth, onLogout }: NavbarProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-purple-blue shadow-glow group-hover:shadow-glow transition-all">
              <Download className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-text-primary tracking-tight">
              InstaGrab
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Zap className="h-2.5 w-2.5" />
              BETA
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {auth?.status === "authenticated" && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#f09433] to-[#bc1888] flex items-center justify-center">
                  <InstagramIcon className="h-3 w-3 text-white" />
                </div>
                <span className="text-xs text-text-secondary font-medium">
                  @{auth.username}
                </span>
                <button
                  onClick={onLogout}
                  className="ml-1 text-text-muted hover:text-error transition-colors"
                  title="Déconnecter"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            )}

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
      </div>
    </motion.nav>
  );
}
