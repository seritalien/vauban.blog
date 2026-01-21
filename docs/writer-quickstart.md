# Writer Quick Start Guide

Welcome to Vauban Blog! This guide will get you publishing in minutes.

---

## Two Ways to Publish

### Option 1: Web UI (Recommended for beginners)

**Best for**: Manual writing, one-off articles, visual editing

1. **Connect Wallet**
   - Go to [vauban.blog](http://localhost:3005)
   - Click "Connect Wallet" or use "Dev1/Dev2" buttons (devnet only)
   - Approve connection in your wallet

2. **Write Your Article**
   - Navigate to `/admin/editor`
   - Fill in:
     - **Title**: Your article title
     - **Content**: Write in Markdown (live preview on right)
     - **Tags**: Add 1-5 relevant tags
     - **Excerpt**: Brief summary (shown in previews)
     - **Cover Image**: Optional banner image

3. **Publish**
   - Click "Save Draft" to save progress
   - Click "Publish" when ready (Contributors+) or "Submit for Review" (Writers)
   - Wait for blockchain confirmation (~6 seconds)

4. **Done!**
   - Your article is permanently stored on Arweave + IPFS
   - View at `/articles/your-slug`

---

### Option 2: M2M API (For automation)

**Best for**: CI/CD pipelines, automated publishing, AI agents, bulk content

1. **Get API Key**
   - Contact platform admin to get an M2M API key
   - Key format: `vb_xxxxx...`

2. **Prepare Your Content**
   Create a markdown file with frontmatter:

   ```markdown
   ---
   title: My Awesome Article
   slug: my-awesome-article
   excerpt: A brief description of what this article covers.
   tags:
     - tutorial
     - web3
   coverImage: https://example.com/image.png
   ---

   # My Awesome Article

   Your markdown content here...
   ```

3. **Publish via CLI**
   ```bash
   # Set your API key
   export M2M_API_KEY=vb_your_key_here

   # Publish (dry-run first)
   npx ts-node scripts/publish-cli.ts --dry-run your-article.md

   # Publish for real
   npx ts-node scripts/publish-cli.ts your-article.md
   ```

4. **Or via HTTP API**
   ```bash
   curl -X POST http://localhost:3005/api/m2m/publish \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $M2M_API_KEY" \
     -d '{
       "title": "My Article",
       "content": "# Hello\n\nContent here...",
       "slug": "my-article",
       "tags": ["tutorial"],
       "excerpt": "Brief description"
     }'
   ```

---

## Role Progression

Your capabilities depend on your role:

| Role | Can Do | How to Get |
|------|--------|------------|
| **Reader** (Level 0) | Read, like, comment | Connect wallet |
| **Writer** (Level 1) | Create drafts, submit for review | Automatic on first post attempt |
| **Contributor** (Level 2) | Direct publish, edit own posts | Get 5 posts approved |
| **Moderator** (Level 3) | Hide content, temp bans | Admin promotion |
| **Editor** (Level 4) | Approve/reject posts, feature content | Admin promotion |
| **Admin** (Level 5) | Full platform control | Owner designation |

---

## Article Workflow

```
Draft → Submit → Review → Published
  ↑        ↓
  └── Revision requested
```

**Writers**: Articles go through editorial review
**Contributors**: Direct publish, no review needed

---

## Content Guidelines

✅ **Do**:
- Write original content
- Cite sources for claims
- Use clear, readable formatting
- Add relevant tags
- Include helpful excerpts

❌ **Don't**:
- Plagiarize content
- Post spam or ads
- Include harmful content
- Share private information

---

## Monetization (Contributors+)

1. Toggle "Paid Content" in editor
2. Set price in ETH/STRK
3. Readers pay to access full article

**Revenue split**:
- 85% to author
- 10% to platform
- 5% to referrer

---

## Quick Links

- **Editor**: `/admin/editor`
- **My Posts**: `/dashboard`
- **All Authors**: `/authors`
- **API Docs**: `/docs/api-reference.md`

---

## Getting Help

- **Docs**: `docs/` folder in repository
- **Issues**: Report bugs on GitHub
- **Community**: Join our Discord (coming soon)

---

## Example: First Post

```markdown
---
title: Hello Vauban!
slug: hello-vauban
excerpt: My first post on the decentralized web.
tags:
  - introduction
  - personal
---

# Hello Vauban!

This is my first post on Vauban Blog, a decentralized
publishing platform built on Starknet L3.

## Why I'm Here

I believe in **permanent, censorship-resistant** content.
My words should outlive any single platform.

## What's Next

Stay tuned for more posts about:
- Web3 development
- Decentralized publishing
- The future of content ownership

---

*Published with ❤️ on Vauban Blog*
```

Save as `hello-vauban.md` and publish:

```bash
M2M_API_KEY=vb_xxx npx ts-node scripts/publish-cli.ts hello-vauban.md
```

Or paste into the web editor at `/admin/editor`.

**Welcome to permanent publishing!** 🚀
