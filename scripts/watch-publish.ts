#!/usr/bin/env npx ts-node

/**
 * Vauban Blog - File Watcher Publisher
 *
 * Watches a directory for new markdown files and auto-publishes them.
 *
 * Usage:
 *   npx ts-node scripts/watch-publish.ts [directory] [options]
 *
 * Options:
 *   --api-url <url>     API base URL (default: http://localhost:3005)
 *   --api-key <key>     M2M API key (or set M2M_API_KEY env var)
 *   --archive <dir>     Move processed files to archive directory
 *   --interval <ms>     Polling interval in ms (default: 5000)
 *
 * Default directory: ./content
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
}

// Track processed files
const processedFiles = new Set<string>();

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

  // Simple YAML parsing
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterYaml.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    } else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (typeof value === 'string' && !isNaN(Number(value)) && value !== '') {
      value = Number(value);
    } else if (typeof value === 'string') {
      value = value.replace(/^['"]|['"]$/g, '');
    }

    frontmatter[key] = value;
  }

  const required = ['title', 'slug', 'excerpt', 'tags'];
  for (const field of required) {
    if (!frontmatter[field]) {
      throw new Error(`Missing required frontmatter field: ${field}`);
    }
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

  return response.json();
}

/**
 * Process a single markdown file
 */
async function processFile(
  filePath: string,
  apiUrl: string,
  apiKey: string,
  archiveDir?: string
): Promise<void> {
  const fileName = path.basename(filePath);

  console.log(`[${new Date().toISOString()}] Processing: ${fileName}`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    console.log(`  Title: ${frontmatter.title}`);
    console.log(`  Publishing...`);

    const result = await publishArticle(apiUrl, apiKey, frontmatter, body);

    if (!result.success) {
      console.error(`  ERROR: ${result.error} - ${result.message}`);
      return;
    }

    console.log(`  SUCCESS: TX ${result.data?.txHash}`);
    console.log(`  IPFS: ${result.data?.ipfsCid}`);

    // Move to archive if configured
    if (archiveDir) {
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      const archivePath = path.join(archiveDir, fileName);
      fs.renameSync(filePath, archivePath);
      console.log(`  Archived to: ${archivePath}`);
    }

    processedFiles.add(filePath);
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Scan directory for new markdown files
 */
async function scanDirectory(
  watchDir: string,
  apiUrl: string,
  apiKey: string,
  archiveDir?: string
): Promise<void> {
  if (!fs.existsSync(watchDir)) {
    console.log(`Creating watch directory: ${watchDir}`);
    fs.mkdirSync(watchDir, { recursive: true });
    return;
  }

  const files = fs.readdirSync(watchDir);
  const mdFiles = files.filter(
    f => f.endsWith('.md') && !processedFiles.has(path.join(watchDir, f))
  );

  for (const file of mdFiles) {
    const filePath = path.join(watchDir, file);

    // Skip hidden files and files being written (check if file is stable)
    if (file.startsWith('.')) continue;

    const stats = fs.statSync(filePath);
    const now = Date.now();
    const mtime = stats.mtimeMs;

    // Wait for file to be stable (no writes in last 2 seconds)
    if (now - mtime < 2000) {
      continue;
    }

    await processFile(filePath, apiUrl, apiKey, archiveDir);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let watchDir = './content';
  let apiUrl = process.env.VAUBAN_API_URL || 'http://localhost:3005';
  let apiKey = process.env.M2M_API_KEY || '';
  let archiveDir: string | undefined;
  let interval = 5000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--api-url' && args[i + 1]) {
      apiUrl = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      apiKey = args[++i];
    } else if (arg === '--archive' && args[i + 1]) {
      archiveDir = args[++i];
    } else if (arg === '--interval' && args[i + 1]) {
      interval = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      watchDir = arg;
    }
  }

  if (!apiKey) {
    console.error('Error: API key required. Use --api-key or set M2M_API_KEY env var.');
    process.exit(1);
  }

  watchDir = path.resolve(watchDir);
  if (archiveDir) {
    archiveDir = path.resolve(archiveDir);
  }

  console.log('Vauban Blog - File Watcher Publisher');
  console.log('=====================================');
  console.log(`Watch directory: ${watchDir}`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Archive: ${archiveDir || 'disabled'}`);
  console.log(`Poll interval: ${interval}ms`);
  console.log('');
  console.log('Watching for new markdown files...');
  console.log('Press Ctrl+C to stop.');
  console.log('');

  // Initial scan
  await scanDirectory(watchDir, apiUrl, apiKey, archiveDir);

  // Continuous polling
  setInterval(async () => {
    await scanDirectory(watchDir, apiUrl, apiKey, archiveDir);
  }, interval);
}

main();
