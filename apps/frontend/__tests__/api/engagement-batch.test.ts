import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPostLikes = vi.fn().mockResolvedValue(0);
const mockGetCommentCountForPost = vi.fn().mockResolvedValue(0);

vi.mock('@vauban/web3-utils', () => ({
  getPostLikes: (...args: unknown[]) => mockGetPostLikes(...args),
  getCommentCountForPost: (...args: unknown[]) => mockGetCommentCountForPost(...args),
  initStarknetProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/engagement/batch/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/engagement/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPostLikes.mockResolvedValue(0);
  mockGetCommentCountForPost.mockResolvedValue(0);
});

describe('POST /api/engagement/batch', () => {
  // ===== Happy paths =====

  it('returns engagement data for given post IDs', async () => {
    mockGetPostLikes.mockImplementation((postId: string) => {
      const likes: Record<string, number> = { 'p1': 10, 'p2': 5 };
      return Promise.resolve(likes[postId] ?? 0);
    });
    mockGetCommentCountForPost.mockImplementation((postId: string) => {
      const comments: Record<string, number> = { 'p1': 3, 'p2': 1 };
      return Promise.resolve(comments[postId] ?? 0);
    });

    const request = createRequest({ postIds: ['p1', 'p2'] });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      p1: { likes: 10, comments: 3 },
      p2: { likes: 5, comments: 1 },
    });
  });

  it('returns Cache-Control header', async () => {
    const request = createRequest({ postIds: ['p1'] });
    const response = await POST(request);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30');
  });

  it('returns empty object for empty postIds array', async () => {
    const request = createRequest({ postIds: [] });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({});
    expect(mockGetPostLikes).not.toHaveBeenCalled();
  });

  it('handles single post ID', async () => {
    mockGetPostLikes.mockResolvedValueOnce(42);
    mockGetCommentCountForPost.mockResolvedValueOnce(7);

    const request = createRequest({ postIds: ['solo'] });
    const response = await POST(request);
    const data = await response.json();

    expect(data).toEqual({
      solo: { likes: 42, comments: 7 },
    });
  });

  // ===== Validation =====

  it('returns 400 when body has no postIds', async () => {
    const request = createRequest({ foo: 'bar' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('postIds');
  });

  it('returns 400 when postIds is not an array', async () => {
    const request = createRequest({ postIds: 'not-an-array' });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when more than 100 post IDs', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `post-${i}`);
    const request = createRequest({ postIds: ids });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('100');
  });

  it('accepts exactly 100 post IDs', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `post-${i}`);
    const request = createRequest({ postIds: ids });
    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  // ===== Error resilience =====

  it('returns 0 for likes when getPostLikes fails for a post', async () => {
    mockGetPostLikes.mockRejectedValueOnce(new Error('RPC down'));
    mockGetCommentCountForPost.mockResolvedValueOnce(5);

    const request = createRequest({ postIds: ['fail-likes-post'] });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data['fail-likes-post']).toEqual({ likes: 0, comments: 5 });
  });

  it('returns 0 for comments when getCommentCountForPost fails', async () => {
    mockGetPostLikes.mockResolvedValueOnce(10);
    mockGetCommentCountForPost.mockRejectedValueOnce(new Error('RPC down'));

    const request = createRequest({ postIds: ['fail-comments-post'] });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data['fail-comments-post']).toEqual({ likes: 10, comments: 0 });
  });

  it('returns partial results when some posts fail entirely', async () => {
    // Use implementation that conditionally fails by post ID
    mockGetPostLikes.mockImplementation((postId: string) => {
      if (postId === 'good') return Promise.resolve(10);
      return Promise.reject(new Error('fail'));
    });
    mockGetCommentCountForPost.mockImplementation((postId: string) => {
      if (postId === 'good') return Promise.resolve(3);
      return Promise.reject(new Error('fail'));
    });

    const request = createRequest({ postIds: ['good', 'bad'] });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data['good']).toEqual({ likes: 10, comments: 3 });
    // 'bad' gets 0s from the allSettled handling
    expect(data['bad']).toEqual({ likes: 0, comments: 0 });
  });

  // ===== Parallel execution =====

  it('calls getPostLikes and getCommentCountForPost for each post ID', async () => {
    const ids = ['a', 'b', 'c'];
    const request = createRequest({ postIds: ids });
    await POST(request);

    expect(mockGetPostLikes).toHaveBeenCalledTimes(3);
    expect(mockGetCommentCountForPost).toHaveBeenCalledTimes(3);

    for (const id of ids) {
      expect(mockGetPostLikes).toHaveBeenCalledWith(id);
      expect(mockGetCommentCountForPost).toHaveBeenCalledWith(id);
    }
  });

  // ===== Caching =====

  it('caches results and reuses them on repeated calls', async () => {
    mockGetPostLikes.mockResolvedValue(10);
    mockGetCommentCountForPost.mockResolvedValue(2);

    // First call fetches from RPC
    const request1 = createRequest({ postIds: ['cached-post'] });
    const response1 = await POST(request1);
    const data1 = await response1.json();

    expect(data1['cached-post']).toEqual({ likes: 10, comments: 2 });
    expect(mockGetPostLikes).toHaveBeenCalledTimes(1);

    // Second call should use cache (within 30s TTL)
    vi.clearAllMocks();
    const request2 = createRequest({ postIds: ['cached-post'] });
    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(data2['cached-post']).toEqual({ likes: 10, comments: 2 });
    // Should NOT have called the RPC functions again
    expect(mockGetPostLikes).not.toHaveBeenCalled();
    expect(mockGetCommentCountForPost).not.toHaveBeenCalled();
  });
});
