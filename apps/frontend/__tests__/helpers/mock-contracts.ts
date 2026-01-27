/**
 * Mock Contracts
 *
 * In-memory contract state simulators for testing web3 interactions.
 */
import { vi } from 'vitest';

// =============================================================================
// WEB3-UTILS MOCK FACTORY
// =============================================================================

export function mockWeb3Utils() {
  return {
    // Provider
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    checkRPCConnection: vi.fn().mockResolvedValue(true),
    getBlockNumber: vi.fn().mockResolvedValue(100),

    // Blog Registry
    publishPost: vi.fn().mockResolvedValue('post-1'),
    publishPostExtended: vi.fn().mockResolvedValue('post-1'),
    publishTweet: vi.fn().mockResolvedValue('tweet-1'),
    publishReply: vi.fn().mockResolvedValue('reply-1'),
    startThread: vi.fn().mockResolvedValue('thread-root-1'),
    continueThread: vi.fn().mockResolvedValue('thread-cont-1'),
    getPost: vi.fn().mockResolvedValue({
      id: '1',
      author: '0x123',
      arweaveTxId: 'ar_tx1',
      ipfsCid: 'QmTest1',
      contentHash: '0x' + 'ab'.repeat(32),
      price: '0',
      isEncrypted: false,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      isDeleted: false,
      postType: 0,
    }),
    getPosts: vi.fn().mockResolvedValue([]),
    getPostCount: vi.fn().mockResolvedValue(0),
    deletePost: vi.fn().mockResolvedValue(true),
    updatePost: vi.fn().mockResolvedValue(true),
    pinPost: vi.fn().mockResolvedValue(true),
    unpinPost: vi.fn().mockResolvedValue(true),
    purchasePost: vi.fn().mockResolvedValue(true),
    getPublishCooldown: vi.fn().mockResolvedValue(5),

    // Social
    addComment: vi.fn().mockResolvedValue('comment-1'),
    getCommentsForPost: vi.fn().mockResolvedValue([]),
    getCommentCountForPost: vi.fn().mockResolvedValue(0),
    likePost: vi.fn().mockResolvedValue(true),
    unlikePost: vi.fn().mockResolvedValue(true),
    hasLikedPost: vi.fn().mockResolvedValue(false),
    getPostLikes: vi.fn().mockResolvedValue(0),

    // Content
    calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),

    // Roles
    getUserRole: vi.fn().mockResolvedValue(0),
    grantRole: vi.fn().mockResolvedValue(true),
    revokeRole: vi.fn().mockResolvedValue(true),

    // Reputation
    getUserReputation: vi.fn().mockResolvedValue({ score: 0, badges: 0, level: 0 }),
    parseBadges: vi.fn().mockReturnValue([]),

    // Address utilities
    isValidStarknetAddress: vi.fn().mockReturnValue(true),
    formatAddress: vi.fn((addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4)),
    splitString: vi.fn((s: string) => [s]),
    joinFelt252Parts: vi.fn((parts: string[]) => parts.join('')),
    safeDecodeShortString: vi.fn((s: string) => s),

    // ABIs
    followsAbi: [],
  };
}

// =============================================================================
// IN-MEMORY POST STORE
// =============================================================================

export interface MockPost {
  id: string;
  author: string;
  content: string;
  ipfsCid: string;
  arweaveTxId: string;
  contentHash: string;
  postType: number;
  parentId?: string;
  threadRootId?: string;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export function createMockPostStore() {
  const posts = new Map<string, MockPost>();
  let nextId = 1;

  return {
    posts,
    addPost(data: Partial<MockPost> & { author: string; content: string }): MockPost {
      const id = String(nextId++);
      const post: MockPost = {
        id,
        author: data.author,
        content: data.content,
        ipfsCid: data.ipfsCid ?? `QmMock${id}`,
        arweaveTxId: data.arweaveTxId ?? `ar_mock_${id}`,
        contentHash: data.contentHash ?? '0x' + 'ab'.repeat(32),
        postType: data.postType ?? 0,
        parentId: data.parentId,
        threadRootId: data.threadRootId,
        isPinned: data.isPinned ?? false,
        isDeleted: data.isDeleted ?? false,
        createdAt: data.createdAt ?? Math.floor(Date.now() / 1000),
        updatedAt: data.updatedAt ?? Math.floor(Date.now() / 1000),
      };
      posts.set(id, post);
      return post;
    },
    getPost(id: string): MockPost | undefined {
      return posts.get(id);
    },
    getPosts(limit: number, offset: number): MockPost[] {
      const all = Array.from(posts.values()).filter((p) => !p.isDeleted);
      return all.slice(offset, offset + limit);
    },
    deletePost(id: string): boolean {
      const post = posts.get(id);
      if (!post) return false;
      post.isDeleted = true;
      return true;
    },
    clear() {
      posts.clear();
      nextId = 1;
    },
  };
}

// =============================================================================
// IN-MEMORY SOCIAL STORE
// =============================================================================

export function createMockSocialStore() {
  const likes = new Map<string, Set<string>>(); // postId -> Set<userAddress>
  const comments = new Map<string, Array<{ id: string; author: string; content: string; isDeleted: boolean }>>();

  return {
    likePost(postId: string, userAddress: string) {
      if (!likes.has(postId)) likes.set(postId, new Set());
      likes.get(postId)!.add(userAddress);
    },
    unlikePost(postId: string, userAddress: string) {
      likes.get(postId)?.delete(userAddress);
    },
    hasLiked(postId: string, userAddress: string): boolean {
      return likes.get(postId)?.has(userAddress) ?? false;
    },
    getLikeCount(postId: string): number {
      return likes.get(postId)?.size ?? 0;
    },
    addComment(postId: string, author: string, content: string): string {
      if (!comments.has(postId)) comments.set(postId, []);
      const id = `comment-${Date.now()}`;
      comments.get(postId)!.push({ id, author, content, isDeleted: false });
      return id;
    },
    getComments(postId: string) {
      return comments.get(postId) ?? [];
    },
    clear() {
      likes.clear();
      comments.clear();
    },
  };
}

// =============================================================================
// IN-MEMORY FOLLOW STORE
// =============================================================================

export function createMockFollowStore() {
  const following = new Map<string, Set<string>>(); // user -> Set<followed>

  return {
    follow(follower: string, target: string) {
      if (!following.has(follower)) following.set(follower, new Set());
      following.get(follower)!.add(target);
    },
    unfollow(follower: string, target: string) {
      following.get(follower)?.delete(target);
    },
    isFollowing(follower: string, target: string): boolean {
      return following.get(follower)?.has(target) ?? false;
    },
    getFollowerCount(user: string): number {
      let count = 0;
      for (const [, targets] of following) {
        if (targets.has(user)) count++;
      }
      return count;
    },
    getFollowingCount(user: string): number {
      return following.get(user)?.size ?? 0;
    },
    getFollowers(user: string): string[] {
      const followers: string[] = [];
      for (const [follower, targets] of following) {
        if (targets.has(user)) followers.push(follower);
      }
      return followers;
    },
    getFollowing(user: string): string[] {
      return Array.from(following.get(user) ?? []);
    },
    clear() {
      following.clear();
    },
  };
}
