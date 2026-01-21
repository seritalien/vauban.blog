#!/usr/bin/env npx ts-node

/**
 * Vauban Blog - M2M Publish CLI
 *
 * Publish markdown files to Vauban Blog via the M2M API.
 *
 * Usage:
 *   npx ts-node scripts/publish-cli.ts <file.md> [options]
 *
 * Options:
 *   --api-url <url>     API base URL (default: http://localhost:3005)
 *   --api-key <key>     M2M API key (or set M2M_API_KEY env var)
 *   --dry-run           Validate without publishing
 *
 * Frontmatter:
 *   ---
 *   title: My Article Title
 *   slug: my-article-slug
 *   excerpt: A short description...
 *   tags: [web3, blockchain]
 *   coverImage: https://example.com/image.jpg  # optional
 *   isPaid: false                              # optional
 *   price: 0                                   # optional, in STRK
 *   ---
 *   # Article content...
 */

import * as fs from 'fs';
import * as path from 'path';

interface Frontmatter {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  coverImage?: string;
  isPaid?: boolean;
  price?: number;
}

interface PublishResponse {
  success: boolean;
  data?: {
    txHash: string;
    arweaveTxId: string;
    ipfsCid: string;
    contentHash: string;
    title: string;
    slug: string;
  };
  error?: string;
  message?: string;
  details?: unknown;
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid markdown file: missing frontmatter');
  }

  const [, frontmatterYaml, body] = match;

  // Simple YAML parsing (enough for our needs)
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterYaml.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Handle arrays (simple format: [item1, item2])
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    // Handle booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Handle numbers
    else if (typeof value === 'string' && !isNaN(Number(value)) && value !== '') {
      value = Number(value);
    }
    // Remove quotes from strings
    else if (typeof value === 'string') {
      value = value.replace(/^['"]|['"]$/g, '');
    }

    frontmatter[key] = value;
  }

  // Validate required fields
  const required = ['title', 'slug', 'excerpt', 'tags'];
  for (const field of required) {
    if (!frontmatter[field]) {
      throw new Error(`Missing required frontmatter field: ${field}`);
    }
  }

  if (!Array.isArray(frontmatter.tags) || frontmatter.tags.length === 0) {
    throw new Error('Frontmatter "tags" must be a non-empty array');
  }

  return {
    frontmatter: frontmatter as unknown as Frontmatter,
    body: body.trim(),
  };
}

/**
 * Publish article via M2M API
 */
async function publishArticle(
  apiUrl: string,
  apiKey: string,
  frontmatter: Frontmatter,
  content: string
): Promise<PublishResponse> {
  const response = await fetch(`${apiUrl}/api/m2m/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      title: frontmatter.title,
      slug: frontmatter.slug,
      content,
      excerpt: frontmatter.excerpt,
      tags: frontmatter.tags,
      coverImage: frontmatter.coverImage,
      isPaid: frontmatter.isPaid || false,
      price: frontmatter.price || 0,
    }),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    return {
      success: false,
      error: data.error as string | undefined,
      message: data.message as string | undefined,
      details: data.details as string | undefined,
    };
  }

  return data as unknown as PublishResponse;
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let filePath: string | undefined;
  let apiUrl = process.env.VAUBAN_API_URL || 'http://localhost:3005';
  let apiKey = process.env.M2M_API_KEY || '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--api-url' && args[i + 1]) {
      apiUrl = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      apiKey = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }

  // Validate arguments
  if (!filePath) {
    console.error('Usage: npx ts-node scripts/publish-cli.ts <file.md> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --api-url <url>     API base URL (default: http://localhost:3005)');
    console.error('  --api-key <key>     M2M API key (or set M2M_API_KEY env var)');
    console.error('  --dry-run           Validate without publishing');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: API key required. Use --api-key or set M2M_API_KEY env var.');
    process.exit(1);
  }

  // Read and parse file
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf-8');

  let frontmatter: Frontmatter;
  let body: string;

  try {
    const parsed = parseFrontmatter(fileContent);
    frontmatter = parsed.frontmatter;
    body = parsed.body;
  } catch (error) {
    console.error(`Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  console.log('Parsed article:');
  console.log(`  Title: ${frontmatter.title}`);
  console.log(`  Slug: ${frontmatter.slug}`);
  console.log(`  Tags: ${frontmatter.tags.join(', ')}`);
  console.log(`  Content length: ${body.length} characters`);
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] Article validated successfully. No changes made.');
    process.exit(0);
  }

  // Publish
  console.log(`Publishing to ${apiUrl}...`);

  try {
    const result = await publishArticle(apiUrl, apiKey, frontmatter, body);

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      console.error(`Message: ${result.message}`);
      if (result.details) {
        console.error('Details:', JSON.stringify(result.details, null, 2));
      }
      process.exit(1);
    }

    console.log('');
    console.log('Article published successfully!');
    console.log('');
    console.log('Details:');
    console.log(`  Transaction: ${result.data?.txHash}`);
    console.log(`  Arweave TX: ${result.data?.arweaveTxId}`);
    console.log(`  IPFS CID: ${result.data?.ipfsCid}`);
    console.log(`  Content Hash: ${result.data?.contentHash}`);
  } catch (error) {
    console.error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
