/**
 * components/URLInput.tsx
 * ─────────────────────────────────────────────────────────────
 * Champ de saisie avec détection automatique de plateforme.
 * Affiche un badge dynamique Instagram / TikTok selon l'URL collée.
 * Si l'utilisateur tape un @username sans URL, propose un sélecteur
 * de plateforme (Instagram ou TikTok).
 */

"use client";
import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";
import { detectPlatform } from "@/lib/utils/platform";
import type { PlatformType } from "@/types/media";

interface URLInputProps {
  onAnalyze: (input: string, platformOverride?: PlatformType) => void;
  loading?: boolean;
  error?: string;
  onClear?: () => void;
}

const EXAMPLES = [
  { label: "@nasa (Instagram)", value: "nasa", platform: "instagram" as PlatformType },
  { label: "Profil Instagram", value: "https://www.instagram.com/natgeo/", platform: undefined },
  { label: "@lyvirestyle (TikTok)", value: "lyvirestyle", platform: "tiktok" as PlatformType },
  { label: "Profil TikTok", value: "https://www.tiktok.com/@lyvirestyle", platform: undefined },
];

/**
 * Retourne true si l'input ressemble à un simple @username sans domaine.
 * Dans ce cas on ne peut pas auto-détecter la plateforme → sélecteur manuel.
 */
function isPlainUsername(input: string): boolean {
  const clean = input.trim().replace(/^@/, "");
  if (!clean) return false;
  // Pas de slash, pas de domaine (no .com / .fr / etc.)
  return (
    !clean.includes("/") &&
    !/\.[a-z]{2,}/.test(clean) &&
    /^[a-zA-Z0-9._]{1,30}$/.test(clean)
  );
}

export function URLInput({ onAnalyze, loading, error, onClear }: URLInputProps) {
  const [value, setValue] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformType | null>(null);
  const [manualPlatform, setManualPlatform] = useState<PlatformType>("instagram");
  const inputRef = useRef<HTMLInputElement>(null);

  // Quand l'input est un @username simple, on affiche le sélecteur
  const showPlatformSelector = isPlainUsername(value) && !loading;
  // La plateforme effective (auto-détectée OU choisie manuellement)
  const effectivePlatform = showPlatformSelector ? manualPlatform : detectedPlatform;

  const handleChange = (v: string) => {
    setValue(v);
    if (isPlainUsername(v)) {
      setDetectedPlatform(null); // on laisse le sélecteur décider
    } else {
      setDetectedPlatform(v.trim() ? detectPlatform(v.trim()) : null);
    }
  };

  const submit = (inputVal: string, override?: PlatformType) => {
    if (!inputVal.trim()) return;
    onAnalyze(inputVal.trim(), override ?? (showPlatformSelector ? manualPlatform : undefined));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(value);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit(value);
  };

  const handleClear = () => {
    setValue("");
    setDetectedPlatform(null);
    setManualPlatform("instagram");
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mx-auto max-w-2xl px-4"
    >
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-2xl border bg-surface p-2 transition-all duration-200",
            error
              ? "border-error/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
              : "border-border focus-within:border-primary/40 focus-within:shadow-glow"
          )}
        >
          {/* Icône plateforme ou loupe */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-3 overflow-hidden">
            <AnimatePresence mode="wait">
              {effectivePlatform === "instagram" ? (
                <motion.span
                  key="ig"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <InstagramIcon className="h-5 w-5 text-pink-500" />
                </motion.span>
              ) : effectivePlatform === "tiktok" ? (
                <motion.span
                  key="tt"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <TikTokIcon className="h-5 w-5 text-cyan-400" />
                </motion.span>
              ) : (
                <motion.span
                  key="search"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Search className="h-4 w-4 text-text-muted" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="@username · instagram.com/user · tiktok.com/@user"
            className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none text-sm sm:text-base"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
          />

          {/* Badge plateforme auto-détectée (URL uniquement) */}
          <AnimatePresence>
            {detectedPlatform && !showPlatformSelector && !loading && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0",
                  detectedPlatform === "tiktok"
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                )}
              >
                {detectedPlatform === "tiktok" ? "TikTok" : "Instagram"}
              </motion.span>
            )}
          </AnimatePresence>

          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <Button
            type="submit"
            size="sm"
            loading={loading}
            disabled={!value.trim() || loading}
            className="flex-shrink-0 gap-1.5"
          >
            {loading ? "Analyse..." : (
              <>
                Analyser
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ── Sélecteur de plateforme (affiché quand l'input est un @username) ── */}
      <AnimatePresence>
        {showPlatformSelector && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 overflow-hidden"
          >
            <div className="flex items-center gap-3 justify-center">
              <span className="text-xs text-text-muted">Plateforme :</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManualPlatform("instagram")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    manualPlatform === "instagram"
                      ? "border-pink-500/40 bg-pink-500/10 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.15)]"
                      : "border-border text-text-muted hover:border-pink-500/30 hover:text-pink-400"
                  )}
                >
                  <InstagramIcon className="h-3.5 w-3.5" />
                  Instagram
                </button>
                <button
                  type="button"
                  onClick={() => setManualPlatform("tiktok")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    manualPlatform === "tiktok"
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                      : "border-border text-text-muted hover:border-cyan-500/30 hover:text-cyan-400"
                  )}
                >
                  <TikTokIcon className="h-3.5 w-3.5" />
                  TikTok
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erreur */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-start gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Exemples */}
      {!loading && !error && !showPlatformSelector && (
        <div className="mt-3 flex flex-wrap items-center gap-2 justify-center">
          <span className="text-xs text-text-muted">Exemples :</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.value}
              type="button"
              onClick={() => {
                handleChange(ex.value);
                if (ex.platform) setManualPlatform(ex.platform);
                submit(ex.value, ex.platform);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Icônes SVG ───────────────────────────────────────────────────────────────

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
