"use client";
import { motion } from "framer-motion";
import { Sparkles, Shield, Zap } from "lucide-react";

const FEATURES = [
  { icon: Zap, label: "Sans connexion requise" },
  { icon: Shield, label: "100% privé" },
  { icon: Sparkles, label: "Images & Vidéos & Reels" },
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
          Téléchargement instantané — sans compte Instagram
        </motion.div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary mb-6 leading-tight">
          Téléchargez les médias{" "}
          <span className="bg-gradient-purple-blue bg-clip-text text-transparent">
            Instagram
          </span>
          <br />
          en un clic
        </h1>

        {/* Subtitle */}
        <p className="mx-auto max-w-2xl text-lg text-text-secondary mb-10 leading-relaxed">
          Collez un lien de profil Instagram public, analysez le contenu et
          téléchargez images, vidéos, reels et carrousels — individuellement ou
          en ZIP.
        </p>

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
