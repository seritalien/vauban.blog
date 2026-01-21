import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Server-side storage for scheduled posts
// In production, use a proper database
const DATA_DIR = process.env.DATA_DIR || '/tmp/vauban-scheduled';
const SCHEDULED_FILE = path.join(DATA_DIR, 'scheduled-posts.json');

export interface ScheduledPost {
  id: string;
  scheduledAt: string; // ISO date
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

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

async function readScheduledPosts(): Promise<ScheduledPost[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(SCHEDULED_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeScheduledPosts(posts: ScheduledPost[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SCHEDULED_FILE, JSON.stringify(posts, null, 2));
}

// GET - List scheduled posts (optionally filter by author)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorAddress = searchParams.get('author');
    const status = searchParams.get('status');

    let posts = await readScheduledPosts();

    if (authorAddress) {
      posts = posts.filter(p => p.authorAddress.toLowerCase() === authorAddress.toLowerCase());
    }
    if (status) {
      posts = posts.filter(p => p.status === status);
    }

    // Sort by scheduledAt ascending
    posts.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Failed to read scheduled posts:', error);
    return NextResponse.json(
      { error: 'Failed to read scheduled posts' },
      { status: 500 }
    );
  }
}

// POST - Schedule a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduledAt, authorAddress, postData } = body;

    // Validate required fields
    if (!scheduledAt || !authorAddress || !postData) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduledAt, authorAddress, postData' },
        { status: 400 }
      );
    }

    // Validate scheduledAt is in the future
    const scheduledTime = new Date(scheduledAt).getTime();
    if (scheduledTime <= Date.now()) {
      return NextResponse.json(
        { error: 'scheduledAt must be in the future' },
        { status: 400 }
      );
    }

    const posts = await readScheduledPosts();

    const newPost: ScheduledPost = {
      id: randomUUID(),
      scheduledAt,
      createdAt: new Date().toISOString(),
      authorAddress,
      postData,
      status: 'pending',
    };

    posts.push(newPost);
    await writeScheduledPosts(posts);

    return NextResponse.json({
      success: true,
      post: newPost,
      message: `Post scheduled for ${new Date(scheduledAt).toLocaleString()}`
    });
  } catch (error) {
    console.error('Failed to schedule post:', error);
    return NextResponse.json(
      { error: 'Failed to schedule post' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a scheduled post
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing post id' },
        { status: 400 }
      );
    }

    const posts = await readScheduledPosts();
    const postIndex = posts.findIndex(p => p.id === id);

    if (postIndex === -1) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    if (posts[postIndex].status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending posts' },
        { status: 400 }
      );
    }

    posts.splice(postIndex, 1);
    await writeScheduledPosts(posts);

    return NextResponse.json({ success: true, message: 'Scheduled post cancelled' });
  } catch (error) {
    console.error('Failed to cancel scheduled post:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled post' },
      { status: 500 }
    );
  }
}
