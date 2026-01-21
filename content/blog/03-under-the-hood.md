---
title: "Under the Hood: The Technology Powering Vauban"
slug: under-the-hood
excerpt: "A technical deep-dive into our architecture: Starknet L3, Cairo smart contracts, and why we made the choices we did."
author: "Vauban Team"
tags: ["technology", "starknet", "architecture", "engineering"]
coverImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop"
publishedAt: 2026-01-20
featured: false
---

# Under the Hood: The Technology Powering Vauban

Building a decentralized publishing platform that feels as smooth as Medium while being as permanent as stone tablets requires careful architectural choices. This article explains what we built, why we built it that way, and what it means for you.

If you're not technical, don't worry—we'll explain the concepts. If you are, we'll give you the details you're looking for.

## The Stack at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Browser                             │
│              Next.js 15 + React 19 + TypeScript             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Madara L3 Appchain                        │
│         Cairo Smart Contracts • 6-second blocks             │
│              Auto-settlement to Starknet L2                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│        Arweave (permanent) + IPFS (fast cache)              │
└─────────────────────────────────────────────────────────────┘
```

Let's break down each layer.

## Layer 1: The Frontend

### Next.js 15 with App Router

We chose Next.js 15 for several reasons:

- **Server Components**: Most of Vauban renders on the server. Your browser downloads pre-rendered HTML, making initial loads fast.
- **Incremental Static Regeneration**: Popular articles are cached and served instantly. Updates propagate automatically.
- **API Routes**: Our M2M (machine-to-machine) publishing API runs alongside the frontend—no separate backend service.

### React 19 Features

React 19 brings improvements we leverage:
- **Server Actions**: Form submissions that run on the server, reducing client complexity
- **Optimistic Updates**: When you like an article, the UI updates instantly while the blockchain confirms
- **Suspense Everywhere**: Smooth loading states without manual management

### TypeScript + Zod

Every piece of data in Vauban is typed and validated:

```typescript
// Our post schema
export const PostSchema = z.object({
  id: z.bigint(),
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  contentHash: z.string().regex(/^0x[a-f0-9]{64}$/),
  arweaveTxId: z.string(),
  ipfsCid: z.string(),
  status: z.enum(['draft', 'pending', 'published', 'rejected']),
  // ...
});
```

This catches errors at compile time and runtime. No "undefined is not a function" surprises.

## Layer 2: The Blockchain

### Why Starknet L3?

We run our own blockchain—a Madara L3 appchain. Here's why:

**Why not Ethereum mainnet?**
- Transaction costs: Publishing an article would cost $5-50 in gas
- Speed: 12-second blocks mean waiting for confirmations
- Throughput: Limited to ~15 transactions per second

**Why not Starknet L2?**
- Transaction costs: Better (~$0.10) but still friction
- Shared resources: Competing with DeFi traders for block space
- Less control: Can't customize block time or gas costs

**Why our own L3?**
- **Sovereignty**: We control block time (6 seconds), gas prices (near-zero), and throughput (1000+ TPS)
- **Security**: We inherit Starknet's security through periodic settlement
- **Customization**: Optimized for publishing, not general computation

### Madara: Our Foundation

Madara is a framework for building Starknet-compatible blockchains. Think of it as "Starknet in a box"—we get:

- Full EVM-equivalent smart contract capability
- Native account abstraction
- Compatibility with existing Starknet tools
- Settlement to Starknet L2 every 100 blocks

```
Vauban L3 Block 1-100    →  Settled to Starknet Sepolia
Vauban L3 Block 101-200  →  Settled to Starknet Sepolia
...
```

If anything happens to our L3, the settlement proofs on L2 can be used to reconstruct the state.

### Cairo: Our Smart Contract Language

Our contracts are written in Cairo, a language designed for provable computation. Here's a simplified view of our main contract:

```cairo
#[starknet::contract]
mod BlogRegistry {
    struct Post {
        id: u256,
        author: ContractAddress,
        arweave_tx_id: ByteArray,
        ipfs_cid: ByteArray,
        content_hash: felt252,
        status: u8,
        created_at: u64,
    }

    #[external(v0)]
    fn publish_post(
        ref self: ContractState,
        arweave_tx_id: ByteArray,
        ipfs_cid: ByteArray,
        content_hash: felt252
    ) -> u256 {
        // Verify caller permissions
        // Store post metadata
        // Emit event
        // Return post ID
    }
}
```

Cairo compiles to STARK proofs—mathematical guarantees that the code executed correctly. No need to trust us; verify the proof.

### Our Contract Architecture

We have seven smart contracts working together:

| Contract | Purpose |
|----------|---------|
| **RoleRegistry** | Who can do what (7-tier permissions) |
| **BlogRegistry** | Article metadata and workflow |
| **Social** | Comments, likes, reports |
| **Treasury** | Revenue distribution |
| **Reputation** | Points, badges, levels |
| **Paymaster** | Sponsors gas fees for users |
| **SessionKeyManager** | Gasless UX via delegated signing |

They're designed to be modular. We can upgrade individual contracts without affecting others.

## Layer 3: Storage

### The Dual-Layer Strategy

We explained Arweave in detail in [The 200-Year Library](/articles/the-200-year-library). Here's the technical implementation:

```typescript
async function publishArticle(content: string) {
  // 1. Compute content hash for verification
  const hash = sha256(content);

  // 2. Upload to Arweave (permanent, ~30 seconds)
  const arweaveTx = await arweave.createTransaction({ data: content });
  await arweave.transactions.sign(arweaveTx);
  await arweave.transactions.post(arweaveTx);

  // 3. Pin to IPFS (fast cache, ~2 seconds)
  const ipfsResult = await ipfs.add(content);

  // 4. Record on blockchain
  await blogRegistry.publish_post(
    arweaveTx.id,
    ipfsResult.cid.toString(),
    hash
  );
}
```

Reading reverses this:

```typescript
async function readArticle(postId: bigint) {
  // 1. Get metadata from blockchain
  const post = await blogRegistry.get_post(postId);

  // 2. Try IPFS first (fast)
  let content = await ipfs.cat(post.ipfsCid).catch(() => null);

  // 3. Fall back to Arweave (permanent)
  if (!content) {
    content = await arweave.transactions.getData(post.arweaveTxId);
  }

  // 4. Verify integrity
  const hash = sha256(content);
  if (hash !== post.contentHash) {
    throw new Error('Content tampering detected!');
  }

  return content;
}
```

This gives us speed (IPFS cache hits in <200ms) with guaranteed permanence (Arweave backup always available).

## The Gasless Experience

Traditional blockchain apps require users to:
1. Buy cryptocurrency
2. Manage a wallet balance
3. Approve transactions for every action
4. Pay gas fees

We eliminate all of this through two mechanisms:

### Session Keys

When you first interact (comment, like), you sign a one-time authorization:

```
"I authorize this session key to perform social actions on my behalf for 7 days"
```

This creates a temporary key stored in your browser. Future actions use this key—no wallet popups.

```typescript
// First comment: wallet popup
const sessionKey = await createSessionKey({
  duration: 7 * 24 * 60 * 60, // 7 days
  allowedContracts: [SOCIAL_CONTRACT],
  allowedActions: ['comment', 'like', 'follow']
});

// All subsequent comments: instant, no popup
await social.addComment(postId, content, sessionKey);
```

### Paymaster

Our Paymaster contract sponsors gas fees for social interactions. Users never pay—we cover it.

```cairo
// In Paymaster contract
fn sponsor_transaction(tx: Transaction) {
    // Verify transaction is to whitelisted contract
    assert(self.whitelisted.read(tx.target), 'Not whitelisted');

    // Pay gas from Paymaster balance
    self.total_sponsored.write(
        self.total_sponsored.read() + tx.gas_cost
    );
}
```

The economics work because social interactions cost fractions of a cent. We can sponsor millions of comments for the cost of a small server.

## Performance Optimizations

### Optimistic Updates

When you like an article, we don't wait for blockchain confirmation:

```typescript
function LikeButton({ postId }) {
  const [optimisticLiked, setOptimisticLiked] = useState(false);

  async function handleLike() {
    // Update UI immediately
    setOptimisticLiked(true);

    // Send to blockchain in background
    try {
      await social.like(postId);
    } catch (error) {
      // Revert if failed
      setOptimisticLiked(false);
    }
  }

  return <Button liked={optimisticLiked} onClick={handleLike} />;
}
```

The like appears instantly. Confirmation happens in the background.

### Edge Caching

Popular articles are cached at the edge (via Vercel's CDN):

```typescript
export async function generateStaticParams() {
  // Pre-render top 100 articles at build time
  const popular = await blogRegistry.get_posts({ limit: 100 });
  return popular.map(post => ({ slug: post.slug }));
}

export const revalidate = 60; // Re-check every 60 seconds
```

First visitor gets server-rendered content. Subsequent visitors get edge-cached HTML in milliseconds.

### Contract Call Batching

Instead of multiple RPC calls:

```typescript
// Slow: 3 separate calls
const post = await blogRegistry.get_post(id);
const likes = await social.get_like_count(id);
const comments = await social.get_comments(id);
```

We batch into one:

```typescript
// Fast: 1 multicall
const [post, likes, comments] = await multicall([
  blogRegistry.get_post(id),
  social.get_like_count(id),
  social.get_comments(id)
]);
```

Single round-trip, triple the data.

## Why These Choices?

Every technology choice reflects a tradeoff. Here's our reasoning:

| Decision | Alternative | Why We Chose |
|----------|-------------|--------------|
| Starknet/Cairo | Solidity/EVM | Native AA, STARK proofs, better scaling |
| Own L3 | Shared L2 | Control over fees, speed, throughput |
| Arweave | Filecoin, Sia | Simpler economics, true permanence |
| IPFS | CloudFlare R2 | Decentralization, no single point of failure |
| Next.js | Remix, SvelteKit | Ecosystem, Vercel deployment, maturity |
| Zod | io-ts, Yup | Ergonomics, TypeScript inference, ecosystem |

We optimized for: user experience, decentralization, and long-term sustainability—in that order.

## Open Source

Everything we've described is open source:

- **Smart Contracts**: [github.com/vauban/contracts](https://github.com/vauban/contracts)
- **Frontend**: [github.com/vauban/frontend](https://github.com/vauban/frontend)
- **Documentation**: [github.com/vauban/docs](https://github.com/vauban/docs)

Verify our claims. Audit our code. Build on top of it.

Decentralization isn't just about where data lives—it's about who can see how the system works.

---

## Want to Go Deeper?

- [Architecture Documentation](/docs/architecture) - Full system design
- [Smart Contract Reference](/docs/smart-contracts) - Cairo contract details
- [Developer Guide](/docs/developer-guide) - Build locally

---

*This article was written in Markdown, stored on Arweave, cached on IPFS, and verified on Starknet L3. The system we're describing is the system you're using.*
