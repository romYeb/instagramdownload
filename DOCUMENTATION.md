# 📱 InstaGrab — Documentation complète

> Dernière mise à jour : 2026-05-23

---

## 🎯 Description

**InstaGrab** est un outil web SaaS qui permet de **télécharger tous les médias publics d'un profil Instagram** (photos, vidéos, reels, carrousels) sans avoir besoin d'un compte Instagram connecté côté utilisateur.

---

## 🏗️ Stack technique

| Couche       | Technologie                                  |
|--------------|----------------------------------------------|
| Framework    | **Next.js 14** (App Router)                  |
| Language     | **TypeScript**                               |
| UI           | **Tailwind CSS** + **Framer Motion**         |
| Base de données | **Supabase** (optionnel, historique persistant) |
| Fallback BDD | In-memory (si Supabase non configuré)        |
| HTTP serveur | **Axios**                                    |
| ZIP          | **JSZip**                                    |
| Icônes       | **Lucide React**                             |
| Deploy       | **Vercel**                                   |

---

## ⚙️ Fonctionnalités principales

### 1. 🔍 Analyse de profil

- L'utilisateur colle un **lien Instagram** (ex: `https://instagram.com/nasa`) ou un **@username**
- L'app extrait le nom d'utilisateur et appelle `/api/profile`
- Deux stratégies de fetch en **cascade/fallback** :
  1. `web_profile_info` API Instagram (principale)
  2. GraphQL legacy `?__a=1&__d=dis` (secours si la première échoue)
- En cas d'erreur : message affiché avec code (`PRIVATE_ACCOUNT`, `NOT_FOUND`, `FETCH_ERROR`)
- Informations profil affichées :
  - Photo de profil (HD si disponible)
  - Nom complet, bio, lien externe
  - Nombre de followers / following
  - Nombre total de posts
  - Badge vérifié ✓
  - Indicateur compte privé 🔒

---

### 2. 🖼️ Grille de médias avec pagination

- Charge les **premiers médias** à l'ouverture du profil
- **Scroll infini automatique** via `IntersectionObserver` (sentinel à 300px du bas)
- Boutons manuels :
  - **"Charger plus"** → page suivante uniquement
  - **"Tout charger"** → charge toutes les pages en boucle automatique
- Barre de progression : `X / Y médias chargés (Z%)`
- Déduplication automatique des médias (pas de doublons si plusieurs pages)

#### Pagination API (deux stratégies en fallback)
| Stratégie | URL | Médias/page |
|---|---|---|
| GraphQL query_hash | `/graphql/query/?query_hash=...` | 50 |
| UserFeed API | `/api/v1/feed/user/{userId}/?count=50` | 50 |

---

### 3. 🎬 Types de médias supportés

| Type | Description | Téléchargement |
|---|---|---|
| `image` | Photo simple | `.jpg` |
| `video` | Vidéo standard | `.mp4` |
| `reel` | Reel Instagram | `.mp4` |
| `carousel` | Album multi-médias | Chaque enfant individuellement |

---

### 4. 🔽 Téléchargement

#### Téléchargement unitaire
- Un clic sur le bouton ⬇ d'une carte média
- Barre de progression en temps réel (streaming `ReadableStream`)
- Déclenche automatiquement le téléchargement navigateur (`<a download>`)
- Nommage : `{username}_{mediaId}.jpg/.mp4`

#### Téléchargement sélection / tout télécharger
- Cocher plusieurs médias → cliquer **"Télécharger la sélection"**
- Sans sélection → **"Tout télécharger"** = tous les médias chargés
- Génère un fichier **ZIP** via JSZip :
  - Dossier interne nommé `{username}/`
  - Carrousels : chaque enfant nommé `{username}_{mediaId}_1.jpg`, `_2.jpg`, etc.
  - Nom du ZIP final : `{username}_instagram.zip`
- Indicateur de progression ZIP : `X / Y médias (generating...)`
- Bouton **"Annuler"** pendant la génération du ZIP

---

### 5. 🔒 Proxy de téléchargement (`/api/proxy`)

Les URLs CDN d'Instagram sont signées et bloquées en CORS côté navigateur. Le proxy serveur contourne ce problème :

- Route : `GET /api/proxy?url=<encoded_cdn_url>`
- **Whitelist stricte** des domaines autorisés :
  - `cdninstagram.com`
  - `fbcdn.net`
  - `instagram.com`
  - `scontent.cdninstagram.com`
  - `video.cdninstagram.com`
- Toute URL hors whitelist → `403 Forbidden`
- Headers envoyés à Instagram : `User-Agent` Chrome, `Referer` instagram.com
- Cache navigateur : `Cache-Control: public, max-age=3600`

---

### 6. 🗂️ Filtres & mise en page

- **Filtres par type** (avec compteurs) :
  - Tous / Images / Vidéos / Carrousels / Reels
- **Mise en page** :
  - Grille 3 colonnes (défaut)
  - Grille 4 colonnes
- **Sélection multiple** :
  - Clic sur une carte → sélection/désélection
  - Bouton **"Tout sélectionner"**
  - Bouton **"Désélectionner (N)"**

---

### 7. 🕘 Historique des sessions

- Chaque analyse de profil est **enregistrée automatiquement** en POST vers `/api/history`
- Données enregistrées : `username`, `full_name`, `profile_pic_url`, `follower_count`, `media_count`, `downloaded_at`, `session_id`
- **Avec Supabase** : persistance en base de données (table `download_history`)
- **Sans Supabase** : stockage in-memory (50 entrées max, perdu au redémarrage serveur)
- Affichage : 20 dernières entrées, visible en bas de page

---

## 🌐 API Routes

| Route | Méthode | Paramètres | Rôle |
|---|---|---|---|
| `/api/profile` | `GET` | `username` | Fetch profil initial + 1ère page de médias |
| `/api/profile` | `GET` | `userId` + `cursor` | Pagination (page suivante) |
| `/api/proxy` | `GET` | `url` | Proxy CDN Instagram (contournement CORS) |
| `/api/history` | `GET` | — | Récupère l'historique (20 derniers) |
| `/api/history` | `POST` | body JSON | Enregistre une session de téléchargement |
| `/api/debug` | `GET` | — | Informations de configuration (debug) |

---

## 🔑 Variables d'environnement

```bash
# ─── Authentification Instagram (cookies du navigateur) ──────────────────────
# Récupérées via F12 → Application → Cookies → https://www.instagram.com
INSTAGRAM_SESSION_ID=your_sessionid_cookie   # Requis pour la pagination
INSTAGRAM_CSRF_TOKEN=your_csrftoken_cookie   # Requis

# ─── Proxy HTTP (optionnel) ──────────────────────────────────────────────────
# Format : http://user:pass@host:port
# Permet de contourner les blocages d'IP Instagram
PROXY_URL=http://user:pass@host:port

# ─── Supabase (optionnel — historique persistant) ─────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> ⚠️ **Sans `INSTAGRAM_SESSION_ID`**, la pagination avancée peut échouer.  
> ⚠️ **Sans Supabase**, l'historique est perdu à chaque redémarrage du serveur.

---

## 🗄️ Schéma base de données Supabase

Table : `download_history`

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` | Identifiant unique |
| `username` | `text` | @username Instagram |
| `full_name` | `text` | Nom affiché |
| `profile_pic_url` | `text` | URL photo de profil |
| `follower_count` | `integer` | Nombre de followers |
| `media_count` | `integer` | Nombre de médias chargés |
| `downloaded_at` | `timestamptz` | Date/heure de la session |
| `session_id` | `uuid` | Identifiant de session unique |

---

## 🔄 État de l'application (State Machine)

### useInstagram (état global du profil)
```
idle → loading → success
                → error
success → isLoadingMore (pagination)
```

### useDownload (état des téléchargements)
```
DownloadItem: pending → downloading → done
                                    → error

ZipState: idle → zipping → done
                          → error
```

---

## 📁 Structure des fichiers

```
instagramdownload/
├── app/
│   ├── layout.tsx              # Layout racine (fonts, metadata)
│   ├── page.tsx                # Page principale (orchestration)
│   ├── globals.css             # Styles globaux + variables CSS
│   └── api/
│       ├── profile/route.ts    # Fetch profil Instagram + pagination
│       ├── proxy/route.ts      # Proxy CDN (contournement CORS)
│       ├── history/route.ts    # Historique GET/POST
│       └── debug/route.ts      # Debug info
│
├── components/
│   ├── Navbar.tsx              # Barre de navigation
│   ├── Hero.tsx                # Section d'accueil (avant analyse)
│   ├── URLInput.tsx            # Champ de saisie URL/username
│   ├── ProfileHeader.tsx       # Affichage infos profil
│   ├── MediaGrid.tsx           # Grille + filtres + pagination
│   ├── MediaCard.tsx           # Carte individuelle d'un média
│   ├── DownloadPanel.tsx       # Panneau téléchargement ZIP
│   ├── HistorySection.tsx      # Section historique
│   └── ui/
│       ├── Button.tsx          # Composant bouton
│       ├── Badge.tsx           # Badge type/statut
│       └── Spinner.tsx         # Loaders animés
│
├── hooks/
│   ├── useInstagram.ts         # State machine profil + pagination
│   └── useDownload.ts          # Gestion téléchargements + ZIP
│
├── lib/
│   ├── instagram.ts            # Appels API Instagram (multi-stratégie + retry)
│   ├── download.ts             # Logique download individuel + ZIP
│   ├── supabase.ts             # Client Supabase (optionnel)
│   └── utils.ts                # Utilitaires (extractUsername, getMediaFilename…)
│
├── types/
│   └── instagram.ts            # Types TypeScript (InstagramMedia, User, etc.)
│
├── .env.local                  # Variables d'environnement (non versionné)
├── .env.local.example          # Template des variables d'environnement
├── next.config.mjs             # Configuration Next.js
├── tailwind.config.ts          # Configuration Tailwind CSS
└── tsconfig.json               # Configuration TypeScript
```

---

## ⚠️ Limites & comportements connus

| Situation | Comportement |
|---|---|
| Compte privé | Erreur `PRIVATE_ACCOUNT` (403) — aucun média accessible |
| Compte inexistant | Erreur `NOT_FOUND` (404) |
| Rate-limit Instagram (429) | Retry automatique ×2 avec délai exponentiel (1s, 2s) |
| URL CDN expirée | Le téléchargement échoue — relancer l'analyse |
| Pas de `SESSION_ID` | Pagination peut échouer après la 1ère page |
| Pas de Supabase | Historique in-memory, perdu au redémarrage |
| Carrousel | Chaque slide est un fichier séparé dans le ZIP |

---

## 🚀 Démarrage local

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.local.example .env.local
# → Editer .env.local avec vos valeurs

# 3. Lancer le serveur de développement
npm run dev

# 4. Ouvrir http://localhost:3000
```

---

## 🏷️ Types TypeScript clés

```typescript
type MediaType = "image" | "video" | "carousel" | "reel";

interface InstagramUser {
  id: string;
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_private: boolean;
  is_verified: boolean;
  external_url: string | null;
  category?: string;
}

interface InstagramMedia {
  id: string;
  shortcode: string;
  type: MediaType;
  url: string;
  thumbnail_url?: string;
  video_url?: string;
  caption?: string;
  timestamp: number;
  like_count: number;
  comment_count: number;
  children?: MediaChild[];   // Pour les carrousels
  dimensions?: { width: number; height: number };
  duration?: number;
  is_reel?: boolean;
}

interface DownloadItem {
  id: string;
  mediaId: string;
  url: string;
  filename: string;
  type: MediaType;
  status: "pending" | "downloading" | "done" | "error";
  progress: number;        // 0–100
  blob?: Blob;
}
```

---

*InstaGrab — Cet outil utilise uniquement les données publiques d'Instagram. Respectez les conditions d'utilisation d'Instagram et les droits d'auteur des créateurs.*
