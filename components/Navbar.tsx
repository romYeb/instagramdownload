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
