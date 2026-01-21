import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// This endpoint is called by a cron job to publish scheduled posts
// Vercel Cron: Add to vercel.json with cron expression
// External: Call via HTTP GET with CRON_SECRET header

const DATA_DIR = process.env.DATA_DIR || '/tmp/vauban-scheduled';
const SCHEDULED_FILE = path.join(DATA_DIR, 'scheduled-posts.json');
const CRON_SECRET = process.env.CRON_SECRET;
const M2M_API_KEY = process.env.M2M_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005';

interface ScheduledPost {
  id: string;
  scheduledAt: string;
  createdAt: string;
  authorAddress: string;
  postData: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    tags: string[];
    coverImage?: string;
    isPaid: boolean;
    price: number;
    isEncrypted: boolean;
  };
  status: 'pending' | 'published' | 'failed';
  error?: string;
  publishedAt?: string;
}

async function readScheduledPosts(): Promise<ScheduledPost[]> {
  try {
    const data = await fs.readFile(SCHEDULED_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeScheduledPosts(posts: ScheduledPost[]): Promise<void> {
  await fs.writeFile(SCHEDULED_FILE, JSON.stringify(posts, null, 2));
}

async function publishPost(post: ScheduledPost): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    // Use M2M API to publish
    const response = await fetch(`${BASE_URL}/api/m2m/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': M2M_API_KEY || '',
      },
      body: JSON.stringify({
        title: post.postData.title,
        slug: post.postData.slug,
        content: post.postData.content,
        excerpt: post.postData.excerpt,
        tags: post.postData.tags,
        coverImage: post.postData.coverImage,
        // Note: isPaid and price would need M2M API extension
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      txHash: result.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret (skip in development)
  if (process.env.NODE_ENV === 'production' && CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!M2M_API_KEY) {
    return NextResponse.json(
      { error: 'M2M_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const posts = await readScheduledPosts();
    const now = Date.now();
    const results: Array<{ id: string; status: string; error?: string }> = [];

    let hasChanges = false;

    for (const post of posts) {
      // Skip non-pending posts
      if (post.status !== 'pending') continue;

      const scheduledTime = new Date(post.scheduledAt).getTime();

      // Check if it's time to publish
      if (scheduledTime <= now) {
        console.log(`Publishing scheduled post: ${post.postData.title} (ID: ${post.id})`);

        const result = await publishPost(post);

        if (result.success) {
          post.status = 'published';
          post.publishedAt = new Date().toISOString();
          results.push({ id: post.id, status: 'published' });
          console.log(`Successfully published: ${post.postData.title}`);
        } else {
          post.status = 'failed';
          post.error = result.error;
          results.push({ id: post.id, status: 'failed', error: result.error });
          console.error(`Failed to publish: ${post.postData.title} - ${result.error}`);
        }

        hasChanges = true;
      }
    }

    // Save changes
    if (hasChanges) {
      await writeScheduledPosts(posts);
    }

    // Get counts
    const pending = posts.filter(p => p.status === 'pending').length;
    const published = results.filter(r => r.status === 'published').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      published,
      failed,
      pendingRemaining: pending,
      results,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled posts' },
      { status: 500 }
    );
  }
}
