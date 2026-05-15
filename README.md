# InstaGrab

Téléchargeur de médias Instagram — SaaS premium dark mode.

## Fonctionnalités

- Coller un lien de profil Instagram public
- Analyse automatique du profil
- Grille de médias avec filtres (images, vidéos, reels, carrousels)
- Téléchargement individuel ou groupé en ZIP
- Progression en temps réel
- Historique des téléchargements (Supabase ou mémoire)
- Sans connexion requise

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (dark mode, accents violet/bleu)
- **Framer Motion** (animations)
- **Supabase** (optionnel — historique)
- **JSZip** (génération ZIP côté client)

## Démarrage rapide

```bash
npm install
cp .env.local.example .env.local   # optionnel (Supabase)
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Configuration Supabase (optionnel)

Crée un projet sur [supabase.com](https://supabase.com), exécute le fichier `supabase/schema.sql`, puis renseigne les variables dans `.env.local`.

## Avertissement

Cet outil utilise uniquement les données publiques d'Instagram.  
Respectez les [conditions d'utilisation d'Instagram](https://help.instagram.com/581066165581870) et les droits d'auteur des créateurs.
