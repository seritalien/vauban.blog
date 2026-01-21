#!/usr/bin/env tsx
/**
 * Vauban Blog - Enhanced Content Publishing CLI
 *
 * Publish markdown files to Vauban Blog via the M2M API.
 * Supports single file and batch publishing with state tracking.
 *
 * Usage:
 *   # Single article
 *   pnpm publish:article content/blog/my-article.md
 *
 *   # Batch publish directory
 *   pnpm publish:batch content/blog/
 *
 *   # With options
 *   pnpm publish:batch content/blog/ --delay 3000 --skip-published --dry-run
 *
 * Options:
 *   --dry-run           Validate without publishing
 *   --delay <ms>        Delay between batch publishes (default: 2000)
 *   --skip-published    Skip already published articles
 *   --verbose           Show detailed output
 *   --api-url <url>     Override API base URL (default: http://localhost:3005)
 *   --api-key <key>     Override API key (default: M2M_API_KEY env var)
 *
 * Frontmatter format:
 *   ---
 *   title: "Article Title"
 *   slug: article-slug
 *   excerpt: "Short description"
 *   author: "Author Name"
 *   tags: ["tag1", "tag2"]
 *   coverImage: "https://example.com/image.jpg"  # optional
 *   publishedAt: 2026-01-15                      # optional
 *   featured: false                              # optional
 *   isPaid: false                                # optional
 *   price: 0                                     # optional
 *   ---
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color?: keyof typeof colors): void {
  if (color && colors[color]) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

function logError(message: string): void {
  console.error(`${colors.red}✖ ${message}${colors.reset}`);
}

function logSuccess(message: string): void {
  console.log(`${colors.green}✔ ${message}${colors.reset}`);
}

function logWarning(message: string): void {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function logInfo(message: string): void {
  console.log(`${colors.cyan}ℹ ${message}${colors.reset}`);
}

// Types
interface Frontmatter {
  title: string;
  slug: string;
  excerpt: string;
  author?: string;
  tags: string[];
  coverImage?: string;
  publishedAt?: string;
  featured?: boolean;
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

interface PublishedArticle {
  file: string;
  txHash: string;
  ipfsCid: string;
  arweaveTxId: string;
  contentHash: string;
  publishedAt: string;
}

interface PublishedState {
  version: string;
  updatedAt: string;
  articles: Record<string, PublishedArticle>;
}

interface CLIOptions {
  files: string[];
  batch: boolean;
  dryRun: boolean;
  delay: number;
  skipPublished: boolean;
  verbose: boolean;
  apiUrl: string;
  apiKey: string;
}

// Frontmatter parsing
function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid markdown file: missing frontmatter (---...---)');
  }

  const [, frontmatterYaml, body] = match;
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterYaml.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Skip empty values
    if (value === '') continue;

    // Handle arrays: [item1, item2] or ["item1", "item2"]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter((s) => s.length > 0);
    }
    // Handle booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Handle numbers (but not dates like 2026-01-15)
    else if (
      typeof value === 'string' &&
      !isNaN(Number(value)) &&
      value !== '' &&
      !value.includes('-')
    ) {
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

// State management
function getStateFilePath(directory: string): string {
  return path.join(directory, '.published.json');
}

function loadPublishedState(directory: string): PublishedState {
  const stateFile = getStateFilePath(directory);
  if (fs.existsSync(stateFile)) {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch {
      return { version: '1.0', updatedAt: new Date().toISOString(), articles: {} };
    }
  }
  return { version: '1.0', updatedAt: new Date().toISOString(), articles: {} };
}

function savePublishedState(directory: string, state: PublishedState): void {
  const stateFile = getStateFilePath(directory);
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
}

// API calls
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

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error,
      message: data.message,
      details: data.details,
    };
  }

  return data;
}

async function checkApiStatus(apiUrl: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/m2m/publish`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });

    if (!response.ok) {
      const data = await response.json();
      logError(`API error: ${data.error || response.statusText}`);
      return false;
    }

    const data = await response.json();
    if (!data.configured) {
      logError('M2M publishing is not configured on the server');
      return false;
    }

    return true;
  } catch (error) {
    logError(`Cannot reach API at ${apiUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// File processing
function findMarkdownFiles(directory: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  // Files to skip (not articles)
  const skipFiles = ['readme.md', 'changelog.md', 'license.md', 'contributing.md'];

  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      !entry.name.startsWith('.') &&
      !skipFiles.includes(entry.name.toLowerCase())
    ) {
      files.push(path.join(directory, entry.name));
    }
  }

  // Sort by filename (assumes numeric prefix like 01-, 02-)
  return files.sort();
}

async function processFile(
  filePath: string,
  options: CLIOptions,
  state: PublishedState
): Promise<{ success: boolean; slug?: string; result?: PublishResponse }> {
  const filename = path.basename(filePath);

  if (options.verbose) {
    logInfo(`Processing: ${filename}`);
  }

  // Read file
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    logError(`File not found: ${absolutePath}`);
    return { success: false };
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf-8');

  // Parse frontmatter
  let frontmatter: Frontmatter;
  let body: string;

  try {
    const parsed = parseFrontmatter(fileContent);
    frontmatter = parsed.frontmatter;
    body = parsed.body;
  } catch (error) {
    logError(`${filename}: ${error instanceof Error ? error.message : 'Parse error'}`);
    return { success: false };
  }

  // Check if already published
  if (options.skipPublished && state.articles[frontmatter.slug]) {
    if (options.verbose) {
      logWarning(`Skipping "${frontmatter.title}" (already published)`);
    }
    return { success: true, slug: frontmatter.slug };
  }

  // Display article info
  console.log('');
  log(`📄 ${frontmatter.title}`, 'bright');
  console.log(`   Slug: ${frontmatter.slug}`);
  console.log(`   Tags: ${frontmatter.tags.join(', ')}`);
  console.log(`   Content: ${body.length.toLocaleString()} characters`);
  if (frontmatter.coverImage) {
    console.log(`   Cover: ${frontmatter.coverImage.substring(0, 60)}...`);
  }

  // Dry run stops here
  if (options.dryRun) {
    logSuccess('Validated successfully (dry-run)');
    return { success: true, slug: frontmatter.slug };
  }

  // Publish
  console.log(`   Publishing to ${options.apiUrl}...`);

  try {
    const result = await publishArticle(options.apiUrl, options.apiKey, frontmatter, body);

    if (!result.success) {
      logError(`Failed: ${result.error}`);
      if (result.message) console.log(`   Message: ${result.message}`);
      if (result.details && options.verbose) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      return { success: false, slug: frontmatter.slug, result };
    }

    // Update state
    state.articles[frontmatter.slug] = {
      file: filename,
      txHash: result.data!.txHash,
      ipfsCid: result.data!.ipfsCid,
      arweaveTxId: result.data!.arweaveTxId,
      contentHash: result.data!.contentHash,
      publishedAt: new Date().toISOString(),
    };

    logSuccess('Published successfully!');
    if (options.verbose) {
      console.log(`   TX: ${result.data!.txHash}`);
      console.log(`   IPFS: ${result.data!.ipfsCid}`);
      console.log(`   Arweave: ${result.data!.arweaveTxId}`);
    }

    return { success: true, slug: frontmatter.slug, result };
  } catch (error) {
    logError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, slug: frontmatter.slug };
  }
}

// CLI argument parsing
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    files: [],
    batch: false,
    dryRun: false,
    delay: 2000,
    skipPublished: false,
    verbose: false,
    apiUrl: process.env.VAUBAN_API_URL || 'http://localhost:3005',
    apiKey: process.env.M2M_API_KEY || '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--batch':
      case '-b':
        options.batch = true;
        break;
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--skip-published':
      case '-s':
        options.skipPublished = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--delay':
      case '-d':
        if (args[i + 1]) {
          options.delay = parseInt(args[++i], 10);
        }
        break;
      case '--api-url':
        if (args[i + 1]) {
          options.apiUrl = args[++i];
        }
        break;
      case '--api-key':
        if (args[i + 1]) {
          options.apiKey = args[++i];
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          options.files.push(arg);
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
${colors.bright}Vauban Blog - Content Publishing CLI${colors.reset}

${colors.cyan}Usage:${colors.reset}
  pnpm publish:article <file.md>              Publish single article
  pnpm publish:batch <directory>              Batch publish all .md files
  pnpm publish:blog                           Publish content/blog/

${colors.cyan}Options:${colors.reset}
  -n, --dry-run         Validate without publishing
  -d, --delay <ms>      Delay between batch publishes (default: 2000)
  -s, --skip-published  Skip already published articles
  -v, --verbose         Show detailed output
  --api-url <url>       Override API base URL
  --api-key <key>       Override API key (or use M2M_API_KEY env)
  -h, --help            Show this help message

${colors.cyan}Environment:${colors.reset}
  M2M_API_KEY           API key for M2M publishing
  VAUBAN_API_URL        API base URL (default: http://localhost:3005)

${colors.cyan}Frontmatter:${colors.reset}
  Required: title, slug, excerpt, tags
  Optional: author, coverImage, publishedAt, featured, isPaid, price

${colors.cyan}Examples:${colors.reset}
  # Validate all blog articles
  pnpm publish:batch content/blog/ --dry-run

  # Publish new articles only
  pnpm publish:batch content/blog/ --skip-published

  # Publish with 5s delay between articles
  pnpm publish:batch content/blog/ --delay 5000 --verbose
`);
}

// Main entry point
async function main(): Promise<void> {
  const options = parseArgs();

  // Print header
  console.log('');
  log('═══════════════════════════════════════════════════', 'cyan');
  log('  Vauban Blog - Content Publisher', 'bright');
  log('═══════════════════════════════════════════════════', 'cyan');
  console.log('');

  // Validate inputs
  if (options.files.length === 0) {
    logError('No files or directories specified');
    console.log('');
    console.log('Usage: pnpm publish:article <file.md>');
    console.log('       pnpm publish:batch <directory>');
    console.log('');
    console.log('Run with --help for more options');
    process.exit(1);
  }

  if (!options.apiKey) {
    logError('API key required. Use --api-key or set M2M_API_KEY env var');
    process.exit(1);
  }

  // Determine files to process
  let filesToProcess: string[] = [];
  let stateDirectory: string = '';

  const targetPath = path.resolve(options.files[0]);

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    // Batch mode: process directory
    options.batch = true;
    stateDirectory = targetPath;
    filesToProcess = findMarkdownFiles(targetPath);

    if (filesToProcess.length === 0) {
      logError(`No .md files found in ${targetPath}`);
      process.exit(1);
    }

    logInfo(`Found ${filesToProcess.length} markdown file(s) in ${targetPath}`);
  } else if (fs.existsSync(targetPath) && targetPath.endsWith('.md')) {
    // Single file mode
    filesToProcess = [targetPath];
    stateDirectory = path.dirname(targetPath);
  } else {
    logError(`Invalid path: ${targetPath}`);
    process.exit(1);
  }

  // Show configuration
  if (options.verbose) {
    console.log('');
    logInfo('Configuration:');
    console.log(`   API URL: ${options.apiUrl}`);
    console.log(`   API Key: ${options.apiKey.substring(0, 8)}...`);
    console.log(`   Dry run: ${options.dryRun}`);
    console.log(`   Skip published: ${options.skipPublished}`);
    console.log(`   Delay: ${options.delay}ms`);
  }

  // Check API connectivity (skip for dry-run)
  if (!options.dryRun) {
    logInfo(`Checking API at ${options.apiUrl}...`);
    const apiOk = await checkApiStatus(options.apiUrl, options.apiKey);
    if (!apiOk) {
      process.exit(1);
    }
    logSuccess('API connection OK');
  }

  // Load published state
  const state = loadPublishedState(stateDirectory);

  if (options.skipPublished && Object.keys(state.articles).length > 0) {
    logInfo(`Found ${Object.keys(state.articles).length} previously published article(s)`);
  }

  // Process files
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];

    // Show progress for batch
    if (options.batch && filesToProcess.length > 1) {
      console.log('');
      log(`───── [${i + 1}/${filesToProcess.length}] ─────`, 'dim');
    }

    const result = await processFile(file, options, state);

    if (result.success) {
      if (options.skipPublished && !result.result) {
        skipCount++;
      } else {
        successCount++;
      }
    } else {
      failCount++;
    }

    // Save state after each successful publish
    if (result.success && !options.dryRun && result.result?.success) {
      savePublishedState(stateDirectory, state);
    }

    // Delay between batch items
    if (options.batch && i < filesToProcess.length - 1 && !options.dryRun) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }
  }

  // Summary
  console.log('');
  log('═══════════════════════════════════════════════════', 'cyan');
  log('  Summary', 'bright');
  log('═══════════════════════════════════════════════════', 'cyan');
  console.log('');

  if (successCount > 0) logSuccess(`${successCount} article(s) published`);
  if (skipCount > 0) logWarning(`${skipCount} article(s) skipped (already published)`);
  if (failCount > 0) logError(`${failCount} article(s) failed`);

  if (options.dryRun) {
    console.log('');
    logInfo('This was a dry run. No articles were actually published.');
  }

  console.log('');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  logError(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
