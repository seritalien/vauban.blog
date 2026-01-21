---
title: "The Trust Ladder: How Vauban's Role System Works"
slug: the-trust-ladder
excerpt: "From Reader to Owner: understanding Vauban's 7-tier permission system and how to climb the ladder."
author: "Vauban Team"
tags: ["governance", "roles", "community", "moderation"]
coverImage: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=1200&h=630&fit=crop"
publishedAt: 2026-01-28
featured: false
---

# The Trust Ladder: How Vauban's Role System Works

Every platform faces the same challenge: how do you maintain quality while staying open? Let anyone post, you get spam. Restrict posting, you become gatekeepers.

Vauban solves this with a **progressive trust system**—seven roles that unlock more capabilities as you prove yourself. Think of it as a ladder where everyone starts at the bottom and can climb through demonstrated value.

## The Seven Roles

```
Level 6 │ OWNER        │ Platform governance
Level 5 │ ADMIN        │ Full management
Level 4 │ EDITOR       │ Content approval
Level 3 │ MODERATOR    │ Community safety
Level 2 │ CONTRIBUTOR  │ Direct publishing
Level 1 │ WRITER       │ Submit for review
Level 0 │ READER       │ Consume and engage
```

Each level inherits all permissions from levels below. An Editor can do everything a Writer can, plus more.

Let's explore each role.

## Reader (Level 0)

**Who**: Anyone who connects a wallet

**Can do**:
- Read all public articles
- Like articles
- Comment on articles
- Follow authors
- Bookmark content

**Cannot do**:
- Create articles
- Moderate content
- Access admin features

This is where everyone starts. You don't even need a wallet to read—only to engage.

### Why This Matters

Many Web3 platforms require tokens to participate. We believe reading should be free and universal. The blockchain identity only matters when you want to contribute.

## Writer (Level 1)

**Who**: Users who want to publish

**Can do**:
- Everything a Reader can
- Create draft articles
- Submit articles for editorial review
- Edit your own drafts
- View your submission status

**Cannot do**:
- Publish immediately (requires Editor approval)
- Edit published articles
- Moderate others

### Getting Writer Status

When you first try to create an article, you're prompted to request Writer status. Currently, this is automatic—connect your wallet, agree to the content policy, and you're a Writer.

In the future, we may require:
- Profile completion
- Email verification
- Small stake (refundable)

### The Review Process

As a Writer, your articles go through review:

```
You write article → Submit for review → Editor reviews
                                              ↓
                    ← Approved (published!) ←─┤
                    ← Needs revision ←─────────┤
                    ← Rejected (with reason) ←─┘
```

This isn't censorship—it's quality control. Editors check for:
- Spam or plagiarism
- Basic quality standards
- Policy compliance

The vast majority of sincere submissions are approved within 24 hours.

## Contributor (Level 2)

**Who**: Trusted writers who've proven themselves

**Can do**:
- Everything a Writer can
- **Publish immediately** (bypass review)
- Edit your own published articles
- Delete your own content
- Access detailed analytics

**Cannot do**:
- Moderate others
- Approve other writers' content
- Admin functions

### How to Become a Contributor

Contributor status is earned, not given. There are two paths:

**Automatic Promotion**:
- Get 5 articles approved by Editors
- No policy violations in the last 30 days
- Account older than 7 days

The system automatically promotes you. No application needed.

**Manual Promotion**:
- Demonstrate expertise in a field
- Have a significant external portfolio
- Request review from Admins

### Why This Tier Exists

Contributors are the engine of the platform. They've proven they understand quality standards. Letting them publish directly:
- Speeds up content flow
- Frees Editors for new writers
- Rewards consistent quality

Think of it like becoming a "verified" creator, except the verification is based on track record, not Twitter checkmarks.

## Moderator (Level 3)

**Who**: Community guardians

**Can do**:
- Everything a Contributor can
- View reported content
- Resolve reports (dismiss or action)
- Hide/unhide comments
- Issue temporary bans (up to 7 days)
- Warn users

**Cannot do**:
- Approve articles for publication
- Permanently ban users
- Access financial data
- Admin settings

### The Moderation Workflow

When someone reports content, it enters the moderation queue:

```
Report submitted → Moderator reviews → Decision
                                           ↓
            ← Dismiss (false report) ←─────┤
            ← Warning issued ←─────────────┤
            ← Content hidden ←─────────────┤
            ← Temp ban (1-7 days) ←────────┤
            ← Escalate to Admin ←──────────┘
```

Moderators focus on community safety—spam, harassment, misinformation. They don't make editorial judgments about content quality.

### Becoming a Moderator

Moderator is an appointed role. You can't earn it automatically.

If you're interested:
1. Build reputation as a Contributor
2. Demonstrate good judgment in comments
3. Express interest to Admins
4. Complete moderation guidelines training

Moderators are community members who volunteer their time to keep Vauban safe.

## Editor (Level 4)

**Who**: Editorial gatekeepers

**Can do**:
- Everything a Moderator can
- View pending article queue
- Approve or reject submissions
- Request revisions on articles
- Edit any published article
- Feature articles on the homepage
- Manage tags (create, edit, merge)

**Cannot do**:
- Manage user accounts
- Access platform settings
- Financial operations

### The Editorial Process

Editors are the quality bar. They review new submissions:

**Approval criteria**:
- Clear, competent writing
- Accurate information
- Original content (not plagiarized)
- Complies with content policy
- Appropriate tags

**Common rejection reasons**:
- Low effort or incomplete
- Factually inaccurate
- Promotional spam
- Policy violations

Editors provide feedback on rejections so writers can improve.

### Featuring Content

Editors can "feature" exceptional articles, which:
- Appear in the Featured section on the homepage
- Get highlighted in newsletter digests
- Earn the author the "Featured Author" badge
- Boost the author's reputation significantly

Being featured is a mark of quality that attracts new readers.

## Admin (Level 5)

**Who**: Platform operators

**Can do**:
- Everything an Editor can
- Manage all user accounts
- Grant/revoke roles (except Owner)
- Permanently ban users
- Delete any content
- Access platform analytics
- Configure platform settings

**Cannot do**:
- Withdraw platform treasury
- Transfer ownership
- Upgrade smart contracts
- Emergency pause

### Admin Responsibilities

Admins handle the operational side:
- Responding to appeals
- Handling complex moderation cases
- Analyzing platform health
- Making policy decisions
- Onboarding new Editors/Moderators

This is a trusted role with significant power. Admins are carefully selected and accountable.

## Owner (Level 6)

**Who**: Platform founders / governance

**Can do**:
- Everything an Admin can
- Withdraw platform treasury funds
- Set platform fee percentages
- Transfer ownership to another address
- Upgrade smart contracts
- Emergency pause all operations

This is the ultimate authority over the platform.

### Governance Considerations

Currently, the Owner is the founding team. As Vauban matures, we plan to:

1. **Transition to multisig**: Require multiple signatures for critical actions
2. **Add time locks**: Major changes announced in advance
3. **Eventually DAO governance**: Community voting on key decisions

Decentralization is a journey, not a destination. We're building toward distributed governance while maintaining operational agility.

## The Reputation System

Alongside roles, Vauban tracks reputation—a numeric score reflecting your contributions:

| Action | Points |
|--------|--------|
| Article published | +100 |
| Article featured | +500 |
| Comment posted | +10 |
| Like received | +5 |
| Subscriber gained | +50 |
| Valid report | +25 |
| Policy violation | -200 |

### Reputation Levels

Points unlock reputation levels:

| Level | Points | Title |
|-------|--------|-------|
| 1 | 0-99 | Newcomer |
| 2 | 100-499 | Active Writer |
| 3 | 500-1,999 | Established |
| 4 | 2,000-9,999 | Veteran |
| 5 | 10,000+ | Legend |

High reputation:
- Increases visibility in discovery
- Qualifies for badges
- Builds credibility with readers
- May influence future governance rights

### Badges

Special achievements earn badges displayed on your profile:

- 🌱 **First Post** - Published first article
- 📝 **Prolific Writer** - 10+ articles
- 💯 **Century Club** - 100+ articles
- ⭐ **Featured Author** - Had a featured article
- 💬 **Conversationalist** - 100+ comments
- ❤️ **Beloved** - 1,000+ likes received
- 🎖️ **Early Adopter** - Joined in first month
- ✅ **Verified** - Completed verification
- 🏆 **Top Writer** - Monthly top 10
- 💎 **Premium Author** - Has paid subscribers
- 🔒 **Trusted** - Earned Contributor status
- 🛡️ **Guardian** - Active Moderator

Badges are on-chain, meaning you truly own them. They're portable proof of your reputation.

## Why This System Works

### Progressive Trust

New users can't spam because they need approval. But they're not permanently second-class—five good articles earn autonomy.

### Clear Incentives

The path upward is transparent:
- Write quality content → Become Contributor
- Help the community → Become Moderator
- Demonstrate judgment → Become Editor

Everyone knows what it takes.

### Accountability

Higher roles mean more scrutiny:
- Contributor articles are public with attribution
- Moderator actions are logged
- Admin decisions are auditable
- Owner actions are on-chain

Power comes with transparency.

### Meritocracy Over Popularity

Follower counts don't matter for advancement. What matters:
- Quality of contributions
- Consistency over time
- Good judgment
- Community benefit

A thoughtful writer with 100 followers can become a Contributor. A viral influencer who posts spam cannot.

## Climbing the Ladder

Here's your roadmap:

### Reader → Writer
1. Connect your wallet
2. Agree to content policy
3. Start writing

### Writer → Contributor
1. Submit articles for review
2. Get 5 approved
3. Maintain good standing
4. Auto-promoted!

### Contributor → Moderator
1. Build reputation (500+ points)
2. Demonstrate good judgment
3. Express interest
4. Get selected and trained

### Moderator → Editor
1. Excellent moderation track record
2. Show editorial instincts
3. Be selected by Admins

### Editor → Admin
1. Proven Editor performance
2. Deep platform understanding
3. Trust of the team

### Admin → Owner
1. Currently: Not available
2. Future: Governance token voting or similar

## Your Role Today

Whatever your current role, you can contribute:

- **Readers**: Engage thoughtfully. Good comments help everyone.
- **Writers**: Focus on quality. Your path to Contributor is clear.
- **Contributors**: Keep publishing. Consider mentoring new writers.
- **Moderators**: Keep us safe. Your work matters enormously.
- **Editors**: Maintain quality. Help writers improve.
- **Admins**: Steward the platform. Make fair decisions.

Every role matters. Every contribution builds the platform we all share.

---

## Check Your Status

Visit your Dashboard to see:
- Current role
- Reputation points
- Badges earned
- Path to next level

---

*Vauban's role system is implemented in smart contracts. Every role assignment and reputation change is on-chain and verifiable. See [RoleRegistry Contract](/docs/smart-contracts#roleregistry) for technical details.*
