# InstaGrab — Dossier Technique Complet

> Document de préparation entretien — tous les aspects du projet

---

## 1. Présentation du projet

**InstaGrab** est une application web SaaS qui permet de télécharger tous les médias publics (photos, vidéos, reels, carrousels) d'un profil Instagram en entrant simplement son nom d'utilisateur ou son URL.

**URL de production** : https://instagramdownload-five.vercel.app  
**GitHub** : https://github.com/romYeb/instagramdownload  
**Statut** : déployé et fonctionnel

---

## 2. Stack technique

| Couche | Technologie | Raison du choix |
|--------|-------------|-----------------|
| Framework | **Next.js 14** (App Router) | SSR natif, API Routes intégrées, déploiement Vercel optimal |
| Langage | **TypeScript** | Typage fort, détection d'erreurs à la compilation |
| Style | **Tailwind CSS** | Utility-first, pas de CSS custom à maintenir |
| Animations | **Framer Motion** | Animations fluides déclaratives |
| Base de données | **Supabase** (optionnel) | Historique persistant, fallback mémoire si non configuré |
| ZIP | **JSZip** | Génération de ZIP côté navigateur sans serveur |
| Proxy | **ScraperAPI** | IPs résidentielles pour contourner le blocage Instagram sur Vercel |
| Déploiement | **Vercel** | CI/CD automatique, Edge Network mondial |
| Icônes | **Lucide React** | Bibliothèque SVG légère et cohérente |

---

## 3. Architecture

```
instagramdownload/
├── app/
│   ├── page.tsx                  ← Page principale (Client Component)
│   ├── layout.tsx                ← Layout global (fonts, metadata)
│   └── api/
│       ├── profile/route.ts      ← Fetch profil + pagination Instagram
│       ├── proxy/route.ts        ← Proxy de téléchargement des médias
│       └── history/route.ts      ← Historique des profils analysés
├── components/
│   ├── Navbar.tsx                ← Barre de navigation
│   ├── Hero.tsx                  ← Landing page (disparaît après recherche)
│   ├── URLInput.tsx              ← Champ de saisie URL/username
│   ├── ProfileHeader.tsx         ← Infos du profil (avatar, stats)
│   ├── MediaGrid.tsx             ← Grille de médias + pagination
│   ├── MediaCard.tsx             ← Carte individuelle (image/video/reel)
│   ├── DownloadPanel.tsx         ← Panneau de téléchargement/ZIP
│   └── HistorySection.tsx        ← Section historique
├── hooks/
│   ├── useInstagram.ts           ← State machine : fetch profil + pagination
│   └── useDownload.ts            ← Gestion des téléchargements + ZIP
├── lib/
│   ├── instagram.ts              ← Scraping Instagram (endpoints internes)
│   ├── download.ts               ← Logique téléchargement + JSZip
│   ├── supabase.ts               ← Client Supabase (nullable)
│   └── utils.ts                  ← Helpers (extractUsername, getMediaFilename)
└── types/
    └── instagram.ts              ← Types TypeScript (InstagramMedia, etc.)
```

---

## 4. Fonctionnement du scraping Instagram

### Pourquoi pas l'API officielle ?

L'**Instagram Basic Display API** a été supprimée le **4 décembre 2024** par Meta. Les nouvelles APIs (Graph API, Instagram Login API) exigent un compte Business ou Creator et ne sont pas accessibles pour des applications grand public.

L'application utilise donc les **endpoints internes d'Instagram** — les mêmes que ceux appelés par le navigateur quand tu visites un profil.

### Endpoint principal — Chargement du profil

```
GET https://www.instagram.com/api/v1/users/web_profile_info/?username=<username>
```

Retourne : infos du profil + 12 premiers médias + curseur de pagination.

### Endpoint de fallback

```
GET https://www.instagram.com/<username>/?__a=1&__d=dis
```

Utilisé si le premier endpoint échoue (paramètre `Accept: application/json`).

### Pagination (médias suivants)

**Méthode 1 — GraphQL legacy :**
```
GET https://www.instagram.com/graphql/query/?query_hash=8c2a529969ee035a5063f2fc8602a0fd
    &variables={"id":"<userId>","first":50,"after":"<cursor>"}
```

**Méthode 2 — User Feed (fallback) :**
```
GET https://www.instagram.com/api/v1/feed/user/<userId>/?count=50&max_id=<cursor>
```

### Rotation de User-Agent + Retry

```typescript
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "Mozilla/5.0 (X11; Linux x86_64)...",
];

async function fetchWithRetry(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt); // backoff exponentiel
    const res = await fetch(finalUrl, { headers: makeHeaders() });
    if (res.status === 429 && attempt < retries) continue; // rate limit → retry
    return res;
  }
}
```

---

## 5. Problème clé : blocage sur Vercel

### Le problème

Instagram maintient une liste noire des plages d'IP des datacenters cloud (AWS, Azure, Google Cloud, Vercel). Toute requête depuis ces IPs reçoit un `403 Forbidden`.

- **En local** → requêtes depuis l'IP du FAI → ✅ Instagram répond
- **Sur Vercel** → requêtes depuis AWS us-east-1 → ❌ Instagram bloque

### La solution : ScraperAPI

ScraperAPI agit comme proxy avec des IPs résidentielles. Instagram ne peut pas les distinguer d'un vrai utilisateur.

```typescript
function proxiedUrl(targetUrl: string): string {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return targetUrl;           // local : accès direct
  return `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(targetUrl)}&keep_headers=true`;
}
```

La variable `SCRAPER_API_KEY` est définie uniquement dans les variables d'environnement Vercel (pas dans `.env.local`). Le code s'adapte automatiquement selon l'environnement.

---

## 6. State management — useInstagram

La gestion d'état est une **machine à états** avec 4 états possibles :

```typescript
type State =
  | { status: "idle" }
  | { status: "loading"; username: string }
  | { status: "success"; user; allMedia; hasMore; cursor; totalCount; isLoadingMore }
  | { status: "error"; message: string; code?: string };
```

### Synchronisation état + ref

Problème classique React : à l'intérieur d'une `useCallback`, `state` est capturé dans la closure et devient stale (valeur périmée). Solution : double tracking avec un `ref` qui suit toujours la valeur courante.

```typescript
const stateRef = useRef<State>({ status: "idle" });

const set = useCallback((updater) => {
  setState((prev) => {
    const next = typeof updater === "function" ? updater(prev) : updater;
    stateRef.current = next;  // ref toujours à jour
    return next;
  });
}, []);
```

### Pagination avec mutex

Un `useRef` (`pendingMore`) fait office de mutex pour éviter les requêtes concurrentes :

```typescript
const loadMore = async () => {
  if (pendingMore.current) return;  // déjà en cours → abort
  pendingMore.current = true;
  // ... fetch ...
  pendingMore.current = false;      // libère le mutex
};
```

### loadAll — Chargement automatique total

```typescript
const loadAll = async () => {
  while (true) {
    const s = stateRef.current;
    if (s.status !== "success" || !s.hasMore || !s.cursor) break;
    if (pendingMore.current) { await wait(300); continue; }
    loadMore();
    await wait(300);
    while (pendingMore.current) await wait(300); // attend la fin
  }
};
```

---

## 7. Système de téléchargement

### Proxy de téléchargement — `/api/proxy`

Les médias Instagram ont des URLs CDN avec des tokens d'expiration et des en-têtes CORS restrictifs. Le téléchargement direct depuis le navigateur est bloqué. Solution : route proxy côté serveur.

```typescript
// Sécurité : whitelist des domaines autorisés
const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "scontent.cdninstagram.com",
  "video.cdninstagram.com",
];
```

Le proxy vérifie que l'URL appartient à un domaine Instagram avant de la récupérer — protection contre le SSRF (Server-Side Request Forgery).

### Téléchargement avec progression

```typescript
// Lecture en streaming avec progression
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
  received += value.length;
  onProgress(Math.round((received / total) * 100));
}
```

### Export ZIP — JSZip

Pour les carrousels, chaque enfant est téléchargé et ajouté dans le ZIP sous son propre nom de fichier :

```typescript
for (const child of item.children) {
  const blob = await fetch(buildProxyUrl(child.url)).then(r => r.blob());
  folder.file(getMediaFilename(username, item.id, child.type, index), blob);
}
const zipBlob = await zip.generateAsync({ type: "blob" });
triggerBrowserDownload(zipBlob, `${username}_instagram.zip`);
```

---

## 8. Base de données — Supabase

Supabase est **optionnel**. Si les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` ne sont pas définies, l'historique se stocke en mémoire (volatile, perdu au redémarrage).

```typescript
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;  // null → fallback mémoire
```

Table `download_history` : `id`, `username`, `full_name`, `profile_pic_url`, `follower_count`, `media_count`, `downloaded_at`, `session_id`.

---

## 9. Types de médias gérés

| Type | Description | Identifié par |
|------|-------------|---------------|
| `image` | Photo simple | `__typename: GraphImage` |
| `video` | Vidéo standard | `__typename: GraphVideo`, `is_video: true` |
| `reel` | Reel Instagram | `product_type: "clips"` |
| `carousel` | Album multi-médias | `__typename: GraphSidecar` |

Les carrousels ont des `children` (tableau de `MediaChild`) qui peuvent être des images ou vidéos.

---

## 10. Déploiement

### Variables d'environnement Vercel

| Variable | Obligatoire | Usage |
|----------|-------------|-------|
| `SCRAPER_API_KEY` | ✅ Oui (production) | Proxy Instagram via ScraperAPI |
| `NEXT_PUBLIC_SUPABASE_URL` | ❌ Non | Persistance historique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ Non | Persistance historique |

### CI/CD

Chaque `git push origin main` → Vercel rebuilde et redéploie automatiquement (GitHub intégration).  
Build time moyen : ~25 secondes.

---

## 11. Sécurité

| Risque | Mitigation |
|--------|------------|
| SSRF sur `/api/proxy` | Whitelist stricte des domaines (`cdninstagram.com`, `fbcdn.net`) |
| Injection de paramètres | Validation regex du username (`/^[a-zA-Z0-9._]{1,30}$/`) |
| Données sensibles | Aucune clé privée côté client, `SCRAPER_API_KEY` côté serveur uniquement |
| Rate limiting | Retry avec backoff exponentiel + rotation User-Agent |

---

## 12. Limitations connues

- **Comptes privés** : inaccessibles — Instagram ne retourne pas les médias sans être follower authentifié
- **Stories** : non accessibles via les endpoints publics
- **1000 appels/mois** : limite ScraperAPI tier gratuit (1 appel ≈ 1 page de 50 médias)
- **Instabilité des endpoints** : Instagram peut modifier ses endpoints internes sans préavis

---

## 13. Questions fréquentes en entretien

### Architecture & Design

**Q : Pourquoi Next.js plutôt que React seul ?**  
R : Les requêtes Instagram doivent être faites côté serveur (les IPs datacenters Vercel sont bloquées si tu fais du client-side fetch, mais surtout les tokens CORS empêchent les appels directs depuis le navigateur). Next.js permet d'avoir les API Routes dans le même projet sans backend séparé.

**Q : Pourquoi un proxy `/api/proxy` pour les téléchargements ?**  
R : Les CDN Instagram (`scontent.cdninstagram.com`) envoient des en-têtes CORS qui bloquent les téléchargements directs depuis le navigateur. Le proxy côté serveur contourne ce problème et ajoute une couche de sécurité avec la whitelist de domaines.

**Q : Comment fonctionne la pagination infinie ?**  
R : Instagram utilise un système de curseur (cursor-based pagination). Chaque réponse contient `has_next_page` et `end_cursor`. Pour la page suivante, on envoie `after: end_cursor`. L'`IntersectionObserver` surveille un élément sentinelle en bas de la grille et déclenche `loadMore()` quand il devient visible.

**Q : Pourquoi un `useRef` pour `pendingMore` au lieu d'un `useState` ?**  
R : `useState` est asynchrone — la valeur mise à jour n'est pas immédiatement disponible dans la même exécution. `useRef` est synchrone et mutable, ce qui en fait un mutex fiable pour éviter les appels concurrents à `loadMore`.

**Q : Comment évites-tu les stale closures dans `loadMore` ?**  
R : `useCallback` capture les valeurs au moment de sa création. Si `state` était lu directement, il serait périmé. La solution : un `stateRef` mis à jour dans chaque `setState` via un wrapper `set()`. `loadMore` lit depuis `stateRef.current` qui contient toujours la valeur fraîche.

### Instagram & Scraping

**Q : Est-ce légal de scraper Instagram ?**  
R : La situation est nuancée. Les données publiques sont… publiques. Mais les CGU d'Instagram interdisent le scraping automatisé. Pour un usage personnel ou éducatif, c'est une zone grise. Plusieurs décisions judiciaires (notamment hiQ vs LinkedIn) ont établi que scraper des données publiques n'est pas illégal aux USA.

**Q : Pourquoi l'Instagram Basic Display API n'est plus utilisable ?**  
R : Meta l'a supprimée le 4 décembre 2024. Les alternatives officielles (Graph API, Instagram Login API) sont réservées aux comptes Business/Creator et ne permettent pas d'accéder aux médias de n'importe quel profil public.

**Q : Pourquoi ça marche en local mais pas sur Vercel sans ScraperAPI ?**  
R : Instagram maintient une liste noire des plages d'IP AWS (sur lesquelles tourne Vercel). Les requêtes depuis un FAI résidentiel (Free, Orange, Bouygues) ne sont pas bloquées car indiscernables d'un utilisateur normal.

### Performance

**Q : Comment optimises-tu les performances avec beaucoup de médias ?**  
R : Plusieurs stratégies — (1) pagination par 50 au lieu de tout charger d'un coup, (2) `AnimatePresence mode="popLayout"` pour des animations GPU-accélérées, (3) l'`IntersectionObserver` charge les médias à la demande plutôt que tout en avance, (4) les blobs téléchargés sont gardés en mémoire via `Map` pour éviter les re-téléchargements.

**Q : Pourquoi JSZip côté client et pas côté serveur ?**  
R : Pour un ZIP de 500 médias volumineux, le faire côté serveur consommerait beaucoup de mémoire sur la fonction serverless Vercel (limite 1024 MB) et le timeout de 10s serait dépassé. Côté client, le traitement se fait dans le navigateur de l'utilisateur — pas de contrainte de temps ni de mémoire serveur.

### TypeScript & Code

**Q : Explique la machine à états dans `useInstagram`.**  
R : L'état est un discriminated union TypeScript : `idle | loading | success | error`. Chaque état a ses propres propriétés. TypeScript force le narrowing — impossible d'accéder à `state.allMedia` sans vérifier `state.status === "success"`. Ça évite les bugs de type "undefined is not iterable".

**Q : Pourquoi deux parseurs (`parseMediaNode` et `parseFeedItem`) ?**  
R : Instagram retourne des structures JSON différentes selon l'endpoint. L'endpoint `web_profile_info` utilise le format GraphQL (avec `edge_owner_to_timeline_media`, `edge_sidecar_to_children`...). L'endpoint `feed/user` utilise l'ancien format de l'API mobile (`media_type`, `image_versions2`, `video_versions`...). Les deux parseurs normalisent ces formats vers le même type `InstagramMedia`.

**Q : Comment gères-tu les erreurs de fetch ?**  
R : Double fallback à chaque niveau — (1) la couche `fetchInstagramProfile` essaie `web_profile_info` puis `GraphQL legacy` avec collecte des erreurs dans un tableau, (2) la couche `fetchNextPage` essaie GraphQL puis User Feed, (3) `fetchWithRetry` réessaie 2 fois avec backoff sur les 429. Si tout échoue, un message d'erreur agrégé est retourné.

### Déploiement

**Q : Comment fonctionnes le CI/CD ?**  
R : Git push sur `main` → webhook GitHub → Vercel déclenche un build → `npm run build` (Next.js build) → déploiement sur le CDN Vercel mondial. Chaque PR crée automatiquement un Preview Deployment avec son propre URL.

**Q : Comment gères-tu les variables d'environnement entre local et production ?**  
R : `.env.local` pour le développement local (ignoré par Git). Variables Vercel pour la production. La variable `SCRAPER_API_KEY` n'existe qu'en production — le code fait `if (!key) return targetUrl` pour fonctionner normalement en local sans proxy.

---

## 14. Chiffres clés à retenir

- **3 commits** pour construire l'application complète
- **12 fichiers source** TypeScript/TSX (hors config)
- **50 médias** chargés par requête de pagination
- **2 endpoints** Instagram avec fallback automatique
- **2 niveaux** de retry (3 tentatives max par requête)
- **5 domaines** en whitelist pour le proxy de téléchargement
- **4 types** de médias supportés (image, video, reel, carousel)
- **~25 secondes** de build time sur Vercel
- **1000 appels/mois** gratuits sur ScraperAPI

---

*Document généré le 19 mai 2026*
