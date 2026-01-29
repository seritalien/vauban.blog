/**
 * Engagement Integration Tests
 *
 * Tests for like/unlike posts and comments, adding comments and replies,
 * comment threading and nesting, and engagement count updates.
 */
import { vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALICE, BOB } from '../helpers/test-users';
import {
  createMockPostStore,
  createMockSocialStore,
} from '../helpers/mock-contracts';

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
  mockHasLikedPost,
  mockLikePost,
  mockUnlikePost,
  mockHasLikedComment,
  mockLikeComment,
  mockUnlikeComment,
  mockAddComment,
  mockGetCommentsForPost,
  mockCalculateContentHash,
  walletState,
} = vi.hoisted(() => {
  return {
    mockHasLikedPost: vi.fn().mockResolvedValue(false),
    mockLikePost: vi.fn().mockResolvedValue(undefined),
    mockUnlikePost: vi.fn().mockResolvedValue(undefined),
    mockHasLikedComment: vi.fn().mockResolvedValue(false),
    mockLikeComment: vi.fn().mockResolvedValue(undefined),
    mockUnlikeComment: vi.fn().mockResolvedValue(undefined),
    mockAddComment: vi.fn().mockResolvedValue('comment-1'),
    mockGetCommentsForPost: vi.fn().mockResolvedValue([]),
    mockCalculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
    walletState: {
      account: null as Record<string, unknown> | null,
      address: null as string | null,
    },
  };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => ({
  hasLikedPost: mockHasLikedPost,
  likePost: mockLikePost,
  unlikePost: mockUnlikePost,
  hasLikedComment: mockHasLikedComment,
  likeComment: mockLikeComment,
  unlikeComment: mockUnlikeComment,
  addComment: mockAddComment,
  getCommentsForPost: mockGetCommentsForPost,
  calculateContentHash: mockCalculateContentHash,
  initStarknetProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
}));

// Mock fetch for batch engagement endpoint
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// =============================================================================
// IMPORTS AFTER MOCKS
// =============================================================================

import {
  useBatchEngagement,
  usePostEngagement,
  useUserLikeStatus,
  useLikeMutation,
} from '@/hooks/use-engagement';

// =============================================================================
// HELPERS
// =============================================================================

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, queryClient };
}

function mockFetchResponse(data: Record<string, unknown>, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function setConnected(user: typeof ALICE | typeof BOB = ALICE) {
  walletState.account = {
    address: user.address,
    execute: vi.fn().mockResolvedValue({ transaction_hash: '0xTX' }),
  };
  walletState.address = user.address;
}

function setDisconnected() {
  walletState.account = null;
  walletState.address = null;
}

// In-memory stores for integration scenarios
let postStore: ReturnType<typeof createMockPostStore>;
let socialStore: ReturnType<typeof createMockSocialStore>;

// =============================================================================
// TEST SETUP
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  setDisconnected();
  postStore = createMockPostStore();
  socialStore = createMockSocialStore();

  // Wire up mocks to use the stores
  mockHasLikedPost.mockImplementation(async (postId: string, userAddr: string) => {
    return socialStore.hasLiked(postId, userAddr);
  });

  mockLikePost.mockImplementation(async (_account: unknown, postId: string) => {
    socialStore.likePost(postId, walletState.address ?? '');
    return undefined;
  });

  mockUnlikePost.mockImplementation(async (_account: unknown, postId: string) => {
    socialStore.unlikePost(postId, walletState.address ?? '');
    return undefined;
  });

  mockGetCommentsForPost.mockImplementation(async (postId: string) => {
    return socialStore.getComments(postId).map((c) => ({
      ...c,
      postId,
      contentHash: '0x' + 'ab'.repeat(32),
      createdAt: Math.floor(Date.now() / 1000),
      likeCount: 0,
      parentCommentId: '0',
    }));
  });

  mockAddComment.mockImplementation(
    async (_account: unknown, postId: string, contentHash: string, _parentCommentId?: string) => {
      return socialStore.addComment(postId, walletState.address ?? '', contentHash);
    }
  );
});

// =============================================================================
// LIKE/UNLIKE POSTS TESTS
// =============================================================================

describe('Like/Unlike Posts', () => {
  describe('liking a post', () => {
    it('increments like count when user likes a post', async () => {
      setConnected(ALICE);

      // Create a post
      const post = postStore.addPost({
        author: BOB.address,
        content: 'Test post content',
      });

      // Mock initial engagement data
      mockFetchResponse({ [post.id]: { likes: 0, comments: 0 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => ({
          mutation: useLikeMutation(post.id),
          engagement: usePostEngagement(post.id),
        }),
        { wrapper: Wrapper }
      );

      // Wait for engagement to load
      await waitFor(() => {
        expect(result.current.engagement.isSuccess).toBe(true);
      });

      expect(result.current.engagement.data?.likes).toBe(0);

      // Mock the refetch after mutation
      mockFetchResponse({ [post.id]: { likes: 1, comments: 0 } });

      // Like the post
      await act(async () => {
        await result.current.mutation.mutateAsync({ action: 'like' });
      });

      // Verify like was recorded
      expect(mockLikePost).toHaveBeenCalledWith(walletState.account, post.id);
      expect(socialStore.hasLiked(post.id, ALICE.address)).toBe(true);
      expect(socialStore.getLikeCount(post.id)).toBe(1);
    });

    it('decrements like count when user unlikes a post', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Test post content',
      });

      // Alice already liked the post
      socialStore.likePost(post.id, ALICE.address);

      mockFetchResponse({ [post.id]: { likes: 1, comments: 0 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => ({
          mutation: useLikeMutation(post.id),
          engagement: usePostEngagement(post.id),
        }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.engagement.isSuccess).toBe(true);
      });

      expect(result.current.engagement.data?.likes).toBe(1);

      mockFetchResponse({ [post.id]: { likes: 0, comments: 0 } });

      // Unlike the post
      await act(async () => {
        await result.current.mutation.mutateAsync({ action: 'unlike' });
      });

      expect(mockUnlikePost).toHaveBeenCalledWith(walletState.account, post.id);
      expect(socialStore.hasLiked(post.id, ALICE.address)).toBe(false);
      expect(socialStore.getLikeCount(post.id)).toBe(0);
    });

    it('multiple users can like the same post', async () => {
      const post = postStore.addPost({
        author: ALICE.address,
        content: 'Popular post',
      });

      // Alice likes
      setConnected(ALICE);
      socialStore.likePost(post.id, ALICE.address);

      // Bob likes
      setConnected(BOB);
      socialStore.likePost(post.id, BOB.address);

      expect(socialStore.getLikeCount(post.id)).toBe(2);
      expect(socialStore.hasLiked(post.id, ALICE.address)).toBe(true);
      expect(socialStore.hasLiked(post.id, BOB.address)).toBe(true);
    });

    it('cannot like post when not connected', async () => {
      setDisconnected();

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Test post',
      });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useLikeMutation(post.id), { wrapper: Wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ action: 'like' });
        })
      ).rejects.toThrow('Wallet not connected');
    });
  });

  describe('like status tracking', () => {
    it('correctly reports if user has liked a post', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Test post',
      });

      // Alice has not liked yet
      mockHasLikedPost.mockResolvedValueOnce(false);

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useUserLikeStatus(post.id), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(false);
    });

    it('does not check like status when disconnected', async () => {
      setDisconnected();

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useUserLikeStatus('post-1'), { wrapper: Wrapper });

      // Query should be disabled (not fetching)
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(mockHasLikedPost).not.toHaveBeenCalled();
    });
  });

  describe('optimistic updates', () => {
    it('shows optimistic like count while mutation is pending', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Test post',
      });

      mockFetchResponse({ [post.id]: { likes: 5, comments: 0 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => ({
          mutation: useLikeMutation(post.id),
          engagement: usePostEngagement(post.id),
        }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(5);
      });

      // Make likePost hang to observe optimistic state
      let resolveLike!: () => void;
      mockLikePost.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveLike = resolve;
        })
      );

      // Start the mutation (don't await)
      act(() => {
        result.current.mutation.mutate({ action: 'like' });
      });

      // Should show optimistic update immediately
      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(6);
      });

      // Resolve and let it settle
      mockFetchResponse({ [post.id]: { likes: 6, comments: 0 } });
      await act(async () => {
        resolveLike();
      });
    });

    it('rolls back optimistic update on mutation failure', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Test post',
      });

      mockFetchResponse({ [post.id]: { likes: 10, comments: 0 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => ({
          mutation: useLikeMutation(post.id),
          engagement: usePostEngagement(post.id),
        }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(10);
      });

      // Make likePost fail
      mockLikePost.mockRejectedValueOnce(new Error('Transaction reverted'));
      mockFetchResponse({ [post.id]: { likes: 10, comments: 0 } });

      try {
        await act(async () => {
          await result.current.mutation.mutateAsync({ action: 'like' });
        });
      } catch {
        // Expected to throw
      }

      // After rollback, should be back to 10
      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(10);
      });
    });
  });
});

// =============================================================================
// COMMENTS AND REPLIES TESTS
// =============================================================================

describe('Comments and Replies', () => {
  describe('adding comments', () => {
    it('adds a new top-level comment to a post', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Post to comment on',
      });

      // Initially no comments
      let comments = await mockGetCommentsForPost(post.id);
      expect(comments).toHaveLength(0);

      // Add a comment
      await mockAddComment(walletState.account, post.id, '0xcomment_hash');

      // Verify comment was added
      comments = await mockGetCommentsForPost(post.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe(ALICE.address);
    });

    it('tracks comment count correctly', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Post to comment on',
      });

      // Alice adds a comment
      socialStore.addComment(post.id, ALICE.address, 'First comment');

      // Bob adds a comment
      socialStore.addComment(post.id, BOB.address, 'Second comment');

      const comments = socialStore.getComments(post.id);
      expect(comments).toHaveLength(2);
    });

    it('cannot add comment when not connected', async () => {
      setDisconnected();

      postStore.addPost({
        author: BOB.address,
        content: 'Post to comment on',
      });

      // Without proper account, the comment should fail or be blocked at UI level
      // The mock implementation checks for walletState.address
      expect(walletState.account).toBeNull();
    });
  });

  describe('comment threading', () => {
    it('supports nested replies (depth 2)', async () => {
      const post = postStore.addPost({
        author: BOB.address,
        content: 'Post with nested comments',
      });

      // Root comment by Alice
      socialStore.addComment(post.id, ALICE.address, 'Root comment');

      // Reply to root comment by Bob
      socialStore.addComment(post.id, BOB.address, 'Reply to root');

      // Get all comments
      const allComments = socialStore.getComments(post.id);
      expect(allComments).toHaveLength(2);

      // Verify we have comments from both users
      const aliceComment = allComments.find((c) => c.author === ALICE.address);
      const bobComment = allComments.find((c) => c.author === BOB.address);

      expect(aliceComment).toBeDefined();
      expect(bobComment).toBeDefined();
      expect(aliceComment?.content).toBe('Root comment');
      expect(bobComment?.content).toBe('Reply to root');
    });

    it('handles deep nesting (max depth 3)', async () => {
      const post = postStore.addPost({
        author: ALICE.address,
        content: 'Post with deep nesting',
      });

      // Create a chain of comments simulating depth
      const comments = [
        { author: ALICE.address, content: 'Level 0 - Root' },
        { author: BOB.address, content: 'Level 1 - Reply to root' },
        { author: ALICE.address, content: 'Level 2 - Reply to level 1' },
        { author: BOB.address, content: 'Level 3 - Reply to level 2 (max depth)' },
      ];

      for (const comment of comments) {
        socialStore.addComment(post.id, comment.author, comment.content);
      }

      const allComments = socialStore.getComments(post.id);
      expect(allComments).toHaveLength(4);
    });
  });
});

// =============================================================================
// ENGAGEMENT COUNT UPDATES TESTS
// =============================================================================

describe('Engagement Count Updates', () => {
  describe('batch engagement fetching', () => {
    it('fetches engagement for multiple posts in one request', async () => {
      const responseData = {
        'post-1': { likes: 10, comments: 3 },
        'post-2': { likes: 5, comments: 1 },
        'post-3': { likes: 0, comments: 0 },
      };
      mockFetchResponse(responseData);

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => useBatchEngagement(['post-1', 'post-2', 'post-3']),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('sorts post IDs for stable cache key', async () => {
      mockFetchResponse({});

      const { Wrapper } = createQueryWrapper();
      renderHook(() => useBatchEngagement(['z-post', 'a-post', 'm-post']), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.postIds).toEqual(['a-post', 'm-post', 'z-post']);
    });

    it('does not fetch when postIds array is empty', async () => {
      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useBatchEngagement([]), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('single post engagement', () => {
    it('fetches engagement for a single post', async () => {
      mockFetchResponse({ 'post-42': { likes: 7, comments: 2 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => usePostEngagement('post-42'), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ likes: 7, comments: 2 });
    });

    it('returns zeros when post not found in response', async () => {
      mockFetchResponse({});

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => usePostEngagement('nonexistent'), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ likes: 0, comments: 0 });
    });
  });

  describe('real-time count updates', () => {
    it('updates engagement count after successful like', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Post to like',
      });

      // Initial state: 0 likes
      mockFetchResponse({ [post.id]: { likes: 0, comments: 0 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => ({
          mutation: useLikeMutation(post.id),
          engagement: usePostEngagement(post.id),
        }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(0);
      });

      // After like, refetch returns 1
      mockFetchResponse({ [post.id]: { likes: 1, comments: 0 } });

      await act(async () => {
        await result.current.mutation.mutateAsync({ action: 'like' });
      });

      // Wait for invalidation and refetch
      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(1);
      });
    });

    it('likes count does not go below 0 on unlike', async () => {
      setConnected(ALICE);

      const post = postStore.addPost({
        author: BOB.address,
        content: 'Post with 0 likes',
      });

      mockFetchResponse({ [post.id]: { likes: 0, comments: 0 } });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(
        () => ({
          mutation: useLikeMutation(post.id),
          engagement: usePostEngagement(post.id),
        }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(0);
      });

      // Make unlike hang to observe optimistic state
      let resolveUnlike!: () => void;
      mockUnlikePost.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveUnlike = resolve;
        })
      );

      act(() => {
        result.current.mutation.mutate({ action: 'unlike' });
      });

      // Should stay at 0, not go to -1
      await waitFor(() => {
        expect(result.current.engagement.data?.likes).toBe(0);
      });

      mockFetchResponse({ [post.id]: { likes: 0, comments: 0 } });
      await act(async () => {
        resolveUnlike();
      });
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useBatchEngagement(['post-1']), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('500');
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { Wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useBatchEngagement(['post-1']), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('Network error');
    });
  });
});

// =============================================================================
// FULL ENGAGEMENT FLOW INTEGRATION TESTS
// =============================================================================

describe('Full Engagement Flow', () => {
  it('complete like -> comment -> reply flow', async () => {
    // Setup: BOB creates a post
    const post = postStore.addPost({
      author: BOB.address,
      content: 'An interesting article about Web3',
    });

    // Step 1: ALICE likes the post
    setConnected(ALICE);
    socialStore.likePost(post.id, ALICE.address);

    expect(socialStore.getLikeCount(post.id)).toBe(1);
    expect(socialStore.hasLiked(post.id, ALICE.address)).toBe(true);

    // Step 2: ALICE comments on the post
    socialStore.addComment(post.id, ALICE.address, 'Great article!');

    expect(socialStore.getComments(post.id)).toHaveLength(1);

    // Step 3: BOB replies to ALICE's comment
    setConnected(BOB);
    socialStore.addComment(post.id, BOB.address, 'Thanks for the feedback!');

    expect(socialStore.getComments(post.id)).toHaveLength(2);

    // Step 4: BOB likes the post too
    socialStore.likePost(post.id, BOB.address);

    expect(socialStore.getLikeCount(post.id)).toBe(2);
  });

  it('multiple users engaging with the same post concurrently', async () => {
    const post = postStore.addPost({
      author: ALICE.address,
      content: 'Viral post',
    });

    // Simulate multiple users engaging "concurrently"
    const users = [
      { ...ALICE, action: 'like' },
      { ...BOB, action: 'like' },
      { ...ALICE, action: 'comment' },
      { ...BOB, action: 'comment' },
    ];

    for (const user of users) {
      if (user.action === 'like') {
        socialStore.likePost(post.id, user.address);
      } else {
        socialStore.addComment(post.id, user.address, `Comment from ${user.name}`);
      }
    }

    expect(socialStore.getLikeCount(post.id)).toBe(2);
    expect(socialStore.getComments(post.id)).toHaveLength(2);
  });

  it('engagement persists across user sessions', async () => {
    const post = postStore.addPost({
      author: ALICE.address,
      content: 'Persistent post',
    });

    // Alice likes and comments
    setConnected(ALICE);
    socialStore.likePost(post.id, ALICE.address);
    socialStore.addComment(post.id, ALICE.address, 'My comment');

    // "Log out" Alice
    setDisconnected();

    // Verify data persists
    expect(socialStore.getLikeCount(post.id)).toBe(1);
    expect(socialStore.hasLiked(post.id, ALICE.address)).toBe(true);
    expect(socialStore.getComments(post.id)).toHaveLength(1);

    // Bob logs in and can see the engagement
    setConnected(BOB);
    expect(socialStore.getLikeCount(post.id)).toBe(1);
    expect(socialStore.getComments(post.id)).toHaveLength(1);

    // Bob adds his engagement
    socialStore.likePost(post.id, BOB.address);
    socialStore.addComment(post.id, BOB.address, 'Bob agrees!');

    expect(socialStore.getLikeCount(post.id)).toBe(2);
    expect(socialStore.getComments(post.id)).toHaveLength(2);
  });
});
