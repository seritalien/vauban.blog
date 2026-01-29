/**
 * React Query cache key hierarchy for granular invalidation.
 *
 * Convention: each factory returns a readonly tuple so TypeScript
 * can narrow queryKey types through the hierarchy.
 */

export const queryKeys = {
  posts: {
    all: ['posts'] as const,
    infinite: (limit: number) => ['posts', 'infinite', limit] as const,
    detail: (id: string) => ['posts', 'detail', id] as const,
  },
  engagement: {
    all: ['engagement'] as const,
    batch: (postIds: string[]) => ['engagement', 'batch', postIds] as const,
    single: (postId: string) => ['engagement', 'single', postId] as const,
    userLike: (postId: string, userAddress: string) =>
      ['engagement', 'userLike', postId, userAddress] as const,
  },
  follow: {
    all: ['follow'] as const,
    stats: (address: string) => ['follow', 'stats', address] as const,
    isFollowing: (userAddress: string, targetAddress: string) =>
      ['follow', 'isFollowing', userAddress, targetAddress] as const,
    list: (address: string) => ['follow', 'list', address] as const,
  },
  comments: {
    all: ['comments'] as const,
    forPost: (postId: string) => ['comments', 'forPost', postId] as const,
  },
  author: {
    all: ['author'] as const,
    stats: (address: string) => ['author', 'stats', address] as const,
  },
  role: {
    all: ['role'] as const,
    user: (address: string) => ['role', 'user', address] as const,
  },
  sessionKey: {
    all: ['sessionKey'] as const,
    status: (address: string) => ['sessionKey', 'status', address] as const,
  },
  admin: {
    all: ['admin'] as const,
    pendingReview: ['admin', 'pendingReview'] as const,
    moderationReports: ['admin', 'moderationReports'] as const,
    bannedUsers: ['admin', 'bannedUsers'] as const,
  },
  reputation: {
    all: ['reputation'] as const,
    user: (address: string) => ['reputation', 'user', address] as const,
    badges: (address: string) => ['reputation', 'badges', address] as const,
  },
  treasury: {
    all: ['treasury'] as const,
    earnings: (address: string) => ['treasury', 'earnings', address] as const,
    config: ['treasury', 'config'] as const,
    revenue: ['treasury', 'revenue'] as const,
  },
  messaging: {
    all: ['messaging'] as const,
    conversations: ['messaging', 'conversations'] as const,
    unread: ['messaging', 'unread'] as const,
  },
} as const;
