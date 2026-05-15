"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Instagram,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import { Button } from "./ui/Button";

interface AuthGateProps {
  auth: AuthState;
  targetUsername: string;
  totalCount: number;
  loadedCount: number;
  onLogin: (target: string) => void;
  onLogout: () => void;
}

const PERKS = [
  { icon: Zap, label: "Chargement de tous les médias" },
  { icon: Sparkles, label: "Images, vidéos, reels, carrousels" },
  { icon: ShieldCheck, label: "Connexion sécurisée OAuth 2.0" },
];

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function AuthGate({
  auth,
  targetUsername,
  totalCount,
  loadedCount,
  onLogin,
  onLogout,
}: AuthGateProps) {
  const [showModal, setShowModal] = useState(false);
  const remaining = totalCount - loadedCount;

  // If authenticated, show a compact "connected" banner
  if (auth.status === "authenticated") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl px-4"
      >
        <div className="flex items-center justify-between rounded-2xl border border-success/20 bg-success/5 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
              <ShieldCheck className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                Connecté en tant que{" "}
                <span className="text-success">@{auth.username}</span>
              </p>
              <p className="text-xs text-text-muted">
                Accès complet au profil activé
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Déconnecter
          </button>
        </div>
      </motion.div>
    );
  }

  // Not configured — show info without blocking
  if (auth.status === "not_configured") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-4xl px-4"
      >
        <div className="flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning/5 px-5 py-4 text-sm text-warning">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Instagram OAuth non configuré.{" "}
            <span className="text-text-secondary">
              Ajoutez <code className="font-mono">INSTAGRAM_CLIENT_ID</code> et{" "}
              <code className="font-mono">INSTAGRAM_CLIENT_SECRET</code> dans{" "}
              <code className="font-mono">.env.local</code>.
            </span>
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Inline teaser block */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-4xl px-4"
      >
        {/* Gradient fade overlay to hint at more content */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Top gradient bleed */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-surface to-transparent pointer-events-none z-10" />

          <div className="px-8 py-10 flex flex-col items-center text-center">
            {/* Lock badge */}
            <div className="relative mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-purple-blue shadow-glow">
                <Lock className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary border-2 border-surface flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{remaining > 99 ? "99+" : remaining}</span>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-text-primary mb-2">
              {remaining > 0
                ? `${remaining.toLocaleString("fr-FR")} médias supplémentaires disponibles`
                : "Connectez-vous pour charger tous les médias"}
            </h3>
            <p className="text-text-secondary text-sm max-w-md mb-8 leading-relaxed">
              Connectez votre compte Instagram pour débloquer l&apos;accès complet
              à tous les médias du profil{" "}
              <span className="text-text-primary font-medium">@{targetUsername}</span>.
            </p>

            {/* Perks */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {PERKS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  {label}
                </div>
              ))}
            </div>

            <Button
              size="lg"
              onClick={() => setShowModal(true)}
              className="gap-3 bg-gradient-to-r from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] shadow-none hover:opacity-90 min-w-[260px]"
            >
              <InstagramIcon className="h-5 w-5" />
              Se connecter avec Instagram
            </Button>

            <p className="mt-4 text-xs text-text-muted">
              Connexion sécurisée · Aucun mot de passe partagé · OAuth 2.0
            </p>
          </div>
        </div>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal panel */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="relative w-full max-w-md rounded-3xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden">
                {/* Instagram gradient header */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888]" />

                <div className="p-8">
                  {/* Close */}
                  <button
                    onClick={() => setShowModal(false)}
                    className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]">
                      <InstagramIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">
                        Connexion Instagram
                      </h2>
                      <p className="text-sm text-text-secondary">
                        Accès complet au profil @{targetUsername}
                      </p>
                    </div>
                  </div>

                  {/* What happens */}
                  <div className="rounded-2xl border border-border bg-surface-2 p-4 mb-6 space-y-3">
                    {[
                      {
                        step: "1",
                        text: "Vous serez redirigé vers Instagram pour vous connecter en toute sécurité.",
                      },
                      {
                        step: "2",
                        text: "Instagram autorise notre app à effectuer des requêtes authentifiées.",
                      },
                      {
                        step: "3",
                        text: `Nous reprenons le chargement de @${targetUsername} avec accès complet.`,
                      },
                    ].map(({ step, text }) => (
                      <div key={step} className="flex items-start gap-3">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                          {step}
                        </span>
                        <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => onLogin(targetUsername)}
                    className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] py-4 text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_4px_24px_rgba(220,39,67,0.3)]"
                  >
                    <InstagramIcon className="h-5 w-5" />
                    Continuer avec Instagram
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <p className="mt-4 text-center text-xs text-text-muted">
                    Nous ne stockons jamais votre mot de passe. Protocole OAuth 2.0 officiel.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
