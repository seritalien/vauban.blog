---
title: "The 85% Promise: Fair Economics for Writers"
slug: the-85-percent-promise
excerpt: "Traditional platforms take up to 50% of your earnings. We take 10%. Here is why and how it works."
author: "Vauban Team"
tags: ["economics", "writers", "monetization", "revenue"]
coverImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=630&fit=crop"
publishedAt: 2026-01-22
featured: true
---

# The 85% Promise: Fair Economics for Writers

In 2024, a popular Medium writer analyzed his earnings: 1 million reads, $2,847 total. That's $0.003 per reader. Meanwhile, Medium reported $200 million in annual revenue.

Where does the money go?

Medium takes 50% of member fees before any writer sees a penny. Then their opaque algorithm distributes the remainder based on "engagement time"—a metric nobody fully understands.

The app stores take 30% of Substack subscriptions. YouTube takes 45% of ad revenue. Patreon takes 8-12% plus payment processing.

We asked: what if platforms took only what they needed to survive?

## The Vauban Revenue Model

When someone pays for your content on Vauban, here's how the money flows:

```
$10 Article Purchase
├── $8.50 (85%) → Author
├── $1.00 (10%) → Platform
└── $0.50 (5%)  → Referrer (if applicable)
```

That's it. No hidden fees. No algorithmic redistribution. No vague "engagement metrics." You sell something, you keep 85%.

If there's no referrer, you keep 90%.

### Why 10% for the Platform?

We need some revenue to:
- Pay for blockchain infrastructure (Madara L3 nodes)
- Cover Arweave storage costs
- Sponsor gas fees via Paymaster
- Maintain and improve the platform
- Provide support

10% is enough. Medium's 50% is greed disguised as platform value.

### Why 5% for Referrers?

Growth should benefit everyone. When someone shares your article and brings a paying reader, they earn a small commission. This creates alignment:

- Readers who share get rewarded
- Authors get new readers
- The platform grows organically

## Comparison: Vauban vs. Traditional Platforms

| Platform | Author Take | Platform Take | Notes |
|----------|-------------|---------------|-------|
| **Vauban** | **85%** | 10% | Transparent, on-chain |
| Medium | ~50% | ~50% | Algorithmic, opaque |
| Substack | 90% | 10% | Plus Stripe fees (2.9%) |
| Patreon | 88-92% | 8-12% | Plus payment processing |
| YouTube | 55% | 45% | Ads only, algorithm-dependent |
| OnlyFans | 80% | 20% | Payment processor issues |

Substack looks comparable, but consider: their 10% is on top of Stripe's 2.9% + $0.30 per transaction. A $5 subscription actually costs you 12.9% + $0.30 = $0.95 lost. On a $5 monthly, that's 19%.

Vauban's 10% is all-inclusive. What we quote is what you get.

## How Payments Work

Vauban uses cryptocurrency for payments, but you don't need to understand crypto. Here's the experience:

### For Readers

1. Click "Purchase" on a paid article
2. Approve payment in your wallet
3. Content unlocks immediately

Payments are in ETH or STRK (Starknet's native token). Transactions settle in 6 seconds.

### For Authors

1. Earnings accumulate in your Vauban account
2. View balance in your dashboard
3. Click "Withdraw" when ready
4. Funds arrive in your wallet

No payment thresholds. No waiting for monthly payouts. No PayPal holds. Your money, your control.

### Real-Time Revenue

Unlike traditional platforms where you wait 30-60 days to see earnings, Vauban shows revenue in real-time:

```
Article: "How to Build a Startup"
├── Published: 3 days ago
├── Purchases: 47
├── Revenue: $235.00
├── Your earnings: $199.75 (85%)
└── Available to withdraw: $199.75
```

Transparency isn't just ethical—it's motivating. Watching earnings accumulate keeps you writing.

## Subscription Tiers

Beyond one-time purchases, you can offer subscriptions:

```
Your Newsletter Tiers:
├── Free:    $0/month  - Weekly highlights
├── Basic:   $5/month  - Full access, monthly digest
└── Premium: $15/month - Everything + early access + comments
```

Subscribers pay monthly or annually. You receive 85% of each payment, distributed automatically.

### Subscriber Benefits

Subscribers can receive:
- Early access to new articles
- Exclusive content (subscriber-only posts)
- Direct comments/feedback access
- Community features
- Whatever you want to offer

You control what each tier gets. The platform just facilitates the payments.

## No Algorithm, No Problem

Medium and YouTube creators live in fear of "the algorithm"—invisible systems that decide who sees your content and how you get paid.

Vauban has no algorithm. Here's what determines your success:

1. **Quality of your writing** - Does it provide value?
2. **Your audience building** - Do people subscribe and return?
3. **Pricing strategy** - Are you pricing appropriately?

That's it. No gaming engagement metrics. No wondering why your reach suddenly dropped. No optimizing for a black box.

Your content reaches everyone who wants to see it. Revenue comes directly from readers who value your work.

## The Reputation Economy

Beyond direct payments, Vauban tracks reputation:

```
Your Reputation
├── Total Points: 3,450
├── Level: Established (Level 3)
├── Badges: First Post 🌱, Prolific Writer 📝, Featured ⭐
└── Rank: Top 15% of authors
```

Reputation reflects your contribution to the platform:
- Publishing articles: +100 points
- Getting featured: +500 points
- Receiving likes: +5 points each
- Comments: +10 points each

High reputation authors:
- Are more visible in discovery
- Can earn "Contributor" status (direct publishing rights)
- Build verifiable credibility

Unlike follower counts that can be bought, reputation is earned through genuine engagement tracked on-chain.

## Transparency Through Blockchain

Every payment on Vauban is recorded on the blockchain. This means:

**For Authors:**
- Verify every payment you've received
- Audit platform fees in real-time
- No "accounting discrepancies"

**For Readers:**
- See exactly where your money goes
- Verify authors received their share
- Support creators with confidence

Want to check if we're honest? Query the Treasury contract directly:

```typescript
// Check total distributed to authors
const totalToAuthors = await treasury.getTotalAuthorEarnings();

// Check platform fees collected
const platformFees = await treasury.getTotalPlatformRevenue();

// Verify the ratio
const platformPercentage = platformFees / (totalToAuthors + platformFees);
// Should be ~10%
```

This isn't trust. It's verification.

## Getting Started with Monetization

### 1. Set Up Paid Content

When creating an article:
- Toggle "Paid Content"
- Set your price ($1-$100+)
- Optionally add free preview length

### 2. Create Subscription Tiers

In your dashboard:
- Navigate to "Monetization"
- Create tiers with names, prices, benefits
- Describe what subscribers get

### 3. Promote Your Work

- Share articles with referral links (others earn 5%, you still get 85%)
- Build your newsletter audience
- Cross-promote on social media

### 4. Withdraw Earnings

- Connect your wallet
- Click "Withdraw"
- Receive funds in seconds

## The Future of Creator Economics

The internet was supposed to let anyone build an audience and earn from their work. Instead, platforms captured that value.

Vauban returns to the original promise:

- **Create something valuable**
- **People pay for it**
- **You keep the money**

Not 50%. Not after algorithmic games. Not pending platform approval.

85%, transparent, immediate.

This is how creative economics should work. We're proving it can.

---

## Your First $100

Ready to earn? Here's a challenge:

1. Write something valuable
2. Price it at $5
3. Get 20 people to buy it (share your referral link)
4. Earn $85

Your cost: just your time and creativity.

Your platform take: zero.

---

*Every revenue claim in this article is verifiable on-chain. Query our Treasury contract at `0x...` to audit the numbers yourself.*
