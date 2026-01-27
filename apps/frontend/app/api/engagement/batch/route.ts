import { NextRequest, NextResponse } from 'next/server';
import { getPostLikes, getCommentCountForPost } from '@vauban/web3-utils';

export interface EngagementData {
  likes: number;
  comments: number;
}

export interface BatchEngagementResponse {
  [postId: string]: EngagementData;
}

// In-memory LRU cache with TTL (30s)
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 1000;

interface CacheEntry {
  data: EngagementData;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(postId: string): EngagementData | null {
  const entry = cache.get(postId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(postId);
    return null;
  }
  return entry.data;
}

function setCache(postId: string, data: EngagementData): void {
  // Evict oldest entries if over limit
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(postId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== 'object' ||
      !('postIds' in body) ||
      !Array.isArray((body as { postIds: unknown }).postIds)
    ) {
      return NextResponse.json(
        { error: 'Request body must include postIds array' },
        { status: 400 }
      );
    }

    const { postIds } = body as { postIds: string[] };

    if (postIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 post IDs per request' },
        { status: 400 }
      );
    }

    const result: BatchEngagementResponse = {};

    // Separate cached vs uncached
    const uncachedIds: string[] = [];
    for (const id of postIds) {
      const cached = getCached(id);
      if (cached) {
        result[id] = cached;
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached in parallel with allSettled for resilience
    if (uncachedIds.length > 0) {
      const fetches = uncachedIds.map(async (postId) => {
        const [likes, comments] = await Promise.allSettled([
          getPostLikes(postId),
          getCommentCountForPost(postId),
        ]);
        const data: EngagementData = {
          likes: likes.status === 'fulfilled' ? likes.value : 0,
          comments: comments.status === 'fulfilled' ? comments.value : 0,
        };
        setCache(postId, data);
        return { postId, data };
      });

      const results = await Promise.allSettled(fetches);
      for (const r of results) {
        if (r.status === 'fulfilled') {
          result[r.value.postId] = r.value.data;
        }
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error) {
    console.error('Engagement batch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement data' },
      { status: 500 }
    );
  }
}
