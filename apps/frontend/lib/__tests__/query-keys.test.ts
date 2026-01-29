import { describe, it, expect } from 'vitest';
import { queryKeys } from '../query-keys';

// =============================================================================
// Posts Keys
// =============================================================================

describe('queryKeys.posts', () => {
  it('all returns ["posts"]', () => {
    expect(queryKeys.posts.all).toEqual(['posts']);
  });

  it('infinite(limit) returns ["posts", "infinite", limit]', () => {
    expect(queryKeys.posts.infinite(10)).toEqual(['posts', 'infinite', 10]);
  });

  it('detail(id) returns ["posts", "detail", id]', () => {
    expect(queryKeys.posts.detail('abc')).toEqual(['posts', 'detail', 'abc']);
  });
});

// =============================================================================
// Engagement Keys
// =============================================================================

describe('queryKeys.engagement', () => {
  it('all returns ["engagement"]', () => {
    expect(queryKeys.engagement.all).toEqual(['engagement']);
  });

  it('batch(postIds) returns ["engagement", "batch", postIds]', () => {
    expect(queryKeys.engagement.batch(['1', '2'])).toEqual([
      'engagement',
      'batch',
      ['1', '2'],
    ]);
  });

  it('single(postId) returns ["engagement", "single", postId]', () => {
    expect(queryKeys.engagement.single('1')).toEqual([
      'engagement',
      'single',
      '1',
    ]);
  });

  it('userLike(postId, userAddress) returns ["engagement", "userLike", postId, userAddress]', () => {
    expect(queryKeys.engagement.userLike('p1', 'u1')).toEqual([
      'engagement',
      'userLike',
      'p1',
      'u1',
    ]);
  });
});

// =============================================================================
// Follow Keys
// =============================================================================

describe('queryKeys.follow', () => {
  it('all returns ["follow"]', () => {
    expect(queryKeys.follow.all).toEqual(['follow']);
  });

  it('stats(address) returns ["follow", "stats", address]', () => {
    expect(queryKeys.follow.stats('addr')).toEqual([
      'follow',
      'stats',
      'addr',
    ]);
  });

  it('isFollowing(userAddress, targetAddress) returns ["follow", "isFollowing", userAddress, targetAddress]', () => {
    expect(queryKeys.follow.isFollowing('u1', 't1')).toEqual([
      'follow',
      'isFollowing',
      'u1',
      't1',
    ]);
  });

  it('list(address) returns ["follow", "list", address]', () => {
    expect(queryKeys.follow.list('addr')).toEqual([
      'follow',
      'list',
      'addr',
    ]);
  });
});

// =============================================================================
// Comments Keys
// =============================================================================

describe('queryKeys.comments', () => {
  it('all returns ["comments"]', () => {
    expect(queryKeys.comments.all).toEqual(['comments']);
  });

  it('forPost(postId) returns ["comments", "forPost", postId]', () => {
    expect(queryKeys.comments.forPost('p1')).toEqual([
      'comments',
      'forPost',
      'p1',
    ]);
  });
});

// =============================================================================
// Author Keys
// =============================================================================

describe('queryKeys.author', () => {
  it('all returns ["author"]', () => {
    expect(queryKeys.author.all).toEqual(['author']);
  });

  it('stats(address) returns ["author", "stats", address]', () => {
    expect(queryKeys.author.stats('addr')).toEqual([
      'author',
      'stats',
      'addr',
    ]);
  });
});

// =============================================================================
// Role Keys
// =============================================================================

describe('queryKeys.role', () => {
  it('all returns ["role"]', () => {
    expect(queryKeys.role.all).toEqual(['role']);
  });

  it('user(address) returns ["role", "user", address]', () => {
    expect(queryKeys.role.user('addr')).toEqual(['role', 'user', 'addr']);
  });
});

// =============================================================================
// Session Key Keys
// =============================================================================

describe('queryKeys.sessionKey', () => {
  it('all returns ["sessionKey"]', () => {
    expect(queryKeys.sessionKey.all).toEqual(['sessionKey']);
  });

  it('status(address) returns ["sessionKey", "status", address]', () => {
    expect(queryKeys.sessionKey.status('addr')).toEqual([
      'sessionKey',
      'status',
      'addr',
    ]);
  });
});

// =============================================================================
// Cache Invalidation: different args produce different tuples
// =============================================================================

describe('cache invalidation: different args produce different tuples', () => {
  it('posts.detail with different ids produce different keys', () => {
    const key1 = queryKeys.posts.detail('post-1');
    const key2 = queryKeys.posts.detail('post-2');
    expect(key1).not.toEqual(key2);
  });

  it('posts.infinite with different limits produce different keys', () => {
    const key1 = queryKeys.posts.infinite(10);
    const key2 = queryKeys.posts.infinite(20);
    expect(key1).not.toEqual(key2);
  });

  it('engagement.userLike with different postIds produce different keys', () => {
    const key1 = queryKeys.engagement.userLike('p1', 'u1');
    const key2 = queryKeys.engagement.userLike('p2', 'u1');
    expect(key1).not.toEqual(key2);
  });

  it('engagement.userLike with different userAddresses produce different keys', () => {
    const key1 = queryKeys.engagement.userLike('p1', 'u1');
    const key2 = queryKeys.engagement.userLike('p1', 'u2');
    expect(key1).not.toEqual(key2);
  });

  it('follow.isFollowing with different users produce different keys', () => {
    const key1 = queryKeys.follow.isFollowing('u1', 't1');
    const key2 = queryKeys.follow.isFollowing('u2', 't1');
    expect(key1).not.toEqual(key2);
  });

  it('engagement.batch with different postId arrays produce different keys', () => {
    const key1 = queryKeys.engagement.batch(['1', '2']);
    const key2 = queryKeys.engagement.batch(['3', '4']);
    expect(key1).not.toEqual(key2);
  });

  it('author.stats and role.user with same address produce structurally different keys', () => {
    const authorKey = queryKeys.author.stats('0xabc');
    const roleKey = queryKeys.role.user('0xabc');
    expect(authorKey).not.toEqual(roleKey);
  });
});
