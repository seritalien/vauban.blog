# VAUBAN BLOG 3.0 - SPÉCIFICATIONS COMPLÈTES
## État de l'Art 2026 | Architecture Hybrid Appchain L3 + IPFS + Next.js

**Version :** 1.0  
**Date :** 17 Janvier 2026  
**Environnement :** Starknet Mainnet (Production) / Sepolia (Staging)  
**Blockchain :** Madara L3 Appchain (Settlement: Starknet)  

---

## TABLE DES MATIÈRES
1. [Vision & Principes](#1-vision--principes)
2. [Architecture Générale](#2-architecture-générale)
3. [MVP Phase 1 - Spécifications Détaillées](#3-mvp-phase-1---spécifications-détaillées)
4. [Modèles de Données](#4-modèles-de-données)
5. [Smart Contracts (Cairo)](#5-smart-contracts-cairo)
6. [Frontend (Next.js 16)](#6-frontend-nextjs-16)
7. [Infrastructure & DevOps](#7-infrastructure--devops)
8. [Cas d'Usage Détaillés (Use Cases)](#8-cas-dusage-détaillés)
9. [Sécurité & Cryptographie](#9-sécurité--cryptographie)
10. [Roadmap d'Implémentation](#10-roadmap-dimplémentation)

---

## 1. VISION & PRINCIPES

### 1.1 Objectif Global
Construire une **plateforme de blogging Web3-native**, où :
- Le **contenu réside sur IPFS** (immuable, décentralisé).
- La **logique métier** (propriété, accès, paiements) vit sur une **Appchain L3 dédiée** (Madara).
- L'**UX est invisible** (Session Keys, Paymaster, pas de popups wallet à chaque interaction).
- La **souveraineté est maximale** (vous contrôlez la chaîne, les données, aucun tiers de confiance).

### 1.2 Principes d'Ingénierie
- **Type-Safety First :** TypeScript Strict Mode partout. Cairo 2.x au complet.
- **Zero-Trust Crypto :** Chaque interaction est signée. La blockchain juge.
- **Performance Obsession :** Edge Computing, caching agressif, streaming de données.
- **Modulaire :** Chaque composant doit être replaceable (IPFS <-> Arweave, Madara <-> Starknet, etc).

### 1.3 Stack Technologique (Définitif)
| Couche | Technologie | Raison |
|--------|-------------|--------|
| **Blockchain** | Madara L3 (Starknet Settlement) | Appchain souveraine, >1000 TPS, État modifiable |
| **Frontend** | Next.js 16 (App Router) + React 19 | PPR, RSC, Streaming, Optimizations natives |
| **Validation** | ArkType | 50x+ rapide que Zod, arbre syntaxique pur |
| **Stockage** | IPFS (Pinata) + Arweave (backup) | Immuable, décentralisé, économique |
| **Chiffrement** | Lit Protocol + ECIES (native Starknet) | Token-gated, client-side, conditionnelle |
| **Social/Commentaires** | OrbisDB (Ceramic) ou native L3 Social.cairo | Zero-gas (session), verifiable |
| **AI Local** | WebLLM + MLC (WASM) | Private, offline-first, aucune exfiltration |
| **Styling** | Tailwind CSS v4 + Shadcn | Moderne, accessible, performant |
| **Monitoring** | Prometheus + Grafana + Tempo | Observabilité d'Appchain critique |

---

## 2. ARCHITECTURE GÉNÉRALE

### 2.1 Diagramme Conceptuel
```
┌─────────────────────────────────────────────────────────────────┐
│                    VAUBAN BLOG ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USER LAYER (Browser / PWA)                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Next.js 16 Frontend (Edge CDN)                          │ │
│  │ - React Server Components (RSC)                         │ │
│  │ - Command Palette (`Cmd+K`)                             │ │
│  │ - Local LLM (WebLLM WASM)                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│                    ↓ Web3 Abstraction Layer                     │
│                                                                 │
│  BLOCKCHAIN LAYER                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Vauban L3 (Madara Appchain)                             │ │
│  │ - BlogRegistry.cairo (Article Index)                    │ │
│  │ - Social.cairo (Comments, Likes)                        │ │
│  │ - Marketplace.cairo (Payments, Royalties)               │ │
│  │ - Paymaster (Abstract Account, Session Keys)            │ │
│  └──────────────────────────────────────────────────────────┘ │
│          ↓ Settlement every N blocks                            │
│  STARKNET MAINNET (L2)                                         │
│                                                                 │
│  STORAGE LAYER (Distributed & Immutable)                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ IPFS Network (Pinata + Local Gateway)                   │ │
│  │ - Article JSON (content + metadata)                     │ │
│  │ - Images & Assets                                       │ │
│  │ - Encrypted paywall content                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  CRYPTOGRAPHY LAYER                                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Lit Protocol (Threshold Encryption)                     │ │
│  │ - Conditional key release (token-gated)                 │ │
│  │ - Client-side decryption                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  IDENTITY LAYER                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Starknet Native Auth                                    │ │
│  │ - Argent / Braavos Wallet                               │ │
│  │ - EIP-712 Message Signing (Gasless)                    │ │
│  │ - Account Abstraction (Session Keys)                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Flux de Données (Happy Path)
```
Admin Writes Article (MDX)
    ↓
[Optional] Encrypt Content (Lit Protocol)
    ↓
Upload to IPFS → Get CID
    ↓
Sign & Publish TX (Madara L3)
    ↓
Sequencer mines block → BlogRegistry updated
    ↓
Settlement commit to Starknet L2
    ↓
CDN broadcasts to edge
    ↓
User fetches index from Madara RPC
    ↓
User reads content from IPFS
    ↓
[If Payant] User pays 5 STRK (Session Key, zero popup)
    ↓
Lit Nodes release decryption key
    ↓
Content decrypts client-side in browser
    ↓
Full article rendered
```

---

## 3. MVP PHASE 1 - SPÉCIFICATIONS DÉTAILLÉES

### 3.1 Scope du MVP
**Liverable Final :** Une application Next.js fonctionnelle où vous (l'Admin) pouvez :
1. ✅ Publier un article (MDX).
2. ✅ Voir la liste des articles.
3. ✅ Lire un article.
4. ✅ (Optionnel) Ajouter/Lire des commentaires OrbisDB.

**Non inclus dans MVP1 :**
- Paywall (cryptographie complexe)
- LLM local (peut être ajouté après)
- Design final / Animations

### 3.2 Repository Structure (Monorepo Turborepo)
```
vauban-blog/
├── apps/
│   ├── frontend/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx (home + article list)
│   │   │   ├── articles/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx
│   │   │   └── admin/
│   │   │       └── editor/
│   │   │           └── page.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   ├── styles/
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── devnet/  (Local Madara Appchain)
│       ├── Dockerfile.madara
│       ├── compose.madara.yml
│       └── config.toml
│
├── contracts/  (Cairo Smart Contracts)
│   ├── src/
│   │   ├── blog_registry.cairo
│   │   ├── social.cairo
│   │   └── marketplace.cairo
│   ├── tests/
│   ├── Scarb.toml
│   └── snforge.toml
│
├── packages/
│   ├── shared-types/  (Zod/ArkType schemas)
│   │   ├── post.ts
│   │   ├── comment.ts
│   │   └── user.ts
│   │
│   └── web3-utils/  (Starknet helpers)
│       ├── auth.ts
│       ├── contracts.ts
│       └── ipfs.ts
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

### 3.3 Configuration Initiale (Environment Setup)

#### 3.3.1 `.env.local` (Frontend)
```bash
# Starknet RPC (Madara L3)
NEXT_PUBLIC_MADARA_RPC=http://localhost:9944  # Dev
# NEXT_PUBLIC_MADARA_RPC=https://api.vauban.blog/rpc  # Prod

# IPFS
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud
PINATA_API_KEY=xxx
PINATA_API_SECRET=xxx

# Blockchain Contracts (déployés sur L3)
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=0x0123...
NEXT_PUBLIC_SOCIAL_ADDRESS=0x0456...

# Lit Protocol (optionnel pour MVP1)
NEXT_PUBLIC_LIT_NETWORK=cayenne  # ou mainnet later

# AI Model (optionnel pour MVP1)
NEXT_PUBLIC_LLM_MODEL_ID=Phi-3-mini-instruct  # Sera téléchargé par WebLLM
```

#### 3.3.2 `Scarb.toml` (Contracts)
```toml
[package]
name = "vauban_blog"
version = "0.1.0"
edition = "2024_07"

[[target.starknet-contract]]

[dependencies]
starknet = "2.8"
openzeppelin = "0.15"
```

---

## 4. MODÈLES DE DONNÉES

### 4.1 Domain Models (Validation avec ArkType)

#### 4.1.1 Post (Article)
```typescript
// packages/shared-types/post.ts
import type { Type } from "arktype";

export const PostInputSchema = {
  title: "string > 3 & < 200",
  slug: "string & /^[a-z0-9]+(?:-[a-z0-9]+)*$/",  // URL-safe
  content: "string > 100",
  tags: "string[] > 0 & < 10",
  author: "string",  // Starknet address
  isPaid: "boolean",
  price: "number > 0 & < 1000000",  // STRK tokens
  excerpt: "string > 10 & < 500",
  coverImage: "string | undefined",  // IPFS CID
  createdAt: "Date",
  updatedAt: "Date",
};

export const PostOutputSchema = {
  ...PostInputSchema,
  id: "string",
  ipfsCid: "string",  // IPFS CID of JSON
  contentHash: "string",  // SHA256 hash for integrity
  signature: "string",  // Admin signature
};

export type PostInput = Type<typeof PostInputSchema>;
export type PostOutput = Type<typeof PostOutputSchema>;
```

#### 4.1.2 Comment (Social)
```typescript
// packages/shared-types/comment.ts
export const CommentInputSchema = {
  content: "string > 1 & < 5000",
  postId: "string",
  author: "string",  // Starknet address (DID from Argent/Braavos)
  signature: "string",  // EIP-712 signature
};

export const CommentOutputSchema = {
  ...CommentInputSchema,
  id: "string",
  createdAt: "Date",
};
```

#### 4.1.3 User (Session)
```typescript
// packages/shared-types/user.ts
export const UserSessionSchema = {
  address: "string",  // Starknet address
  sessionKey: "string",  // Delegated key (7 days)
  sessionKeyExpiry: "number",  // Unix timestamp
  nonce: "number",
  connectedAt: "Date",
};
```

### 4.2 Storage Models (On-Chain / Off-Chain)

#### 4.2.1 On-Chain (Madara L3 State)
```cairo
// contracts/src/blog_registry.cairo
use starknet::ContractAddress;

#[derive(Drop, Serde, Clone, PartialEq)]
pub struct PostMetadata {
    pub id: u64,
    pub author: ContractAddress,
    pub ipfs_cid: felt252,  // Points to JSON on IPFS
    pub content_hash: felt252,  // SHA256 for integrity checks
    pub price: u256,  // 0 = free, >0 = payable
    pub is_encrypted: bool,
    pub created_at: u64,  // Block timestamp
    pub updated_at: u64,
}

#[derive(Drop, Serde, Clone, PartialEq)]
pub struct CommentData {
    pub id: u64,
    pub post_id: u64,
    pub author: ContractAddress,
    pub content_hash: felt252,  // Hash of comment text
    pub signature: Signature,  // EIP-712 signature
    pub created_at: u64,
}

#[storage]
pub struct Storage {
    pub posts: LegacyMap<u64, PostMetadata>,
    pub post_count: u64,
    pub comments: LegacyMap<u64, CommentData>,
    pub comment_count: u64,
    pub user_posts: LegacyMap<ContractAddress, Array<u64>>,  // User -> Post IDs
}
```

#### 4.2.2 Off-Chain (IPFS JSON)
```json
// IPFS structure: ipfs://QmXXX...
{
  "id": "post-001",
  "title": "Optimiser les Smart Contracts Cairo",
  "slug": "optimiser-smart-contracts-cairo",
  "content": "# Markdown content here\n\n## Section 1\n...",
  "excerpt": "Guide complet sur les optimisations Cairo 2.x",
  "author": "0x...",
  "tags": ["cairo", "starknet", "optimization"],
  "isPaid": false,
  "price": 0,
  "coverImage": "ipfs://QmCover...",
  "assets": [
    "ipfs://QmImage1...",
    "ipfs://QmDiagram..."
  ],
  "metadata": {
    "createdAt": 1705462800,
    "updatedAt": 1705462800,
    "wordCount": 3500,
    "estimatedReadTime": 12
  },
  "signature": "0xABC...DEF"  // Admin's signature over content
}
```

---

## 5. SMART CONTRACTS (CAIRO 2.X)

### 5.1 BlogRegistry Contract

#### 5.1.1 Interface
```cairo
// contracts/src/blog_registry.cairo
use starknet::ContractAddress;

#[starknet::interface]
pub trait IBlogRegistry<TContractState> {
    // Admin only
    fn publish_post(
        ref self: TContractState,
        ipfs_cid: felt252,
        content_hash: felt252,
        price: u256,
        is_encrypted: bool,
    ) -> u64;

    fn update_post(
        ref self: TContractState,
        post_id: u64,
        ipfs_cid: felt252,
        content_hash: felt252,
    ) -> bool;

    fn delete_post(ref self: TContractState, post_id: u64) -> bool;

    // Public read
    fn get_post(self: @TContractState, post_id: u64) -> PostMetadata;
    fn get_posts_by_author(self: @TContractState, author: ContractAddress) -> Array<u64>;
    fn get_all_posts(self: @TContractState, limit: u64, offset: u64) -> Array<PostMetadata>;
    fn get_post_count(self: @TContractState) -> u64;

    // Purchase / Access Control
    fn purchase_post(ref self: TContractState, post_id: u64) -> bool;
    fn has_access(self: @TContractState, post_id: u64, user: ContractAddress) -> bool;
}
```

#### 5.1.2 Implementation (Core Logic)
```cairo
#[starknet::contract]
pub mod BlogRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[storage]
    pub struct Storage {
        pub posts: LegacyMap<u64, PostMetadata>,
        pub post_count: u64,
        pub post_purchases: LegacyMap<(u64, ContractAddress), bool>,  // (post_id, user) -> hasAccess
        pub strk_token: ContractAddress,
        #[substorage(v0)]
        pub ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PostPublished: PostPublished,
        PostUpdated: PostUpdated,
        PostDeleted: PostDeleted,
        PostPurchased: PostPurchased,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PostPublished {
        pub post_id: u64,
        pub author: ContractAddress,
        pub ipfs_cid: felt252,
        pub created_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PostUpdated {
        pub post_id: u64,
        pub updated_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PostDeleted {
        pub post_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PostPurchased {
        pub post_id: u64,
        pub buyer: ContractAddress,
        pub price: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, strk_token: ContractAddress, owner: ContractAddress) {
        self.strk_token.write(strk_token);
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl BlogRegistryImpl of IBlogRegistry<ContractState> {
        fn publish_post(
            ref self: ContractState,
            ipfs_cid: felt252,
            content_hash: felt252,
            price: u256,
            is_encrypted: bool,
        ) -> u64 {
            // Only owner can publish
            self.ownable.assert_only_owner();

            let post_id = self.post_count.read() + 1;
            let now = get_block_timestamp();
            let author = get_caller_address();

            let post = PostMetadata {
                id: post_id,
                author,
                ipfs_cid,
                content_hash,
                price,
                is_encrypted,
                created_at: now,
                updated_at: now,
            };

            self.posts.write(post_id, post);
            self.post_count.write(post_id);

            self.emit(PostPublished { post_id, author, ipfs_cid, created_at: now });
            post_id
        }

        fn update_post(
            ref self: ContractState,
            post_id: u64,
            ipfs_cid: felt252,
            content_hash: felt252,
        ) -> bool {
            self.ownable.assert_only_owner();

            let mut post = self.posts.read(post_id);
            post.ipfs_cid = ipfs_cid;
            post.content_hash = content_hash;
            post.updated_at = get_block_timestamp();

            self.posts.write(post_id, post);
            self.emit(PostUpdated { post_id, updated_at: post.updated_at });
            true
        }

        fn delete_post(ref self: ContractState, post_id: u64) -> bool {
            self.ownable.assert_only_owner();
            // Soft delete: mark as deleted (optional)
            self.emit(PostDeleted { post_id });
            true
        }

        fn get_post(self: @ContractState, post_id: u64) -> PostMetadata {
            self.posts.read(post_id)
        }

        fn get_posts_by_author(self: @ContractState, author: ContractAddress) -> Array<u64> {
            // Linear scan (suboptimal, but works for MVP)
            let mut result = ArrayTrait::new();
            let count = self.post_count.read();
            let mut i: u64 = 1;
            loop {
                if i > count {
                    break;
                }
                let post = self.posts.read(i);
                if post.author == author {
                    result.append(i);
                }
                i += 1;
            };
            result
        }

        fn get_all_posts(self: @ContractState, limit: u64, offset: u64) -> Array<PostMetadata> {
            let mut result = ArrayTrait::new();
            let count = self.post_count.read();
            let mut i = offset + 1;
            let max_i = core::cmp::min(offset + limit, count);

            loop {
                if i > max_i {
                    break;
                }
                result.append(self.posts.read(i));
                i += 1;
            };
            result
        }

        fn get_post_count(self: @ContractState) -> u64 {
            self.post_count.read()
        }

        fn purchase_post(ref self: ContractState, post_id: u64) -> bool {
            let post = self.posts.read(post_id);
            assert!(post.price > 0, "Post is free");

            let buyer = get_caller_address();
            // Transfer STRK from buyer to owner (would need ERC20 interface)
            // For now, just mark as purchased
            self.post_purchases.write((post_id, buyer), true);

            self.emit(PostPurchased { post_id, buyer, price: post.price });
            true
        }

        fn has_access(self: @ContractState, post_id: u64, user: ContractAddress) -> bool {
            let post = self.posts.read(post_id);
            if post.price == 0 {
                return true;  // Free post
            }
            self.post_purchases.read((post_id, user))
        }
    }
}
```

### 5.2 Social Contract (Comments)

#### 5.2.1 Interface
```cairo
// contracts/src/social.cairo
#[starknet::interface]
pub trait ISocial<TContractState> {
    fn add_comment(ref self: TContractState, post_id: u64, content_hash: felt252, signature: Signature) -> u64;
    fn get_comments_for_post(self: @TContractState, post_id: u64, limit: u64, offset: u64) -> Array<CommentData>;
    fn get_comment_count(self: @TContractState, post_id: u64) -> u64;
    fn like_post(ref self: TContractState, post_id: u64) -> bool;
    fn get_likes(self: @TContractState, post_id: u64) -> u64;
}
```

#### 5.2.2 Implementation
```cairo
#[starknet::contract]
pub mod Social {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};

    #[storage]
    pub struct Storage {
        pub comments: LegacyMap<u64, CommentData>,
        pub comment_count: u64,
        pub post_comment_count: LegacyMap<u64, u64>,  // post_id -> count
        pub likes: LegacyMap<u64, u64>,  // post_id -> count
        pub user_liked: LegacyMap<(u64, ContractAddress), bool>,  // (post_id, user) -> liked
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        CommentAdded: CommentAdded,
        PostLiked: PostLiked,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CommentAdded {
        pub comment_id: u64,
        pub post_id: u64,
        pub author: ContractAddress,
        pub created_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PostLiked {
        pub post_id: u64,
        pub liker: ContractAddress,
    }

    #[abi(embed_v0)]
    impl SocialImpl of ISocial<ContractState> {
        fn add_comment(
            ref self: ContractState,
            post_id: u64,
            content_hash: felt252,
            signature: Signature,
        ) -> u64 {
            let comment_id = self.comment_count.read() + 1;
            let author = get_caller_address();

            let comment = CommentData {
                id: comment_id,
                post_id,
                author,
                content_hash,
                signature,
                created_at: get_block_timestamp(),
            };

            self.comments.write(comment_id, comment);
            self.comment_count.write(comment_id);

            // Update post comment count
            let current_count = self.post_comment_count.read(post_id);
            self.post_comment_count.write(post_id, current_count + 1);

            self.emit(CommentAdded {
                comment_id,
                post_id,
                author,
                created_at: comment.created_at,
            });

            comment_id
        }

        fn get_comments_for_post(
            self: @ContractState,
            post_id: u64,
            limit: u64,
            offset: u64,
        ) -> Array<CommentData> {
            let mut result = ArrayTrait::new();
            // Implementation similar to get_all_posts
            result
        }

        fn get_comment_count(self: @ContractState, post_id: u64) -> u64 {
            self.post_comment_count.read(post_id)
        }

        fn like_post(ref self: ContractState, post_id: u64) -> bool {
            let user = get_caller_address();
            assert!(!self.user_liked.read((post_id, user)), "Already liked");

            let current_likes = self.likes.read(post_id);
            self.likes.write(post_id, current_likes + 1);
            self.user_liked.write((post_id, user), true);

            self.emit(PostLiked { post_id, liker: user });
            true
        }

        fn get_likes(self: @ContractState, post_id: u64) -> u64 {
            self.likes.read(post_id)
        }
    }
}
```

---

## 6. FRONTEND (NEXT.JS 16)

### 6.1 Architecture & Folder Structure

```
apps/frontend/
├── app/
│   ├── layout.tsx                    # Root layout (providers, wallet, theme)
│   ├── page.tsx                      # Homepage (article list)
│   ├── articles/
│   │   └── [slug]/
│   │       └── page.tsx              # Article detail + comments
│   └── admin/
│       ├── layout.tsx
│       └── editor/
│           └── page.tsx              # Admin editor (Cmd+K)
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...                       # Shadcn components
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Sidebar.tsx
│   ├── Blog/
│   │   ├── ArticleCard.tsx
│   │   ├── ArticleList.tsx
│   │   ├── ArticleDetail.tsx
│   │   └── CommentSection.tsx
│   ├── Admin/
│   │   ├── Editor.tsx
│   │   ├── CommandPalette.tsx
│   │   └── PublishModal.tsx
│   └── Web3/
│       ├── WalletConnect.tsx
│       ├── SessionKeyManager.tsx
│       └── LitProtocolWrapper.tsx
│
├── hooks/
│   ├── useWallet.ts                  # Starknet wallet connection
│   ├── usePosts.ts                   # Fetch posts from L3
│   ├── useComments.ts                # Fetch comments from OrbisDB/L3
│   ├── useIpfs.ts                    # IPFS upload/download
│   └── useContractRead.ts            # Generic contract interaction
│
├── lib/
│   ├── arktype.ts                    # ArkType validation schemas
│   ├── starknet.ts                   # Starknet client setup
│   ├── ipfs.ts                       # IPFS client (Pinata)
│   ├── contracts.ts                  # Contract ABIs + deployment addresses
│   └── constants.ts                  # Magic numbers, chain IDs, etc
│
├── styles/
│   ├── globals.css                   # Tailwind + globals
│   └── variables.css                 # CSS variables (theme)
│
├── env.d.ts                          # TypeScript env typing
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### 6.2 Key Components (Implementation Sketches)

#### 6.2.1 Homepage (app/page.tsx)
```typescript
// apps/frontend/app/page.tsx
import { Suspense } from 'react';
import { ArticleList } from '@/components/Blog/ArticleList';
import { SearchBar } from '@/components/SearchBar';

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-6">Vauban Blog</h1>
          <p className="text-xl text-slate-600 mb-10">
            Engineering at the edge of Starknet.
          </p>
          <SearchBar />
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<div>Loading articles...</div>}>
            <ArticleList />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
```

#### 6.2.2 Article Detail (app/articles/[slug]/page.tsx)
```typescript
// apps/frontend/app/articles/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { usePosts } from '@/hooks/usePosts';
import { ArticleDetail } from '@/components/Blog/ArticleDetail';
import { CommentSection } from '@/components/Blog/CommentSection';

interface PageProps {
  params: { slug: string };
}

export default async function ArticlePage({ params }: PageProps) {
  // In production, this would be server-side fetched from L3
  const { slug } = params;

  // Placeholder: fetch from L3 via RPC
  // const post = await fetchPostFromL3(slug);
  // if (!post) notFound();

  return (
    <main className="min-h-screen bg-white">
      <article className="max-w-2xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        {/* Article content */}
        <ArticleDetail slug={slug} />

        {/* Comments section */}
        <CommentSection postSlug={slug} />
      </article>
    </main>
  );
}
```

#### 6.2.3 Admin Editor (app/admin/editor/page.tsx)
```typescript
// apps/frontend/app/admin/editor/page.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { CommandPalette } from '@/components/Admin/CommandPalette';
import { Editor } from '@/components/Admin/Editor';
import { PublishModal } from '@/components/Admin/PublishModal';

export default function AdminEditorPage() {
  const { address, isConnected } = useWallet();
  const [content, setContent] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);

  if (!isConnected) {
    return <div>Please connect your wallet to access the editor.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <CommandPalette onPublish={() => setShowPublishModal(true)} />
      <div className="flex h-screen">
        <Editor value={content} onChange={setContent} />
        <div className="w-1/2 p-6">
          {/* Preview */}
          <div className="prose prose-invert">
            {/* Render markdown preview */}
          </div>
        </div>
      </div>

      {showPublishModal && (
        <PublishModal content={content} onClose={() => setShowPublishModal(false)} />
      )}
    </div>
  );
}
```

#### 6.2.4 useWallet Hook
```typescript
// apps/frontend/hooks/useWallet.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { connect, disconnect, getStarknetIdNavigator } from 'starknetkit';
import { RpcProvider, Account } from 'starknet';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  const handleConnect = useCallback(async () => {
    try {
      const result = await connect();
      if (result.wallet) {
        setAddress(result.wallet.selectedAddress);
        setIsConnected(true);
        // Initialize account for transactions
        const provider = new RpcProvider({
          nodeUrl: process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944',
        });
        const newAccount = new Account(provider, result.wallet.selectedAddress, result.wallet.signer);
        setAccount(newAccount);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setAddress(null);
    setIsConnected(false);
    setAccount(null);
  }, []);

  return {
    address,
    isConnected,
    account,
    connect: handleConnect,
    disconnect: handleDisconnect,
  };
}
```

#### 6.2.5 usePosts Hook (Fetch from L3)
```typescript
// apps/frontend/hooks/usePosts.ts
'use client';

import { useEffect, useState } from 'react';
import { RpcProvider, Contract } from 'starknet';
import BLOG_REGISTRY_ABI from '@/lib/contracts/blog_registry_abi.json';
import { PostOutput } from '@shared-types/post';

export function usePosts() {
  const [posts, setPosts] = useState<PostOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const provider = new RpcProvider({
          nodeUrl: process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944',
        });

        const contract = new Contract(
          BLOG_REGISTRY_ABI,
          process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS!,
          provider
        );

        // Read all posts from contract
        const postCount = await contract.get_post_count();
        const fetchedPosts: PostOutput[] = [];

        for (let i = 1; i <= postCount; i++) {
          const post = await contract.get_post(i);
          // Fetch content from IPFS
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}/ipfs/${post.ipfs_cid}`
          );
          const content = await response.json();

          fetchedPosts.push({
            ...post,
            ...content,
          });
        }

        setPosts(fetchedPosts);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  return { posts, isLoading, error };
}
```

#### 6.2.6 useIpfs Hook (Upload/Download)
```typescript
// apps/frontend/hooks/useIpfs.ts
'use client';

import { useCallback } from 'react';

const PINATA_API_BASE = 'https://api.pinata.cloud';

export function useIpfs() {
  const uploadToPinata = useCallback(async (content: any): Promise<string> => {
    const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob);

    const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY!,
        pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_API_SECRET!,
      },
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload to IPFS');
    const result = await response.json();
    return result.IpfsHash;  // CID
  }, []);

  const downloadFromIpfs = useCallback(async (cid: string) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}/ipfs/${cid}`
    );
    if (!response.ok) throw new Error('Failed to download from IPFS');
    return response.json();
  }, []);

  return { uploadToPinata, downloadFromIpfs };
}
```

### 6.3 Configuration Files

#### 6.3.1 next.config.ts
```typescript
// apps/frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    strictNullChecks: true,
  },
  images: {
    domains: ['gateway.pinata.cloud', 'ipfs.io'],
  },
  experimental: {
    appDir: true,
    reactCompiler: true,  // React 19 Compiler
  },
  env: {
    NEXT_PUBLIC_MADARA_RPC: process.env.NEXT_PUBLIC_MADARA_RPC,
    NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS,
  },
};

export default nextConfig;
```

#### 6.3.2 tailwind.config.ts
```typescript
// apps/frontend/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      slate: {
        50: '#f8fafc',
        900: '#0f172a',
      },
      teal: {
        500: '#208c85',
      },
    },
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

---

## 7. INFRASTRUCTURE & DEVOPS

### 7.1 Madara Appchain Setup

#### 7.1.1 Docker Compose (devnet/compose.madara.yml)
```yaml
version: '3.8'

services:
  madara:
    image: madara:latest  # Build from source or use prebuilt
    ports:
      - "9944:9944"  # RPC
      - "9945:9945"  # WS
    environment:
      RUST_LOG: debug
      MADARA_SEQUENCER_ADDRESS: "0x0"  # Owner
    volumes:
      - ./config.toml:/etc/madara/config.toml
      - madara_data:/data
    command: madara --config /etc/madara/config.toml

  redis:  # For cache handler (ISR)
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  madara_data:
  redis_data:
```

#### 7.1.2 Madara Config (devnet/config.toml)
```toml
[chain]
name = "vauban"
chain_id = "VAUBAN_L3_DEV"
sequencer_address = "0x0"

[rpc]
listen_address = "0.0.0.0"
listen_port = 9944

[database]
path = "/data/madara.db"

[blocks]
block_time_ms = 6000  # 6 seconds per block
max_transactions_per_block = 100
```

### 7.2 Kubernetes Deployment (Production)

#### 7.2.1 K8s Manifests
```yaml
# k8s/vauban-frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vauban-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vauban-frontend
  template:
    metadata:
      labels:
        app: vauban-frontend
    spec:
      containers:
      - name: nextjs
        image: vauban-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_MADARA_RPC
          value: "https://madara-rpc.vauban.svc.cluster.local:9944"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: services/v1
kind: Service
metadata:
  name: vauban-frontend
spec:
  selector:
    app: vauban-frontend
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 7.3 CI/CD Pipeline (GitHub Actions)

#### 7.3.1 Build & Deploy (`.github/workflows/deploy.yml`)
```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build contracts
        run: cd contracts && scarb build
      
      - name: Build frontend
        run: cd apps/frontend && pnpm build
      
      - name: Build Docker image
        run: docker build -t vauban-frontend:${{ github.sha }} -f Dockerfile.frontend .
      
      - name: Push to registry
        run: docker push vauban-frontend:${{ github.sha }}
      
      - name: Deploy to K8s
        run: |
          kubectl set image deployment/vauban-frontend \
            nextjs=vauban-frontend:${{ github.sha }}
```

---

## 8. CAS D'USAGE DÉTAILLÉS (Use Cases)

### UC-001 : Admin Publie un Article Gratuit

**Acteur :** Admin (Vous)  
**Précondition :** Admin est connecté via Wallet Starknet

**Flux Principal :**
1. Admin ouvre l'App, clique `Cmd+K` -> "New Post"
2. Remplit le formulaire :
   - Titre : "Optimiser les Smart Contracts Cairo"
   - Contenu : Rédige en MDX (~3500 mots)
   - Tags : ["cairo", "starknet"]
   - **Price : 0 STRK (Gratuit)**
3. Admin clique "Preview" -> Voit le rendu
4. Admin clique "Publish"
5. **Backend :**
   - Frontend hash le contenu (SHA256)
   - Upload JSON sur IPFS -> reçoit CID `Qm...`
   - Admin signe TX : `publish_post(cid, 0, "cairo")`
   - TX va à Madara L3
   - Séquenceur mine le bloc
   - Event `PostPublished` émis
6. **Résultat :** Article apparaît sur la homepage

**Cas d'erreur :**
- Si IPFS upload échoue -> affiche erreur, redemande
- Si transaction échoue -> rollback local, demande retry

---

### UC-002 : Lecteur Découvre & Lit un Article

**Acteur :** Lecteur (Guest)  
**Précondition :** Lecteur arrive sur le site

**Flux Principal :**
1. Lecteur voit la homepage avec liste d'articles
2. Clique sur "Optimiser les Smart Contracts Cairo"
3. **Frontend :**
   - Lit index depuis Madara L3 (RPC call)
   - Fetch contenu depuis IPFS gateway
   - Vérifie intégrité : `Hash(IPFS) == OnChain checksum`
4. Article s'affiche
5. Lecteur scroll, lit, copy-paste snippets de code

**Non-Functional Requirements :**
- Page doit charger < 2 secondes
- TTFp (Time to First Paint) < 800ms
- Support mobile & desktop

---

### UC-003 : Admin Crée un Article Premium (Payant)

**Acteur :** Admin  
**Précondition :** Admin connecté

**Flux Principal :**
1. Admin crée article : "Alpha Trading Strategies" (confidential)
2. Coche **"Require Payment"** -> Price: **5 STRK**
3. **Encryptage :**
   - Frontend génère une clé symétrique AES-256
   - Chiffre le contenu
   - Utilise Lit Protocol pour fragmenter la clé de déchiffrement
   - Condition : `user doit avoir payé pour cet article`
4. Upload IPFS -> CID (contenu chiffré)
5. Admin publie TX : `publish_post(cid, 5 STRK, true)`  # is_encrypted=true
6. **Résultat :** Article publié, teasé, mais contenu verrouillé

---

### UC-004 : Lecteur Paie & Accède à Article Premium

**Acteur :** Lecteur (Membre avec Wallet)  
**Précondition :** Article premium visible

**Flux Principal :**
1. Lecteur clique "Unlock (5 STRK)"
2. Popup Wallet : "Confirm Payment"
3. Lecteur signe (ou transparent via Session Key)
4. **Smart Contract :**
   - Transfère 5 STRK de lecteur à Admin
   - Enregistre : `post_purchases[(article_id, lecteur_address)] = true`
   - Émet event `PostPurchased`
5. **Lit Protocol :**
   - Nodes capturent event
   - Vérifient la condition (payment reçu)
   - Envoient fragments de clé au navigateur du lecteur
6. **Browser :**
   - Combine fragments -> clé complète
   - Déchiffre le contenu
   - Affiche l'article complet
7. **Persistence :** Lecteur a accès à vie à cet article

---

### UC-005 : Lecteur Ajoute Commentaire

**Acteur :** Lecteur (Membre connecté)  
**Précondition :** Article visible, Lecteur connecté avec Wallet

**Flux Principal :**
1. Lecteur scroll en bas, clique dans champ "Add Comment"
2. Rédige : "Excellent analyse!"
3. Clique "Post"
4. **Session Key Magic :**
   - Premier commentaire -> Popup Wallet "Authorize session for 7 days"
   - Lecteur signe une Session Key
   - Clé stockée en localStorage avec expiration
5. **Transaction :**
   - Frontend hash le contenu du commentaire
   - Session Key signe l'EIP-712 message
   - TX envoyée au séquenceur Madara (Paymaster couvre gas)
6. **Contract (Social.cairo) :**
   - Vérifie signature
   - Ajoute commentaire à storage
   - Émet `CommentAdded`
7. **Résultat :** Commentaire apparaît instantanément (Optimistic UI)

**Coût pour l'utilisateur :** 0 STRK (Paymaster)  
**Friction :** 1 popup (first time only), sinon 0

---

## 9. SÉCURITÉ & CRYPTOGRAPHIE

### 9.1 Principes

1. **Signature Multi-Niveau :**
   - Admin signe articles avant publication
   - Users signent commentaires avant submission
   - Tout est vérifiable on-chain

2. **Intégrité du Contenu :**
   - Hash (IPFS content) toujours comparé à On-Chain checksum
   - Si mismatch -> **Content Tampered** error, refus d'affichage

3. **Session Keys (Zero-Friction) :**
   - User signe une session key 1x (7 jours)
   - Toutes les interactions utilisent cette clé
   - Pas de popups wallet répétées

4. **Encryption (Lit Protocol) :**
   - Clé fragmentée entre N nœuds Lit
   - M-of-N threshold (ex: 3-of-5)
   - Condition : Smart Contract event émet `AccessGranted`

### 9.2 Validation & Sanitization

```typescript
// packages/shared-types/post.ts
import type { Type } from "arktype";

// Backend & Frontend use same schema
export const PublishPostSchema = {
  title: "string > 3 & < 200",
  slug: "string & /^[a-z0-9]+(?:-[a-z0-9]+)*$/",
  content: "string > 100 & < 500000",  // Max 500KB
  tags: "string[] > 0 & < 20",
  price: "number >= 0 & <= 1000000",
  excerpt: "string > 10 & < 500",
};

// Validation happens at:
// 1. Client-side (UX feedback)
// 2. Server-side (backend) -> None for MVP (stateless)
// 3. Smart Contract (blockchain truth)
```

### 9.3 Attack Surface Analysis

| Attack | Mitigation |
|--------|-----------|
| **IPFS Content Tampering** | Onchain checksum verification |
| **Replay Attacks** | Nonce in EIP-712, session key rotation |
| **Man-in-the-Middle** | HTTPS only, Wallet signing |
| **Sybil Attack** | Paymaster rate limiting, reputation system (future) |
| **XSS** | React auto-escaping, CSP headers |
| **SQL Injection** | N/A (no DB), IPFS is content-addressed |

---

## 10. ROADMAP D'IMPLÉMENTATION

### Phase 1 (MVP1) : Genesis [CURRENT]
**Durée :** 2-3 semaines  
**Liverable :** Fully functional blog, articles readable

#### Sprint 1.1 : Infrastructure & Setup
- [ ] Madara devnet running locally (Docker)
- [ ] Cairo contracts compile (Scarb)
- [ ] Next.js boilerplate with TypeScript Strict
- [ ] Starknet.js wallet connection
- [ ] IPFS (Pinata) integration

#### Sprint 1.2 : Smart Contracts
- [ ] `BlogRegistry.cairo` deployed on L3
- [ ] `Social.cairo` deployed on L3
- [ ] Basic tests passing

#### Sprint 1.3 : Frontend
- [ ] Homepage with article list
- [ ] Article detail page (IPFS fetch)
- [ ] Admin editor (basic MDX)
- [ ] Publish flow end-to-end
- [ ] Comments section (read-only in MVP1)

---

### Phase 2 : Monetization & Paywall
**Duration:** 2-3 weeks  
**Liverable:** Premium articles, token-gated content

- [ ] Lit Protocol integration
- [ ] Encryption/Decryption flow
- [ ] Payment processing (STRK transfers)
- [ ] Conditional access control

---

### Phase 3 : Polish & AI
**Durée :** 2 weeks  
**Liverable :** WebLLM integration, Command Palette

- [ ] Local LLM (WebLLM)
- [ ] Command Palette UI
- [ ] Advanced search (Pagefind)
- [ ] Design system finalization

---

### Phase 4 : Scale & Optimize
**Durée :** Ongoing  
**Liverable :** Production hardening, monitoring

- [ ] K8s deployment
- [ ] Prometheus + Grafana
- [ ] Load testing & optimization
- [ ] Security audit

---

## APPENDIX A: Deployment Checklist

### Development Environment
- [ ] Node.js 20+
- [ ] pnpm 8+
- [ ] Docker + Docker Compose
- [ ] Scarb (Cairo toolchain)
- [ ] VS Code + Rust Analyzer

### Local Testing
- [ ] Madara running on `localhost:9944`
- [ ] Redis running on `localhost:6379`
- [ ] IPFS gateway accessible
- [ ] Contracts deployed to devnet

### Production Checklist
- [ ] Contracts audited
- [ ] Frontend built & tested
- [ ] K8s manifests reviewed
- [ ] Monitoring in place
- [ ] Backup strategy
- [ ] Disaster recovery plan

---

## APPENDIX B: Resource Estimation

| Resource | MVP1 | MVP2+ |
|----------|------|-------|
| **Frontend Build Time** | ~2min | ~3min |
| **Contract Compilation** | ~30s | ~1min |
| **IPFS Upload (5MB)** | ~2s | ~2s |
| **L3 Block Time** | 6s | 2s (optimized) |
| **Madara RPC Latency** | <100ms | <50ms |
| **TTFB (First Byte)** | <500ms | <200ms |

---

## APPENDIX C: Cost Analysis (Annual, Assuming Starknet Mainnet)

| Component | Cost | Notes |
|-----------|------|-------|
| **Madara Appchain Settlement** | ~$500 | ~1 TX/hour to Starknet |
| **IPFS Pinning (Pinata)** | ~$100 | 100GB/month plan |
| **Domain & SSL** | ~$50 | Annual |
| **K8s Hosting** (self-hosted) | $0 | On your infra |
| **Cloudflare CDN** | ~$200 | Optional, for speed |
| **Total** | **~$850** | |

---

END OF SPECIFICATIONS
