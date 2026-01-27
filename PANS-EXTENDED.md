# Vauban eXtended - Du Blog au Twitter Décentralisé

## Vision: "X, mais en mieux"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VAUBAN eXtended                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   TWITTER VIEW (Timeline)          BLOG VIEW (Classique)                │
│   ┌─────────────────────┐          ┌─────────────────────┐              │
│   │ @alice · 2h         │          │ ┌───────────────┐   │              │
│   │ Just shipped v2!    │          │ │   FEATURED    │   │              │
│   │ [Thread →]          │          │ │    ARTICLE    │   │              │
│   ├─────────────────────┤          │ └───────────────┘   │              │
│   │ @bob · 5h           │          │                     │              │
│   │ New article: "Why   │          │ Latest Posts        │              │
│   │ Cairo is amazing"   │          │ ├── Post 1          │              │
│   │ [📄 Read full →]    │◀────────▶│ ├── Post 2          │              │
│   ├─────────────────────┤          │ └── Post 3          │              │
│   │ @charlie · 8h       │          │                     │              │
│   │ Quick thought...    │          │ Archives            │              │
│   └─────────────────────┘          │ Categories          │              │
│                                    └─────────────────────┘              │
│                                                                         │
│   MÊME CONTENU, DEUX PRÉSENTATIONS                                      │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                        │
│   • Tweet court → affiché inline dans timeline                          │
│   • Article long → preview + "Read full" link                           │
│   • Thread → preview + "Continue thread" link                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pourquoi X (Twitter) rate ses articles

| Problème X | Solution Vauban |
|------------|-----------------|
| Articles se perdent dans le flux | Pin, Featured, Archives dédiées |
| Pas de catégorisation | Tags, Collections, Séries |
| Pas de SEO | URL propres, meta tags, sitemap |
| Pas d'historique browsable | Vue blog classique avec navigation |
| Threads = UX horrible | Thread natif avec navigation fluide |
| Pas d'ownership | On-chain, exportable, permanent |

---

## Architecture: Contenus Unifiés

### Types de Contenu

```typescript
enum ContentType {
  TWEET = 'tweet',      // < 280 chars, inline display
  THREAD = 'thread',    // Multiple connected tweets
  ARTICLE = 'article',  // Long-form, full page
}

interface Post {
  id: string;
  type: ContentType;
  author: string;
  content: string;          // Markdown/MDX

  // Pour timeline view
  preview: string;          // First 280 chars or custom excerpt

  // Pour blog view
  title?: string;           // Required for articles
  coverImage?: string;      // Optional hero image
  tags: string[];

  // Metadata
  createdAt: number;
  updatedAt?: number;

  // Thread specific
  parentId?: string;        // If reply
  threadRootId?: string;    // If part of thread

  // Engagement (from Social contract)
  likes: number;
  comments: number;
  reposts: number;

  // Storage
  arweaveTxId: string;
  ipfsCid: string;
  contentHash: string;
}
```

### Stockage On-Chain

```cairo
// Modification du BlogRegistry existant
#[derive(Drop, Serde, starknet::Store)]
enum PostType {
    Tweet,
    Thread,
    Article,
}

#[derive(Drop, Serde, starknet::Store)]
struct PostMetadata {
    post_type: PostType,
    author: ContractAddress,
    content_hash: felt252,
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    parent_id: u64,           // 0 if none
    thread_root_id: u64,      // 0 if standalone
    created_at: u64,
    updated_at: u64,
    is_deleted: bool,
    is_pinned: bool,          // Author can pin to profile
    is_featured: bool,        // Admin can feature
}
```

---

## Vues Frontend

### 1. Timeline View (`/feed`)

```
┌─────────────────────────────────────────────────────────────┐
│  [For You] [Following] [Articles] [Threads]                 │  ← Tabs
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Avatar] @alice · 2h                           [···]│    │
│  │                                                      │    │
│  │ Just deployed our new smart contract! 🚀            │    │  ← TWEET
│  │                                                      │    │
│  │ [💬 12] [🔄 5] [❤️ 42] [📤]                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Avatar] @bob · 5h                             [···]│    │
│  │                                                      │    │
│  │ 📄 ARTICLE                                          │    │
│  │ ┌─────────────────────────────────────────────────┐ │    │  ← ARTICLE
│  │ │ [Cover Image]                                   │ │    │     (preview)
│  │ │ Why Cairo is the Future of Smart Contracts      │ │    │
│  │ │ A deep dive into Starknet's programming lang... │ │    │
│  │ │                          [Read full article →]  │ │    │
│  │ └─────────────────────────────────────────────────┘ │    │
│  │ [💬 8] [🔄 15] [❤️ 89] [📤]                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Avatar] @charlie · 8h                         [···]│    │
│  │                                                      │    │
│  │ 🧵 THREAD (1/5)                                     │    │  ← THREAD
│  │ Let me explain how session keys work in Starknet... │    │     (preview)
│  │                                                      │    │
│  │                              [Continue thread →]    │    │
│  │ [💬 24] [🔄 31] [❤️ 156] [📤]                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2. Blog View (`/blog` ou `/`)

```
┌─────────────────────────────────────────────────────────────┐
│                    VAUBAN BLOG                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  FEATURED ARTICLE                    │    │
│  │  [Full-width cover image]                           │    │
│  │                                                      │    │
│  │  Why Cairo is the Future of Smart Contracts         │    │
│  │  By @bob · Dec 15, 2025 · 12 min read              │    │
│  │  Tags: #cairo #starknet #web3                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  LATEST ARTICLES                    │  SIDEBAR             │
│  ───────────────────────────────    │  ─────────           │
│  ┌─────────────────────────────┐    │  Categories          │
│  │ [Thumb] Article Title       │    │  • Cairo (12)        │
│  │         Preview text...     │    │  • Tutorials (8)     │
│  │         @author · 5h        │    │  • News (24)         │
│  └─────────────────────────────┘    │                      │
│  ┌─────────────────────────────┐    │  Popular Tags        │
│  │ [Thumb] Another Article     │    │  #defi #nft #l2      │
│  │         Preview text...     │    │                      │
│  │         @author · 1d        │    │  Top Authors         │
│  └─────────────────────────────┘    │  1. @alice (420pts)  │
│                                     │  2. @bob (380pts)    │
│  [Load more...]                     │  3. @charlie (290pts)│
│                                     │                      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Profile View (`/profile/@username`)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Banner Image]                                       │   │
│  │                                                      │   │
│  │ [Avatar]  @alice                                     │   │
│  │           Alice Developer                            │   │
│  │           Building the future of Web3                │   │
│  │                                                      │   │
│  │ 📍 Paris  🔗 alice.dev  📅 Joined Dec 2024          │   │
│  │                                                      │   │
│  │ 42 Following   1.2K Followers   Level 5 🏆          │   │
│  │                                                      │   │
│  │ [Follow]  [Message]                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [Tweets] [Articles] [Threads] [Likes] [Media]              │
│  ═══════                                                    │
│                                                             │
│  📌 PINNED ARTICLE                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ My Journey into Cairo Development                    │   │
│  │ Everything I learned building on Starknet...         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [Regular posts timeline...]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Plan d'Action

### ACTION IMMÉDIATE (Avant tout)

```bash
# 1. Commit et push les changements actuels
git add .
git commit -m "feat: add gamification, admin users, TTS highlighting, author stats fix"
git push origin master

# 2. Créer nouvelle branche feature
git checkout -b feature/eXtended
```

### Sprint 0: Refactoring Content Model (3-4 jours)

| Tâche | Fichiers | Description |
|-------|----------|-------------|
| Modifier BlogRegistry contract | `contracts/src/blog_registry.cairo` | Ajouter PostType enum, parent_id, thread_root_id |
| Migrer schema Zod | `packages/shared-types/src/post.ts` | Nouveau schema avec ContentType |
| Adapter web3-utils | `packages/web3-utils/src/starknet.ts` | Fonctions pour threads |
| Tests contract | `contracts/tests/test_blog_registry.cairo` | Tests threads, replies |

### Sprint 1: OAuth + Custodial Wallet (1 semaine)

| Tâche | Fichiers | Priorité |
|-------|----------|----------|
| Setup NextAuth GitHub/Google | `app/api/auth/[...nextauth]/route.ts` | P0 |
| Service wallet custodial | `lib/wallet-service.ts` | P0 |
| Schema PostgreSQL | `prisma/schema.prisma` | P0 |
| Page signin custom | `app/auth/signin/page.tsx` | P1 |
| UserMenu component | `components/auth/UserMenu.tsx` | P1 |

### Sprint 2: Timeline View (1 semaine)

| Tâche | Fichiers | Priorité |
|-------|----------|----------|
| Page /feed | `app/feed/page.tsx` | P0 |
| TweetCard component | `components/feed/TweetCard.tsx` | P0 |
| ArticlePreview component | `components/feed/ArticlePreview.tsx` | P0 |
| ThreadPreview component | `components/feed/ThreadPreview.tsx` | P0 |
| Composer (nouveau post) | `components/feed/Composer.tsx` | P1 |
| Tab navigation (For You/Following/Articles) | `components/feed/FeedTabs.tsx` | P1 |

### Sprint 3: Blog View Améliorée (4-5 jours)

| Tâche | Fichiers | Priorité |
|-------|----------|----------|
| Refactor homepage | `app/page.tsx` | P0 |
| FeaturedArticle component | `components/blog/FeaturedArticle.tsx` | P0 |
| ArticleGrid component | `components/blog/ArticleGrid.tsx` | P0 |
| Sidebar (categories, tags, authors) | `components/blog/Sidebar.tsx` | P1 |
| Archive page | `app/blog/archive/page.tsx` | P1 |

### Sprint 4: Follows + Notifications (1 semaine)

| Tâche | Fichiers | Priorité |
|-------|----------|----------|
| Contrat Follows | `contracts/src/follows.cairo` | P0 |
| FollowButton | `components/social/FollowButton.tsx` | P0 |
| NotificationBell | `components/notifications/NotificationBell.tsx` | P1 |
| Apibara indexer setup | `indexer/` | P1 |

### Sprint 5: Threads + Replies (1 semaine)

| Tâche | Fichiers | Priorité |
|-------|----------|----------|
| Thread view page | `app/thread/[id]/page.tsx` | P0 |
| Reply component | `components/feed/Reply.tsx` | P0 |
| Thread composer | `components/feed/ThreadComposer.tsx` | P1 |
| Quote tweet | `components/feed/QuoteTweet.tsx` | P1 |

### Sprint 6: Leaderboard + Polish (4-5 jours)

| Tâche | Fichiers | Priorité |
|-------|----------|----------|
| Leaderboard page | `app/leaderboard/page.tsx` | P0 |
| LeaderboardTable | `components/leaderboard/LeaderboardTable.tsx` | P0 |
| Cron job calcul scores | Backend service | P1 |

---

## Fichiers à Créer

```
apps/frontend/
├── app/
│   ├── feed/
│   │   └── page.tsx                    # Timeline Twitter-like
│   ├── blog/
│   │   ├── page.tsx                    # Vue blog classique
│   │   └── archive/page.tsx            # Archives
│   ├── thread/
│   │   └── [id]/page.tsx               # Vue thread complète
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts  # NextAuth
│   │   └── wallet/
│   │       └── route.ts                # Wallet custodial
│   └── auth/
│       └── signin/page.tsx             # Page login custom
│
├── components/
│   ├── feed/
│   │   ├── Timeline.tsx                # Container timeline
│   │   ├── TweetCard.tsx               # Post court
│   │   ├── ArticlePreview.tsx          # Preview article
│   │   ├── ThreadPreview.tsx           # Preview thread
│   │   ├── Composer.tsx                # Nouveau post
│   │   ├── Reply.tsx                   # Réponse
│   │   └── FeedTabs.tsx                # Navigation tabs
│   │
│   ├── blog/
│   │   ├── FeaturedArticle.tsx         # Hero article
│   │   ├── ArticleGrid.tsx             # Grille articles
│   │   ├── ArticleCard.tsx             # Card article
│   │   └── Sidebar.tsx                 # Catégories, tags
│   │
│   ├── auth/
│   │   ├── SignInButton.tsx            # Boutons OAuth
│   │   └── UserMenu.tsx                # Menu utilisateur
│   │
│   └── social/
│       ├── FollowButton.tsx            # Follow/unfollow
│       └── EngagementBar.tsx           # Likes, comments, reposts
│
├── lib/
│   ├── auth.ts                         # NextAuth config
│   └── wallet-service.ts               # Wallet custodial
│
└── hooks/
    ├── use-feed.ts                     # Timeline data
    └── use-follow.ts                   # Follow state

contracts/src/
├── blog_registry.cairo                 # MODIFIER: ajouter PostType
└── follows.cairo                       # NOUVEAU

packages/shared-types/src/
└── post.ts                             # MODIFIER: ContentType enum
```

---

## Flux Utilisateur Principal

### Nouvel Utilisateur

```
1. Arrive sur /blog (vue classique)
   → Voit articles featured, grid, peut lire sans compte

2. Clique "Sign in" → /auth/signin
   → Choisit GitHub ou Google
   → OAuth redirect → callback
   → Backend crée wallet custodial
   → Redirect vers /feed (timeline)

3. Timeline /feed
   → Voit flux For You (algorithme)
   → Peut poster tweet, article, ou thread
   → Peut follow des auteurs
   → Tab "Following" = flux perso

4. Profile /@username
   → Voit ses posts, articles, threads
   → Peut pin un article
   → Stats (followers, following, points)
```

### Poster du Contenu

```
Tweet (< 280 chars):
  Composer → Type → Submit
  → Stocké on-chain + Arweave
  → Apparaît dans timeline

Article (long-form):
  /admin/editor → Write MDX → Publish
  → Preview dans timeline + Page dédiée
  → Apparaît aussi dans /blog

Thread:
  Composer → "Create thread" mode
  → Multiple posts liés
  → Apparaît comme preview avec "Continue →"
```

---

## Questions à Décider

1. **URL structure:**
   - `/feed` pour timeline, `/blog` pour classique, `/` = lequel?
   - Suggestion: `/` = `/blog` (SEO), `/feed` = timeline (logged in users)

2. **Algorithme "For You":**
   - Simple: récent + engagement score
   - Complexe: ML, similarité, follows des follows
   - Suggestion: commencer simple

3. **Thread max length:**
   - Unlimited comme X?
   - Limité (ex: 10 posts)?
   - Suggestion: 25 max

4. **Reposts (retweets):**
   - Simple repost (juste share)
   - Quote post (avec commentaire)
   - Suggestion: les deux

---

## Vérification

### Test du Flow Complet

```bash
# 1. Démarrer l'app
pnpm dev

# 2. Test Auth Flow
- Aller sur /auth/signin
- Login GitHub
- Vérifier redirect vers /feed
- Vérifier wallet créé dans DB

# 3. Test Post Tweet
- Dans Composer, écrire < 280 chars
- Submit
- Vérifier apparaît dans timeline

# 4. Test Post Article
- Aller sur /admin/editor
- Écrire article MDX
- Publish
- Vérifier preview dans /feed
- Vérifier page complète dans /blog

# 5. Test Follow
- Aller sur profil d'un auteur
- Cliquer Follow
- Vérifier ses posts dans tab "Following"
```

---

## Résumé

**Ce qu'on construit:**
Un Twitter décentralisé avec un layer blog intégré (comme les Articles X, mais mieux).

**La différence:**
- Deux vues du même contenu (timeline + blog classique)
- Articles ne se perdent pas (pinned, featured, archives, catégories)
- Ownership réel (on-chain, exportable)
- UX Web2 (OAuth, pas de wallet visible)

**Première étape:**
1. Commit + push current changes
2. Créer branche `feature/eXtended`
3. Commencer Sprint 0: refactoring content model
