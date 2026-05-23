/**
 * components/Hero.tsx
 * ─────────────────────────────────────────────────────────────
 * Section d'accueil multi-plateforme — Instagram + TikTok.
 */

"use client";
import { motion } from "framer-motion";
import { Sparkles, Shield, Zap, ImageIcon } from "lucide-react";

const FEATURES = [
  { icon: Zap, label: "Sans compte requis" },
  { icon: Shield, label: "100% privé" },
  { icon: ImageIcon, label: "Photos, Vidéos, Reels & TikToks" },
  { icon: Sparkles, label: "ZIP en un clic" },
];

export function Hero() {
  return (
    <section className="relative pt-32 pb-16 px-4 text-center overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Téléchargement instantané — Instagram &amp; TikTok
        </motion.div>

        {/* Titre */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary mb-6 leading-tight">
          Téléchargez des médias{" "}
          <span className="bg-gradient-purple-blue bg-clip-text text-transparent">
            Instagram
          </span>{" "}
          &amp;{" "}
          <span
            style={{
              backgroundImage: "linear-gradient(135deg, #ff0050 0%, #00f2ea 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            TikTok
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto max-w-2xl text-lg text-text-secondary mb-10 leading-relaxed">
          Collez un profil Instagram public ou une URL de vidéo TikTok — téléchargez
          photos, vidéos, reels, carrousels et slideshows, individuellement ou en ZIP.
        </p>

        {/* Plateformes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex justify-center gap-3 mb-8"
        >
          <PlatformPill
            gradient="linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)"
            label="Instagram"
            icon={<InstagramSvg />}
          />
          <PlatformPill
            gradient="linear-gradient(135deg, #ff0050, #00f2ea)"
            label="TikTok"
            icon={<TikTokSvg />}
          />
        </motion.div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ─── Platform pill ────────────────────────────────────────────────────────────

function PlatformPill({
  gradient,
  label,
  icon,
}: {
  gradient: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
      style={{ background: gradient }}
    >
      <span className="h-4 w-4">{icon}</span>
      {label}
    </div>
  );
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function InstagramSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function TikTokSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.84 4.84 0 0 1-1.07-.1z" />
    </svg>
  );
}
