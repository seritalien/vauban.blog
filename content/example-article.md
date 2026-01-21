---
title: Getting Started with Vauban Blog
slug: getting-started-with-vauban-blog
excerpt: Learn how to publish your first decentralized article on Vauban Blog, powered by Starknet L3 and permanent Arweave storage.
tags: [tutorial, web3, starknet, getting-started]
coverImage: https://images.unsplash.com/photo-1516321318423-f06f85e504b3
isPaid: false
price: 0
---

# Getting Started with Vauban Blog

Welcome to Vauban Blog, the decentralized publishing platform that gives you true ownership of your content.

## Why Vauban Blog?

Traditional blogging platforms can:
- Delete your content without warning
- Change their terms of service
- Shut down entirely

With Vauban Blog, your content is:
- **Permanently stored** on Arweave
- **Cryptographically verified** with SHA256 hashes
- **Truly decentralized** on Starknet L3

## How It Works

1. **Write your article** in Markdown
2. **Publish** through the web UI or M2M API
3. **Content is stored** on IPFS (fast) and Arweave (permanent)
4. **Verification hash** is recorded on-chain

## Your First Article

Here's how to publish your first article:

```bash
# Using the CLI
npx ts-node scripts/publish-cli.ts content/my-article.md \
  --api-url http://localhost:3000 \
  --api-key your-api-key
```

Or simply push a markdown file to the `content/` directory and let GitHub Actions handle the rest!

## Markdown Support

Vauban Blog supports full GitHub-flavored Markdown:

- **Bold** and *italic* text
- `code snippets`
- Code blocks with syntax highlighting
- Tables, lists, and more

## What's Next?

Start writing and own your words. Forever.
