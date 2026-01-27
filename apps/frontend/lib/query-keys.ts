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
} as const;
