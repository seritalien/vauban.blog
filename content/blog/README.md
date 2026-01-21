# Vauban Blog - Content Library

This directory contains the official blog articles for Vauban Blog. These articles explain the platform, its technology, and how to use it.

## Articles

### Featured

| # | Article | Topic | Description |
|---|---------|-------|-------------|
| 01 | [Own Your Words. Forever.](./01-own-your-words-forever.md) | Philosophy | Introduction to Vauban and why it exists |
| 04 | [The 85% Promise](./04-the-85-percent-promise.md) | Economics | Fair revenue sharing for writers |
| 07 | [Getting Started](./07-getting-started.md) | Tutorial | Step-by-step first article guide |

### Technology

| # | Article | Topic | Description |
|---|---------|-------|-------------|
| 02 | [The 200-Year Library](./02-the-200-year-library.md) | Storage | Why Arweave for permanent content |
| 03 | [Under the Hood](./03-under-the-hood.md) | Architecture | Technical deep-dive into the stack |
| 05 | [Web3 Without the Friction](./05-web3-without-the-friction.md) | UX | Session keys and gasless transactions |

### Platform

| # | Article | Topic | Description |
|---|---------|-------|-------------|
| 06 | [The Trust Ladder](./06-the-trust-ladder.md) | Governance | 7-tier role system explained |

## Frontmatter Schema

Each article uses the following frontmatter:

```yaml
---
title: "Article Title"
slug: article-slug
excerpt: "Short description for previews"
author: "Author Name"
tags: ["tag1", "tag2"]
publishedAt: 2026-01-15
featured: true/false
---
```

## Publishing

These articles are designed to be published on Vauban Blog itself using the M2M API or manual editor.

### Using M2M API

```bash
# Publish an article via API
curl -X POST https://vauban.blog/api/m2m/publish \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d @content/blog/01-own-your-words-forever.json
```

### Using CLI

```bash
# Publish using the CLI tool
pnpm publish:article content/blog/01-own-your-words-forever.md
```

## Content Guidelines

- Write in clear, accessible language
- Explain technical concepts for non-technical readers
- Include practical examples and code snippets where relevant
- End with calls to action or next steps
- Link to relevant documentation

## License

Content is MIT licensed. Feel free to adapt for your own platforms with attribution.
